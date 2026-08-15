// OWASP LLM Top 10 (2025) static audit of an exported n8n workflow.
//
// This is the canonical implementation. It lived only inside the n8n node
// (`SoterGuard.node.ts`), which was fine while n8n was the only consumer — but
// Make.com custom apps are declarative JSON and cannot run arbitrary code, so
// Make can only reach this logic over HTTP. Rather than write a second,
// drifting copy behind the endpoint, the rules live here and
// `app/api/workflow/audit/route.ts` is a thin wrapper.
//
// The n8n node keeps running its own local copy so that `workflowAudit` stays
// zero-network there (a security audit that has to phone home to run is a poor
// pitch). `tests/guard/workflow-audit-parity.test.ts` pins the two to identical
// output on a corpus — that test, not good intentions, is what prevents drift.
//
// Pure and dependency-free on purpose: no n8n types, no `NodeOperationError`,
// no I/O. Callers translate the thrown `WorkflowAuditError` into whatever their
// platform's error shape is.

export type AuditSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface AuditFinding {
  id: string;
  severity: AuditSeverity;
  nodeName: string | null;
  message: string;
  recommendation: string;
  owasp: string;
}

export interface WorkflowAuditResult {
  operation: "workflowAudit";
  workflowName: string;
  securityScore: number;
  riskLevel: AuditSeverity;
  readyForProduction: boolean;
  summary: string;
  findings: AuditFinding[];
  quickWins: string[];
  recommendedSoterAIPlacement: {
    beforeLlm: string[];
    beforeTools: string[];
    beforeOutput: string[];
    connectionCount: number;
  };
  owaspCoverage: string[];
}

export class WorkflowAuditError extends Error {}

interface WorkflowNode {
  name: string;
  type: string;
  parameters?: Record<string, unknown>;
}

const MAX_WORKFLOW_JSON_LENGTH = 2_000_000;

// ── Shared node-classification predicates ────────────────────────────────────
// Named rather than inlined because several of them are tested twice (once for a
// workflow-level finding, once per node), and an inline regex that drifts
// between the two reads as a rule change when it is really a typo.
const RE_AI_AGENT = /langchain\.agent|ai.?agent/i;
const RE_MEMORY = /memory|chatMemory|windowBuffer/i;
const RE_RAG = /vector|pinecone|qdrant|weaviate|supabase|retriever|document|embedding|splitter/i;
const RE_TOOL_LIKE = /tool|httpRequest|gmail|slack|telegram|discord|notion|sheets|database|postgres|mysql|mongo|airtable|github|jira|linear/i;
const RE_EGRESS = /respondToWebhook|email|gmail|slack|telegram|discord|notion|sheets/i;
const RE_CODE_NODE = /code|function|python/i;
const RE_WEBHOOK = /webhook|formTrigger/i;
const RE_RESPOND = /respondToWebhook|webhook/i;
const RE_CREDENTIAL_TEXT = /credential|api[_ -]?key|token|secret|password|bearer/i;
const RE_PUBLIC_INPUT = /webhook|formTrigger|chatTrigger|telegramTrigger|emailRead/i;
const RE_AI_NODE = /langchain|openAi|anthropic|gemini|llm|ai.?agent|chain/i;
const RE_OUTPUT_NODE = /respondToWebhook|httpRequest|email|gmail|slack|telegram|discord|notion|sheets/i;

const SOTER_NODE_TYPE = "n8n-nodes-soterai.soterGuard";

export function parseWorkflowJson(raw: string): Record<string, unknown> {
  if (!raw || !raw.trim()) {
    throw new WorkflowAuditError("Workflow JSON is required.");
  }
  if (raw.length > MAX_WORKFLOW_JSON_LENGTH) {
    throw new WorkflowAuditError("Workflow JSON is too large. Keep the export under 2 MB.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new WorkflowAuditError("Workflow JSON must be a valid exported n8n workflow object.");
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new WorkflowAuditError("Workflow JSON must be a valid exported n8n workflow object.");
}

function isWorkflowNode(value: unknown): value is WorkflowNode {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as WorkflowNode).name === "string" &&
      typeof (value as WorkflowNode).type === "string",
  );
}

