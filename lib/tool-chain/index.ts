import { randomUUID } from "crypto";
import { sanitizeLogText, sanitizeMetadata } from "@/lib/guard/logSafety";

export const TOOL_CHAIN_DECISIONS = ["ALLOW", "BLOCK", "ASK_APPROVAL", "REVIEW"] as const;
export const TOOL_CHAIN_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const TOOL_CHAIN_FINDING_TYPES = [
  "DATA_EXFILTRATION_CHAIN",
  "PRIVILEGE_ESCALATION_CHAIN",
  "TOOL_POISONING_CHAIN",
  "MEMORY_TO_EGRESS",
  "RAG_TO_EXTERNAL",
  "SECRET_TO_OUTPUT",
  "UNKNOWN",
] as const;

export const TOOL_CHAIN_SOURCE_TYPES = [
  "PUBLIC_DATA",
  "PRIVATE_DATA",
  "RAG_DOCUMENT",
  "RAG_CONFIDENTIAL",
  "MEMORY",
  "FILE",
  "TERMINAL",
  "BROWSER_PAGE",
  "BROWSER_PAGE_UNTRUSTED",
  "MCP_TOOL",
  "MCP_TOOL_CHANGED",
  "SYSTEM_PROMPT",
  "SECRET",
  "UNKNOWN",
] as const;

export const TOOL_CHAIN_DESTINATION_TYPES = [
  "INTERNAL",
  "FINAL_OUTPUT",
  "EXTERNAL_EMAIL",
  "EMAIL_SEND",
  "EXTERNAL_API",
  "EXTERNAL_POST",
  "UNKNOWN_TOOL",
  "TOOL_CALL",
  "NETWORK_POST",
  "MEMORY",
  "FILE",
  "DATABASE",
  "NONE",
  "UNKNOWN",
] as const;

export const TOOL_CHAIN_DATA_SENSITIVITIES = [
  "PUBLIC",
  "INTERNAL",
  "PRIVATE",
  "CONFIDENTIAL",
  "SECRET",
  "SYSTEM_PROMPT",
  "REGULATED",
  "UNKNOWN",
] as const;

export type ToolChainDecision = (typeof TOOL_CHAIN_DECISIONS)[number];
export type ToolChainRiskLevel = (typeof TOOL_CHAIN_RISK_LEVELS)[number];
export type ToolChainFindingType = (typeof TOOL_CHAIN_FINDING_TYPES)[number];
export type ToolChainSourceType = (typeof TOOL_CHAIN_SOURCE_TYPES)[number];
export type ToolChainDestinationType = (typeof TOOL_CHAIN_DESTINATION_TYPES)[number];
export type ToolChainDataSensitivity = (typeof TOOL_CHAIN_DATA_SENSITIVITIES)[number];

export interface ToolChainStepInput {
  stepIndex?: number;
  tool: string;
  action: string;
  sourceType?: ToolChainSourceType;
  destinationType?: ToolChainDestinationType;
  dataSensitivity?: ToolChainDataSensitivity;
  metadata?: Record<string, unknown>;
}

export interface ToolChainStepSnapshot {
  id?: string;
  stepIndex: number;
  tool: string;
  action: string;
  sourceType: ToolChainSourceType;
  destinationType: ToolChainDestinationType;
  dataSensitivity: ToolChainDataSensitivity;
  signals: string[];
  decision?: ToolChainDecision;
  riskLevel?: ToolChainRiskLevel;
}

export interface ToolChainFindingCandidate {
  findingType: ToolChainFindingType;
  riskLevel: ToolChainRiskLevel;
  summary: string;
  involvedSteps: number[];
  recommendation: string;
}

export interface ToolChainStepDecisionResult {
  step: ToolChainStepSnapshot;
  decision: ToolChainDecision;
  riskLevel: ToolChainRiskLevel;
  reason: string;
  findings: ToolChainFindingCandidate[];
}

type SequenceRule = {
  id: ToolChainFindingType;
  riskLevel: ToolChainRiskLevel;
  decision: ToolChainDecision;
  earlier: string;
  later: string;
  summary: string;
  recommendation: string;
};