function getParam(node: WorkflowNode, key: string): unknown {
  return node.parameters && typeof node.parameters === "object" ? node.parameters[key] : undefined;
}

function isToolLikeNode(node: WorkflowNode): boolean {
  return RE_TOOL_LIKE.test(`${node.type} ${node.name}`);
}

function auditFinding(
  id: string,
  severity: AuditSeverity,
  message: string,
  recommendation: string,
  owasp: string,
  nodeName?: string,
): AuditFinding {
  return { id, severity, nodeName: nodeName ?? null, message, recommendation, owasp };
}

export function calculateWorkflowSecurityScore(findings: AuditFinding[]): number {
  const penalty = findings.reduce((total, finding) => {
    switch (finding.severity) {
      case "CRITICAL":
        return total + 28;
      case "HIGH":
        return total + 16;
      case "MEDIUM":
        return total + 8;
      case "LOW":
        return total + 3;
      default:
        return total;
    }
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function riskLevelFromScore(score: number): AuditSeverity {
  if (score >= 85) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

function summarizeWorkflowAudit(score: number, findings: AuditFinding[]): string {
  const critical = findings.filter((finding) => finding.severity === "CRITICAL").length;
  const high = findings.filter((finding) => finding.severity === "HIGH").length;
  if (critical > 0) {
    return `High-risk workflow: ${critical} critical and ${high} high findings. Add Universal AI Firewall gates before production.`;
  }
  if (score < 85) {
    return `Needs hardening: ${high} high findings. Add guard placement and least-privilege controls.`;
  }
  return "Strong baseline: no critical findings detected by the n8n workflow audit.";
}

function workflowQuickWins(findings: AuditFinding[], context: Record<string, boolean>): string[] {
  const wins = new Set<string>();
  if (!context.hasUniversalGuard) {
    wins.add("Use Universal AI Firewall (Maximum Protection) directly after public inputs and before external outputs.");
  }
  if (context.hasToolLikeNode) {
    wins.add("Scan every AI-generated tool/function call before execution and require approval for external or mutating actions.");
  }
  if (context.hasRagOrVector) {
    wins.add("Scan RAG documents before indexing and scan retrieved context before the LLM consumes it.");
  }
  if (context.hasMemory) {
    wins.add("Scan memory writes for poisoning, secrets, and PII before storing them.");
  }
  if (findings.some((finding) => finding.id === "workflow.secret_reference")) {
    wins.add("Move every secret/API key/token into n8n credentials and rotate anything exposed in workflow JSON.");
  }
  wins.add("Route IF nodes on `blocked`, `finalDecision`, and `riskLevel` so risky items cannot silently continue.");
  return [...wins];
}

function recommendedSoterAIPlacement(nodes: WorkflowNode[], connections: Record<string, unknown>) {
  const publicInputs = nodes
    .filter((node) => RE_PUBLIC_INPUT.test(`${node.type} ${node.name}`))
    .map((node) => node.name);
  const aiNodes = nodes.filter((node) => RE_AI_NODE.test(`${node.type} ${node.name}`)).map((node) => node.name);
  const outputNodes = nodes
    .filter((node) => RE_OUTPUT_NODE.test(`${node.type} ${node.name}`))
    .map((node) => node.name);
  return {
    beforeLlm: publicInputs.length
      ? publicInputs.map((name) => `Place Universal AI Firewall immediately after ${name}.`)
      : ["Place Universal AI Firewall before the first LLM/AI Agent node."],
    beforeTools: aiNodes.length
      ? aiNodes.map((name) => `Inspect tool calls produced by ${name} before execution.`)
      : ["Enable Check Tool Call when an AI step can call tools."],
    beforeOutput: outputNodes.length
      ? outputNodes.map((name) => `Place Universal AI Firewall before ${name} for output and egress scanning.`)
      : ["Place Universal AI Firewall before any user-visible or external output."],
    connectionCount: Object.keys(connections).length,
  };
}

/**
 * Audit an exported n8n workflow against the OWASP LLM Top 10 (2025).
 *
 * Entirely static: it reads the exported JSON and never executes, fetches, or
 * connects to anything. That is what makes it safe to run on a customer's
 * production workflow export.
 */
export function auditWorkflow(workflowJson: string): WorkflowAuditResult {
  const workflow = parseWorkflowJson(workflowJson);
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes.filter(isWorkflowNode) : [];
  const connections =
    workflow.connections && typeof workflow.connections === "object"
      ? (workflow.connections as Record<string, unknown>)
      : {};
  const findings: AuditFinding[] = [];

  if (nodes.length === 0) {
    findings.push(
      auditFinding(
        "workflow.empty",
        "HIGH",
        "No workflow nodes were found.",
        "Export the full n8n workflow JSON and scan it before production use.",
        "LLM03:2025 Supply Chain",
      ),
    );
  }

  const hasSoterNode = nodes.some((wfNode) => wfNode.type === SOTER_NODE_TYPE);
  const hasUniversalGuard = nodes.some(
    (wfNode) => wfNode.type === SOTER_NODE_TYPE && getParam(wfNode, "action") === "universalGuard",
  );
  const hasAiAgent = nodes.some((wfNode) => RE_AI_AGENT.test(`${wfNode.type} ${wfNode.name}`));
  const hasToolLikeNode = nodes.some((wfNode) => isToolLikeNode(wfNode));
  const hasWebhook = nodes.some((wfNode) => RE_WEBHOOK.test(wfNode.type));
  const hasRespond = nodes.some((wfNode) => RE_RESPOND.test(wfNode.type));
  const hasRagOrVector = nodes.some((wfNode) => RE_RAG.test(`${wfNode.type} ${wfNode.name}`));
  const hasMemory = nodes.some((wfNode) => RE_MEMORY.test(`${wfNode.type} ${wfNode.name}`));

  if ((hasAiAgent || hasToolLikeNode || hasRagOrVector) && !hasUniversalGuard) {
    findings.push(
      auditFinding(
        "soterai.universal_guard_missing",
        "CRITICAL",
        "AI, tool, or RAG workflow does not use SoterAI Universal AI Firewall.",
        "Place Universal AI Firewall before the LLM/AI Agent and again before external output or tool execution.",
        "LLM01:2025 Prompt Injection",
      ),
    );
  } else if (!hasSoterNode) {
    findings.push(
      auditFinding(
        "soterai.guard_missing",
        "HIGH",
        "No SoterAI guard node was found in this workflow.",
        "Add SoterAI Universal AI Firewall or a focused SoterAI guard before risky AI steps.",
        "LLM05:2025 Improper Output Handling",
      ),
    );
  }

  for (const wfNode of nodes) {
    const searchable = `${wfNode.name} ${wfNode.type} ${JSON.stringify(wfNode.parameters ?? {})}`;
    if (RE_CODE_NODE.test(wfNode.type)) {
      findings.push(
        auditFinding(
          "n8n.code_node",
          "HIGH",
          `Code execution node detected: ${wfNode.name}.`,
          "Avoid executing LLM-generated content in Code nodes. Gate any AI-generated code or parameters through Universal AI Firewall and use least-privilege credentials.",
          "LLM05:2025 Improper Output Handling",
          wfNode.name,
        ),
      );
    }
    if (/httpRequest/i.test(wfNode.type) || /webhook|http|https:\/\//i.test(searchable)) {
      findings.push(
        auditFinding(
          "n8n.external_http",
          hasAiAgent ? "HIGH" : "MEDIUM",
          `External HTTP or webhook behavior detected near ${wfNode.name}.`,
          "Check destination allowlists and scan AI-generated payloads with Universal AI Firewall before any external request.",
          "LLM02:2025 Sensitive Information Disclosure",
          wfNode.name,
        ),
      );
    }
    if (RE_CREDENTIAL_TEXT.test(searchable)) {
      findings.push(
        auditFinding(
          "workflow.secret_reference",
          "CRITICAL",
          `Credential-like text appears in node parameters for ${wfNode.name}.`,
          "Keep secrets in n8n credentials only. Do not store tokens, passwords, or API keys in workflow JSON or prompts.",
          "LLM02:2025 Sensitive Information Disclosure",
          wfNode.name,
        ),
      );
    }
    if (RE_AI_AGENT.test(`${wfNode.type} ${wfNode.name}`) && !hasUniversalGuard) {
      findings.push(
        auditFinding(
          "ai_agent.unprotected",
          "CRITICAL",
          `AI Agent node appears unprotected: ${wfNode.name}.`,
          "Gate user input, retrieved context, tool calls, memory writes, and final output with Universal AI Firewall.",
          "LLM06:2025 Excessive Agency",
          wfNode.name,
        ),
      );
    }
    if (RE_MEMORY.test(`${wfNode.type} ${wfNode.name}`) && !hasUniversalGuard) {
      findings.push(
        auditFinding(
          "agent.memory_unprotected",
          "HIGH",
          `Agent memory is present without Universal AI Firewall: ${wfNode.name}.`,
          "Scan memory writes for poisoning, secrets, and PII before storage.",
          "LLM04:2025 Data and Model Poisoning",
          wfNode.name,
        ),
      );
    }
    if (RE_RAG.test(`${wfNode.type} ${wfNode.name}`) && !hasUniversalGuard) {
      findings.push(
        auditFinding(
          "rag.ingestion_unprotected",
          "HIGH",
          `RAG/vector workflow component detected: ${wfNode.name}.`,
          "Scan documents and chunks before indexing and before sending retrieved context to the LLM.",
          "LLM08:2025 Vector and Embedding Weaknesses",
          wfNode.name,
        ),
      );
    }
    if (RE_EGRESS.test(wfNode.type) && !hasUniversalGuard) {
      findings.push(
        auditFinding(
          "output.egress_unprotected",
          "HIGH",
          `External or user-visible output node may send unscanned AI content: ${wfNode.name}.`,
          "Run AI Output Text through Universal AI Firewall with the correct Output Destination Type before this node.",
          "LLM05:2025 Improper Output Handling",
          wfNode.name,
        ),
      );
    }
  }

  if (hasWebhook && hasAiAgent && !hasUniversalGuard) {
    findings.push(
      auditFinding(
        "webhook_to_agent_no_gate",
        "CRITICAL",
        "Public/webhook input can reach an AI Agent without a Universal AI Firewall gate.",
        "Place Universal AI Firewall immediately after Webhook/Form Trigger and block on `blocked === true`.",
        "LLM01:2025 Prompt Injection",
      ),
    );
  }

  if (hasRespond && hasAiAgent && !hasUniversalGuard) {
    findings.push(
      auditFinding(
        "agent_to_user_no_output_gate",
        "HIGH",
        "AI Agent output appears able to reach a user or external endpoint without output scanning.",
        "Place Universal AI Firewall after the LLM/AI Agent and before Respond/Webhook/Email/HTTP nodes.",
        "LLM02:2025 Sensitive Information Disclosure",
      ),
    );
  }

  const score = calculateWorkflowSecurityScore(findings);
  return {
    operation: "workflowAudit",
    workflowName: typeof workflow.name === "string" ? workflow.name : "Untitled workflow",
    securityScore: score,
    riskLevel: riskLevelFromScore(100 - score),
    readyForProduction: score >= 85 && !findings.some((finding) => finding.severity === "CRITICAL"),
    summary: summarizeWorkflowAudit(score, findings),
    findings,
    quickWins: workflowQuickWins(findings, {
      hasUniversalGuard,
      hasAiAgent,
      hasRagOrVector,
      hasMemory,
      hasToolLikeNode,
    }),
    recommendedSoterAIPlacement: recommendedSoterAIPlacement(nodes, connections),
    owaspCoverage: [
      "LLM01:2025 Prompt Injection",
      "LLM02:2025 Sensitive Information Disclosure",
      "LLM04:2025 Data and Model Poisoning",
      "LLM05:2025 Improper Output Handling",
      "LLM06:2025 Excessive Agency",
      "LLM08:2025 Vector and Embedding Weaknesses",
      "LLM10:2025 Unbounded Consumption",
    ],
  };
}