const SENSITIVE_LEVELS = new Set<ToolChainDataSensitivity>(["PRIVATE", "CONFIDENTIAL", "SECRET", "SYSTEM_PROMPT", "REGULATED"]);
const CONFIDENTIAL_LEVELS = new Set<ToolChainDataSensitivity>(["CONFIDENTIAL", "SECRET", "SYSTEM_PROMPT", "REGULATED"]);

const SEQUENCE_RULES: SequenceRule[] = [
  {
    id: "SECRET_TO_OUTPUT",
    riskLevel: "CRITICAL",
    decision: "BLOCK",
    earlier: "SYSTEM_PROMPT_ACCESS",
    later: "OUTPUT",
    summary: "System prompt or hidden instruction context reached an output destination.",
    recommendation: "Block the output and isolate system/developer instructions from user-visible responses.",
  },
  {
    id: "SECRET_TO_OUTPUT",
    riskLevel: "CRITICAL",
    decision: "BLOCK",
    earlier: "SECRET_DETECTED",
    later: "OUTPUT",
    summary: "Secret-bearing context reached a final output destination.",
    recommendation: "Block the response and redact or drop the secret-bearing context before retrying.",
  },
  {
    id: "PRIVILEGE_ESCALATION_CHAIN",
    riskLevel: "CRITICAL",
    decision: "BLOCK",
    earlier: "TERMINAL_RUN",
    later: "NETWORK_POST",
    summary: "Terminal execution was followed by a network post.",
    recommendation: "Require sandboxing and human approval before any command can contact the network.",
  },
  {
    id: "TOOL_POISONING_CHAIN",
    riskLevel: "CRITICAL",
    decision: "BLOCK",
    earlier: "MCP_TOOL_CHANGED",
    later: "HIGH_RISK_ACTION",
    summary: "A changed MCP tool was followed by a high-risk action.",
    recommendation: "Quarantine the changed tool and review its manifest before allowing high-risk execution.",
  },
  {
    id: "DATA_EXFILTRATION_CHAIN",
    riskLevel: "CRITICAL",
    decision: "BLOCK",
    earlier: "READ_PRIVATE_DATA",
    later: "EXTERNAL_SEND",
    summary: "Private or confidential data was read before an external send.",
    recommendation: "Block the chain or require explicit approval with redacted payload review.",
  },
  {
    id: "RAG_TO_EXTERNAL",
    riskLevel: "HIGH",
    decision: "BLOCK",
    earlier: "RAG_CONFIDENTIAL",
    later: "UNKNOWN_TOOL",
    summary: "Confidential RAG context was routed toward an unknown tool.",
    recommendation: "Allow only trusted tools for confidential RAG context and record a tool trust review.",
  },
  {
    id: "MEMORY_TO_EGRESS",
    riskLevel: "HIGH",
    decision: "BLOCK",
    earlier: "MEMORY_READ",
    later: "EXTERNAL_POST",
    summary: "Agent memory was read before an external post.",
    recommendation: "Block memory-to-egress flows unless the destination is trusted and user approved.",
  },
  {
    id: "DATA_EXFILTRATION_CHAIN",
    riskLevel: "HIGH",
    decision: "ASK_APPROVAL",
    earlier: "FILE_READ",
    later: "EMAIL_SEND",
    summary: "A file read was followed by an email send.",
    recommendation: "Pause the send and require approval after showing the redacted file-derived payload.",
  },
  {
    id: "TOOL_POISONING_CHAIN",
    riskLevel: "HIGH",
    decision: "REVIEW",
    earlier: "BROWSER_PAGE_UNTRUSTED",
    later: "TOOL_CALL",
    summary: "An untrusted browser page influenced a tool call.",
    recommendation: "Review the page content for prompt injection and isolate tool parameters from page text.",
  },
];

export function createToolChainSessionId() {
  return `tool_chain_${randomUUID()}`;
}

export function createToolChainStepId() {
  return `tool_chain_step_${randomUUID()}`;
}

export function createToolChainFindingId() {
  return `tool_chain_finding_${randomUUID()}`;
}

export function evaluateToolChainStep(previousSteps: ToolChainStepSnapshot[], input: ToolChainStepInput): ToolChainStepDecisionResult {
  const step = normalizeToolChainStep(input, input.stepIndex ?? previousSteps.length + 1);
  const chain = [...previousSteps, step];
  const findings = evaluateSequenceRules(chain);

  if (findings.length > 0) {
    const highest = highestFinding(findings);
    return {
      step,
      decision: highest.finding.decision,
      riskLevel: highest.finding.riskLevel,
      reason: highest.finding.summary,
      findings: findings.map(({ decision: _decision, ...finding }) => finding),
    };
  }

  if (step.signals.includes("UNKNOWN_TOOL") && hasPriorConfidentialRead(previousSteps)) {
    return buildSingleFindingResult(step, "BLOCK", "HIGH", {
      findingType: "RAG_TO_EXTERNAL",
      riskLevel: "HIGH",
      summary: "Unknown destination after confidential context read.",
      involvedSteps: collectSensitiveSteps(previousSteps, step.stepIndex),
      recommendation: "Route confidential data only to trusted tools with explicit policy approval.",
    });
  }

  if (step.signals.includes("BROWSER_PAGE_UNTRUSTED") || step.signals.includes("UNKNOWN_TOOL")) {
    return buildSingleFindingResult(step, "REVIEW", "MEDIUM", {
      findingType: "UNKNOWN",
      riskLevel: "MEDIUM",
      summary: "The tool chain includes an unknown or untrusted source/destination.",
      involvedSteps: [step.stepIndex],
      recommendation: "Review the step before allowing the agent to continue.",
    });
  }

  if (step.signals.includes("HIGH_RISK_ACTION")) {
    return {
      step,
      decision: "REVIEW",
      riskLevel: "MEDIUM",
      reason: "High-risk isolated action requires review before more chain context exists.",
      findings: [],
    };
  }

  return {
    step,
    decision: "ALLOW",
    riskLevel: "LOW",
    reason: "No dangerous multi-tool chain detected.",
    findings: [],
  };
}

export function normalizeToolChainStep(input: ToolChainStepInput, stepIndex = 1): ToolChainStepSnapshot {
  const tool = sanitizeLogText(input.tool || "unknown");
  const action = sanitizeLogText(input.action || "unknown");
  const sourceType = input.sourceType ?? inferSourceType(tool, action, input.metadata);
  const destinationType = input.destinationType ?? inferDestinationType(tool, action, input.metadata);
  const dataSensitivity = input.dataSensitivity ?? inferSensitivity(sourceType, action, input.metadata);
  const signals = inferStepSignals({ tool, action, sourceType, destinationType, dataSensitivity, metadata: input.metadata });

  return {
    stepIndex,
    tool,
    action,
    sourceType,
    destinationType,
    dataSensitivity,
    signals,
  };
}

export function sanitizeToolChainMetadata(metadata?: Record<string, unknown>) {
  return sanitizeMetadata(metadata);
}

export function safeToolChainSummary(value: string) {
  return sanitizeLogText(value);
}

function inferStepSignals(step: Required<Pick<ToolChainStepInput, "tool" | "action">> & {
  sourceType: ToolChainSourceType;
  destinationType: ToolChainDestinationType;
  dataSensitivity: ToolChainDataSensitivity;
  metadata?: Record<string, unknown>;
}) {
  const text = `${step.tool} ${step.action} ${step.sourceType} ${step.destinationType} ${step.dataSensitivity}`.toLowerCase();
  const signals = new Set<string>();

  if ((/read|fetch|select|query|load|open|inspect/.test(text) || step.sourceType === "PRIVATE_DATA") && SENSITIVE_LEVELS.has(step.dataSensitivity)) signals.add("READ_PRIVATE_DATA");
  if (step.sourceType === "RAG_CONFIDENTIAL" || (step.sourceType === "RAG_DOCUMENT" && CONFIDENTIAL_LEVELS.has(step.dataSensitivity))) signals.add("RAG_CONFIDENTIAL");
  if (step.sourceType === "MEMORY" && /read|fetch|load|recall|retrieve/.test(text)) signals.add("MEMORY_READ");
  if (step.sourceType === "FILE" && /read|fetch|load|open|cat/.test(text)) signals.add("FILE_READ");
  if (step.sourceType === "TERMINAL" || /\b(terminal|shell|powershell|bash|cmd|exec|run command)\b/.test(text)) signals.add("TERMINAL_RUN");
  if (step.sourceType === "BROWSER_PAGE_UNTRUSTED" || isTruthyMetadata(step.metadata, "untrustedPage")) signals.add("BROWSER_PAGE_UNTRUSTED");
  if (step.sourceType === "MCP_TOOL_CHANGED" || isTruthyMetadata(step.metadata, "mcpToolChanged")) signals.add("MCP_TOOL_CHANGED");
  if (step.sourceType === "SYSTEM_PROMPT" || step.dataSensitivity === "SYSTEM_PROMPT") signals.add("SYSTEM_PROMPT_ACCESS");
  if (step.sourceType === "SECRET" || step.dataSensitivity === "SECRET" || isTruthyMetadata(step.metadata, "secretDetected")) signals.add("SECRET_DETECTED");
  if (["EXTERNAL_EMAIL", "EMAIL_SEND"].includes(step.destinationType) || /\b(gmail|email|send email|forward email|smtp)\b/.test(text)) signals.add("EMAIL_SEND");
  if (["EXTERNAL_EMAIL", "EMAIL_SEND", "EXTERNAL_API", "EXTERNAL_POST", "NETWORK_POST"].includes(step.destinationType)) signals.add("EXTERNAL_SEND");
  if (["EXTERNAL_API", "EXTERNAL_POST"].includes(step.destinationType) || /\b(external api|webhook|post to|submit to|api request)\b/.test(text)) signals.add("EXTERNAL_POST");
  if (step.destinationType === "NETWORK_POST" || /\b(curl|http post|fetch\(|axios|network post|wget)\b/.test(text)) signals.add("NETWORK_POST");
  if (step.destinationType === "UNKNOWN_TOOL" || /\bunknown tool|untrusted tool\b/.test(text)) signals.add("UNKNOWN_TOOL");
  if (step.destinationType === "TOOL_CALL" || /\b(tool call|invoke tool|call tool)\b/.test(text)) signals.add("TOOL_CALL");
  if (step.destinationType === "FINAL_OUTPUT" || /\b(final output|respond|reply|answer user|show output)\b/.test(text)) signals.add("OUTPUT");
  if (/\b(delete|drop|destroy|rm -rf|payment|purchase|install|execute|exec|publish|push|send)\b/.test(text)) signals.add("HIGH_RISK_ACTION");

  return [...signals];
}

function evaluateSequenceRules(chain: ToolChainStepSnapshot[]) {
  const findings: Array<ToolChainFindingCandidate & { decision: ToolChainDecision }> = [];
  for (const rule of SEQUENCE_RULES) {
    const earlier = chain.find((step) => step.signals.includes(rule.earlier));
    const later = earlier ? chain.find((step) => step.stepIndex > earlier.stepIndex && step.signals.includes(rule.later)) : undefined;
    if (!earlier || !later) continue;

    const adjusted = adjustRuleForSensitivity(rule, chain);
    findings.push({
      findingType: adjusted.id,
      riskLevel: adjusted.riskLevel,
      decision: adjusted.decision,
      summary: adjusted.summary,
      involvedSteps: [earlier.stepIndex, later.stepIndex],
      recommendation: adjusted.recommendation,
    });
  }
  return dedupeFindings(findings);
}

function adjustRuleForSensitivity(rule: SequenceRule, chain: ToolChainStepSnapshot[]): SequenceRule {
  if (rule.earlier === "FILE_READ" && chain.some((step) => step.signals.includes("FILE_READ") && CONFIDENTIAL_LEVELS.has(step.dataSensitivity))) {
    return { ...rule, decision: "BLOCK", riskLevel: "CRITICAL", summary: "A confidential file read was followed by an email send." };
  }
  if (rule.earlier === "READ_PRIVATE_DATA" && chain.some((step) => step.signals.includes("READ_PRIVATE_DATA") && CONFIDENTIAL_LEVELS.has(step.dataSensitivity))) {
    return { ...rule, decision: "BLOCK", riskLevel: "CRITICAL" };
  }
  return rule;
}

function highestFinding(findings: Array<ToolChainFindingCandidate & { decision: ToolChainDecision }>) {
  const ranked = [...findings].sort((a, b) => riskRank(b.riskLevel) - riskRank(a.riskLevel));
  return { finding: ranked[0] };
}

function buildSingleFindingResult(
  step: ToolChainStepSnapshot,
  decision: ToolChainDecision,
  riskLevel: ToolChainRiskLevel,
  finding: ToolChainFindingCandidate,
): ToolChainStepDecisionResult {
  return {
    step,
    decision,
    riskLevel,
    reason: finding.summary,
    findings: [finding],
  };
}

function dedupeFindings(findings: Array<ToolChainFindingCandidate & { decision: ToolChainDecision }>) {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.findingType}:${finding.involvedSteps.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasPriorConfidentialRead(steps: ToolChainStepSnapshot[]) {
  return steps.some((step) => step.signals.includes("READ_PRIVATE_DATA") || step.signals.includes("RAG_CONFIDENTIAL") || CONFIDENTIAL_LEVELS.has(step.dataSensitivity));
}

function collectSensitiveSteps(steps: ToolChainStepSnapshot[], currentStepIndex: number) {
  const involved = steps
    .filter((step) => step.signals.includes("READ_PRIVATE_DATA") || step.signals.includes("RAG_CONFIDENTIAL") || CONFIDENTIAL_LEVELS.has(step.dataSensitivity))
    .map((step) => step.stepIndex);
  return [...new Set([...involved, currentStepIndex])];
}

function inferSourceType(tool: string, action: string, metadata?: Record<string, unknown>): ToolChainSourceType {
  const text = `${tool} ${action}`.toLowerCase();
  if (isTruthyMetadata(metadata, "mcpToolChanged")) return "MCP_TOOL_CHANGED";
  if (isTruthyMetadata(metadata, "untrustedPage")) return "BROWSER_PAGE_UNTRUSTED";
  if (/system prompt|developer message|hidden instruction/.test(text)) return "SYSTEM_PROMPT";
  if (/rag|vector|retrieval/.test(text)) return "RAG_DOCUMENT";
  if (/memory|recall/.test(text)) return "MEMORY";
  if (/file|fs\.|filesystem|readfile|cat /.test(text)) return "FILE";
  if (/terminal|shell|powershell|bash|cmd/.test(text)) return "TERMINAL";
  if (/browser|page|dom/.test(text)) return "BROWSER_PAGE";
  if (/mcp/.test(text)) return "MCP_TOOL";
  return "UNKNOWN";
}

function inferDestinationType(tool: string, action: string, metadata?: Record<string, unknown>): ToolChainDestinationType {
  const text = `${tool} ${action}`.toLowerCase();
  if (isTruthyMetadata(metadata, "unknownTool")) return "UNKNOWN_TOOL";
  if (/final output|respond|reply|answer user/.test(text)) return "FINAL_OUTPUT";
  if (/gmail|email|smtp|send email|forward/.test(text)) return "EXTERNAL_EMAIL";
  if (/webhook|external api|api request|post to|submit to/.test(text)) return "EXTERNAL_API";
  if (/curl|http|network/.test(text)) return "NETWORK_POST";
  if (/tool call|invoke tool|call tool/.test(text)) return "TOOL_CALL";
  if (/memory/.test(text)) return "MEMORY";
  if (/file|writefile/.test(text)) return "FILE";
  return "INTERNAL";
}

function inferSensitivity(sourceType: ToolChainSourceType, action: string, metadata?: Record<string, unknown>): ToolChainDataSensitivity {
  const explicit = metadata?.sensitivity;
  if (typeof explicit === "string" && TOOL_CHAIN_DATA_SENSITIVITIES.includes(explicit as ToolChainDataSensitivity)) {
    return explicit as ToolChainDataSensitivity;
  }
  if (sourceType === "SYSTEM_PROMPT") return "SYSTEM_PROMPT";
  if (sourceType === "SECRET") return "SECRET";
  if (sourceType === "RAG_CONFIDENTIAL") return "CONFIDENTIAL";
  if (sourceType === "PRIVATE_DATA" || /private|customer|crm|pii|personal/.test(action.toLowerCase())) return "PRIVATE";
  return "PUBLIC";
}

function isTruthyMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  return metadata?.[key] === true || metadata?.[key] === "true";
}

function riskRank(risk: ToolChainRiskLevel) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[risk];
}
