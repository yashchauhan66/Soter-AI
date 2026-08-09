/**
 * Zapier creates for the four analysis actions that had no Zapier equivalent:
 * Analyze Text, Streaming Guard, Universal Guard, and Workflow Audit.
 *
 * Make and n8n already had most of these; this file is what brings Zapier to
 * the same 12-operation surface, so a customer choosing a platform is choosing
 * on workflow ergonomics rather than on which one happens to expose the feature
 * they need.
 */

import {
  CALIBRATION_OUTPUT_FIELDS,
  TOPIC_INPUT_FIELDS,
  calibrationFields,
  resolveProjectId,
  soterPost,
  topicRequestFields,
  type ZapierBundle,
  type ZapierZ,
} from "./shared";

/* ------------------------------------------------------------------ */
/*  Analyze Text                                                       */
/* ------------------------------------------------------------------ */

export const analyzeText = {
  key: "analyze_text",
  noun: "Analysis",
  display: {
    label: "Analyze Text for Threats",
    description:
      "Analyze any text for prompt injection, jailbreaks, PII, and other AI security threats. Works in either direction (user input or AI output).",
  },
  operation: {
    inputFields: [
      { key: "text", label: "Text", type: "text" as const, required: true },
      {
        key: "direction",
        label: "Direction",
        type: "string" as const,
        required: false,
        choices: { INPUT: "Input (User -> AI)", OUTPUT: "Output (AI -> User)" },
        default: "INPUT",
      },
      {
        key: "source",
        label: "Content Source",
        type: "string" as const,
        required: false,
        choices: {
          USER: "User (first-party)",
          RETRIEVED_DOCUMENT: "Retrieved document (RAG)",
          TOOL_OUTPUT: "Tool output",
          THIRD_PARTY: "Third party",
        },
        helpText:
          "Where this text came from. Leave blank for first-party user input. Marking retrieved content lets the engine treat an embedded instruction as an indirect injection rather than as your own instruction.",
      },
    ],
    sample: {
      allowed: true,
      action: "ALLOW",
      riskScore: 0,
      categories: [],
      safeText: "What is the weather today?",
      reason: null,
      primaryRiskType: null,
      categoryConfidence: {},
      latencyMs: 3,
    },
    outputFields: [
      { key: "allowed", label: "Allowed", type: "boolean" as const },
      { key: "action", label: "Action", type: "string" as const },
      { key: "riskScore", label: "Risk Score", type: "number" as const },
      { key: "categories", label: "Risk Categories", list: true },
      { key: "safeText", label: "Safe Text", type: "string" as const },
      { key: "reason", label: "Reason", type: "string" as const },
      ...CALIBRATION_OUTPUT_FIELDS,
    ],
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      // /api/guard/analyze is the public, key-less endpoint. Passing
      // requireAuth: false keeps this action usable during evaluation, before
      // the user has an API key — which is the point of having a public tier.
      const raw = await soterPost(
        z,
        bundle,
        "/api/guard/analyze",
        {
          text: bundle.inputData.text,
          direction: bundle.inputData.direction || "INPUT",
          source: bundle.inputData.source || undefined,
        },
        { requireAuth: false },
      );

      return {
        allowed: raw.allowed,
        action: raw.action ?? null,
        riskScore: raw.riskScore,
        categories: raw.riskTypes ?? [],
        safeText: raw.safeText ?? raw.redactedText ?? bundle.inputData.text,
        reason: raw.reason ?? null,
        ...calibrationFields(raw),
      };
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Streaming Guard                                                    */
/* ------------------------------------------------------------------ */

export const streamingGuard = {
  key: "streaming_guard",
  noun: "Streaming Guard",
  display: {
    label: "Streaming Guard",
    description:
      "Inspect long content in chunks and get a per-chunk risk result. Use this to abort an LLM generation early when a high-risk chunk appears, rather than waiting for the full response.",
  },
  operation: {
    inputFields: [
      { key: "content", label: "Content", type: "text" as const, required: true },
      {
        key: "direction",
        label: "Direction",
        type: "string" as const,
        required: false,
        choices: { INPUT: "INPUT", OUTPUT: "OUTPUT" },
        default: "INPUT",
      },
      {
        key: "stream",
        label: "Per-Chunk Results",
        type: "boolean" as const,
        required: false,
        default: "true",
        helpText:
          "On: one result per chunk, so you can act on the first risky chunk. Off: a single aggregated result for the whole content.",
      },
      {
        key: "chunkSize",
        label: "Chunk Size (characters)",
        type: "number" as const,
        required: false,
        default: "500",
        helpText: "Between 50 and 10000.",
      },
      {
        key: "includeRedacted",
        label: "Include Redacted Text",
        type: "boolean" as const,
        required: false,
        default: "true",
      },
      { key: "sessionId", label: "Session ID", type: "string" as const, required: false },
      { key: "project", label: "Project ID", type: "string" as const, required: false },
    ],
    sample: {
      direction: "INPUT",
      stream: true,
      chunkCount: 2,
      totalLength: 640,
      chunks: [],
      highestRiskScore: 0,
      firstRiskyChunkIndex: null,
    },
    outputFields: [
      { key: "direction", label: "Direction", type: "string" as const },
      { key: "stream", label: "Streamed", type: "boolean" as const },
      { key: "chunkCount", label: "Chunk Count", type: "number" as const },
      { key: "totalLength", label: "Total Length", type: "number" as const },
      { key: "chunks", label: "Chunks", list: true },
      { key: "highestRiskScore", label: "Highest Risk Score", type: "number" as const },
      { key: "firstRiskyChunkIndex", label: "First Risky Chunk Index", type: "number" as const },
    ],
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const projectId = resolveProjectId(bundle);
      const raw = await soterPost(z, bundle, "/api/guard/streaming", {
        content: bundle.inputData.content,
        direction: bundle.inputData.direction || "INPUT",
        stream: bundle.inputData.stream === undefined ? true : toBoolean(bundle.inputData.stream),
        chunkSize: bundle.inputData.chunkSize ? Number(bundle.inputData.chunkSize) : undefined,
        includeRedacted:
          bundle.inputData.includeRedacted === undefined ? undefined : toBoolean(bundle.inputData.includeRedacted),
        sessionId: bundle.inputData.sessionId || undefined,
        metadata: projectId ? { projectId } : undefined,
      });

      // A Zap author cannot loop over chunks looking for the first risky one —
      // Zapier steps are linear. Computing it here is the difference between
      // this action being usable in a Zap and being a JSON blob they cannot act
      // on. `highestRiskScore` serves the same purpose for a filter step.
      const chunks = (raw.chunks as Array<Record<string, unknown>>) ?? [];
      const scores = chunks.map((chunk) => {
        const result = (chunk.result as Record<string, unknown>) ?? {};
        return typeof result.riskScore === "number" ? result.riskScore : 0;
      });
      const firstRisky = chunks.findIndex((chunk) => {
        const result = (chunk.result as Record<string, unknown>) ?? {};
        return result.allowed === false;
      });

      return {
        direction: raw.direction ?? bundle.inputData.direction ?? "INPUT",
        stream: raw.stream ?? true,
        chunkCount: raw.chunkCount ?? chunks.length,
        totalLength: raw.totalLength ?? bundle.inputData.content.length,
        chunks,
        highestRiskScore: scores.length ? Math.max(...scores) : 0,
        firstRiskyChunkIndex: firstRisky === -1 ? null : firstRisky,
      };
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Universal Guard                                                    */
/* ------------------------------------------------------------------ */

/**
 * Layer decisions, ordered worst-first.
 *
 * Transcribed from the n8n node's `decideUniversal` so the two platforms reach
 * the same verdict for the same inputs. BLOCK beats ASK_APPROVAL beats REDACT
 * beats REVIEW: a stricter layer is never overridden by a permissive one.
 */
const DECISION_PRIORITY = ["BLOCK", "ASK_APPROVAL", "REDACT", "REVIEW", "ALLOW"] as const;

export const universalGuard = {
  key: "universal_guard",
  noun: "Universal Guard",
  display: {
    label: "Universal Guard (All Layers)",
    description:
      "Run every applicable SoterAI check in one step — input, RAG document, tool call, and AI output — and get a single combined verdict. Use this instead of chaining four separate actions.",
  },
  operation: {
    inputFields: [
      { key: "text", label: "Input Text", type: "text" as const, required: true },
      {
        key: "profile",
        label: "Protection Profile",
        type: "string" as const,
        required: false,
        choices: {
          BALANCED: "Balanced (recommended)",
          STRICT: "Strict",
          MAXIMUM: "Maximum",
        },
        default: "BALANCED",
        helpText:
          "Strict and Maximum escalate on aggregate risk even when no single layer blocked. Maximum turns anything HIGH into an approval request.",
      },
      {
        key: "onThreat",
        label: "On Threat",
        type: "string" as const,
        required: false,
        choices: { BLOCK: "Block", REDACT: "Redact", WARN: "Warn", CONTINUE: "Continue" },
        default: "BLOCK",
      },
      {
        key: "aiOutputText",
        label: "AI Output Text",
        type: "text" as const,
        required: false,
        helpText: "Optional. Supply the model's reply to also run the output and egress layers.",
      },
      {
        key: "ragText",
        label: "RAG Document Text",
        type: "text" as const,
        required: false,
        helpText: "Optional. Supply retrieved context to also run the RAG trust layer.",
      },
      { key: "ragDocumentId", label: "RAG Document ID", type: "string" as const, required: false },
      { key: "toolName", label: "Tool Name", type: "string" as const, required: false },
      {
        key: "toolAction",
        label: "Tool Action",
        type: "string" as const,
        required: false,
        helpText: "Required if Tool Name is set. Together these run the agent tool-call layer.",
      },
      { key: "toolTarget", label: "Tool Target", type: "string" as const, required: false },
      { key: "sessionId", label: "Session ID", type: "string" as const, required: false },
      { key: "project", label: "Project ID", type: "string" as const, required: false },
      ...TOPIC_INPUT_FIELDS,
    ],
    sample: {
      finalDecision: "ALLOW",
      allowed: true,
      blocked: false,
      needsHumanReview: false,
      riskLevel: "LOW",
      riskScore: 0,
      categories: [],
      reason: "input: All enabled AI security checks passed.",
      outputText: "What is the weather today?",
      safeText: "What is the weather today?",
      layersRun: ["input"],
      checks: [],
    },
    outputFields: [
      { key: "finalDecision", label: "Final Decision", type: "string" as const },
      { key: "allowed", label: "Allowed", type: "boolean" as const },
      { key: "blocked", label: "Blocked", type: "boolean" as const },
      { key: "needsHumanReview", label: "Needs Human Review", type: "boolean" as const },
      { key: "riskLevel", label: "Risk Level", type: "string" as const },
      { key: "riskScore", label: "Risk Score", type: "number" as const },
      { key: "categories", label: "Risk Categories", list: true },
      { key: "reason", label: "Reason", type: "string" as const },
      { key: "outputText", label: "Output Text", type: "string" as const },
      { key: "safeText", label: "Safe Text", type: "string" as const },
      { key: "layersRun", label: "Layers Run", list: true },
      { key: "checks", label: "Per-Layer Checks", list: true },
      ...CALIBRATION_OUTPUT_FIELDS,
    ],
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const input = bundle.inputData;
      const projectId = resolveProjectId(bundle);
      const profile = (input.profile || "BALANCED").toUpperCase();
      const metadata: Record<string, unknown> = {
        soteraiNodeMode: "universalGuard",
        protectionProfile: profile,
        ...(projectId ? { projectId } : {}),
      };

      const checks: Array<Record<string, unknown>> = [];

      // Input layer always runs. onThreat is deliberately not forwarded to the
      // sub-calls: enforcement happens once, on the combined verdict, so a
      // layer cannot blank the text out from under a later layer.
      const inputResult = await soterPost(z, bundle, "/api/guard/input", {
        message: input.text,
        metadata,
        ...topicRequestFields(bundle),
      });
      checks.push({ layer: "input", ...inputResult });

      if (input.ragText?.trim()) {
        const rag = await soterPost(z, bundle, "/api/rag/document/trust-score", {
          projectId,
          documentId: input.ragDocumentId?.trim() || `zapier-${bundle.inputData.sessionId || "doc"}`,
          content: input.ragText,
          source: "api",
        });
        checks.push({ layer: "rag", ...rag });
      }

      if (input.toolName?.trim()) {
        if (!input.toolAction?.trim()) {
          throw new Error("Tool Action is required when Tool Name is set.");
        }
        const tool = await soterPost(z, bundle, "/api/agent/tool/check", {
          sessionId: input.sessionId || undefined,
          agentName: "zapier-agent",
          tool: input.toolName,
          action: input.toolAction,
          target: input.toolTarget || undefined,
          content: input.text,
          metadata,
        });
        checks.push({ layer: "tool", ...tool });
      }

      let outputText = input.aiOutputText?.trim()
        ? input.aiOutputText
        : (inputResult.safeText as string) ?? input.text;

      if (input.aiOutputText?.trim()) {
        const output = await soterPost(z, bundle, "/api/guard/output", {
          aiResponse: input.aiOutputText,
          metadata,
        });
        checks.push({ layer: "output", ...output });
        outputText = (output.safeText as string) ?? input.aiOutputText;

        const egress = await soterPost(z, bundle, "/api/semantic-egress/check", {
          sessionId: input.sessionId || undefined,
          content: input.aiOutputText,
          destinationType: "FINAL_OUTPUT",
          metadata,
        });
        checks.push({ layer: "semanticEgress", ...egress });
      }

      const verdict = combineLayers(checks, profile);
      const safeText = firstString(checks, ["safeText", "safeContent", "contentRedacted"]) || outputText;
      const enforced = enforce(verdict.decision, input.onThreat || "BLOCK", outputText, safeText);

      return {
        finalDecision: verdict.decision,
        allowed: verdict.decision !== "BLOCK",
        blocked: enforced.blocked,
        needsHumanReview: verdict.decision === "ASK_APPROVAL",
        riskLevel: verdict.riskLevel,
        riskScore: verdict.riskScore,
        categories: collectCategories(checks),
        reason: verdict.reason,
        outputText: enforced.outputText,
        safeText,
        layersRun: checks.map((check) => check.layer as string),
        checks,
        ...calibrationFields(inputResult),
      };
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Workflow Audit                                                     */
/* ------------------------------------------------------------------ */

export const workflowAudit = {
  key: "workflow_audit",
  noun: "Workflow Audit",
  display: {
    label: "Audit Workflow for AI Security Risks",
    description:
      "Statically audit an exported n8n workflow against the OWASP LLM Top 10 and get a security score with per-finding recommendations.",
  },
  operation: {
    inputFields: [
      {
        key: "workflowJson",
        label: "Workflow JSON",
        type: "text" as const,
        required: true,
        helpText:
          "Paste an exported n8n workflow (Download / Copy from the n8n canvas). The audit is static — it never executes the workflow, resolves a credential, or contacts anything the workflow references — and the export is not stored.",
      },
    ],
    sample: {
      workflowName: "Support Agent",
      securityScore: 44,
      riskLevel: "MEDIUM",
      readyForProduction: false,
      findings: [],
      quickWins: [],
      recommendedSoterAIPlacement: [],
      owaspCoverage: [],
    },
    outputFields: [
      { key: "workflowName", label: "Workflow Name", type: "string" as const },
      { key: "securityScore", label: "Security Score", type: "number" as const },
      { key: "riskLevel", label: "Risk Level", type: "string" as const },
      { key: "readyForProduction", label: "Ready for Production", type: "boolean" as const },
      { key: "findings", label: "Findings", list: true },
      { key: "quickWins", label: "Quick Wins", list: true },
      { key: "recommendedSoterAIPlacement", label: "Recommended SoterAI Placement", list: true },
      { key: "owaspCoverage", label: "OWASP Coverage", list: true },
    ],
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      // This calls /api/workflow/audit rather than auditing locally, which is a
      // deliberate difference from the n8n node.
      //
      // n8n runs the audit in-process because a community node ships its own
      // code and the workflow export never leaves the user's instance. A Zapier
      // app is published as a standalone bundle and cannot import this repo's
      // lib/, so the only ways to be local here would be to vendor a copy of
      // the rules into this package — a third implementation to drift — or to
      // publish lib/guard/workflowAudit.ts as an npm package, which is a
      // release-process commitment this task did not agree to.
      //
      // The endpoint is the same shared implementation, does not persist the
      // submitted workflow, and is static (no execution, no credential
      // resolution). The honest statement to users is therefore "not stored",
      // not "never leaves Zapier" — see the helpText above.
      const raw = await soterPost(z, bundle, "/api/workflow/audit", {
        workflowJson: bundle.inputData.workflowJson,
      });
      return raw;
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Universal Guard helpers                                            */
/* ------------------------------------------------------------------ */

function combineLayers(checks: Array<Record<string, unknown>>, profile: string) {
  const layers = checks.map(toLayerDecision);
  const worst = layers.reduce(
    (current, item) => (riskRank(item.riskLevel) > riskRank(current.riskLevel) ? item : current),
    { decision: "ALLOW", riskLevel: "LOW", riskScore: 0, reason: "All enabled AI security checks passed.", layer: "universal" },
  );

  let decision = "ALLOW";
  for (const candidate of DECISION_PRIORITY) {
    if (layers.some((layer) => layer.decision === candidate)) {
      decision = candidate;
      break;
    }
  }

  // Profile escalation, mirroring the n8n node exactly. The thresholds are the
  // node's, not new ones: two platforms disagreeing about the same workflow is
  // the failure mode this whole parity effort exists to prevent.
  if (profile === "MAXIMUM") {
    if (worst.riskLevel === "CRITICAL" || worst.riskScore >= 75) decision = "BLOCK";
    else if (worst.riskLevel === "HIGH" || worst.riskScore >= 55) decision = "ASK_APPROVAL";
    else if (decision === "REVIEW") decision = "ASK_APPROVAL";
  } else if (profile === "STRICT") {
    if (worst.riskLevel === "CRITICAL" || worst.riskScore >= 85) decision = "BLOCK";
    else if (worst.riskLevel === "HIGH" || worst.riskScore >= 65) decision = decision === "REDACT" ? "REDACT" : "ASK_APPROVAL";
  }

  return { decision, riskLevel: worst.riskLevel, riskScore: worst.riskScore, reason: `${worst.layer}: ${worst.reason}` };
}

function toLayerDecision(check: Record<string, unknown>) {
  const layer = typeof check.layer === "string" ? check.layer : "unknown";
  let decision = normalizeDecision(check.decision) ?? normalizeDecision(check.action);
  if (!decision && check.allowed === false) decision = "BLOCK";
  if (!decision && typeof check.recommendedAction === "string") {
    const action = check.recommendedAction.toUpperCase();
    if (action.includes("QUARANTINE")) decision = "BLOCK";
    else if (action.includes("REDACT")) decision = "REDACT";
    else if (action.includes("REVIEW")) decision = "REVIEW";
  }
  const riskScore = scoreFromCheck(check);
  return {
    layer,
    decision: decision ?? "ALLOW",
    riskLevel: normalizeRisk(check.riskLevel) ?? riskLevelFromScore(riskScore),
    riskScore,
    reason:
      typeof check.reason === "string"
        ? check.reason
        : typeof check.trustLevel === "string"
          ? `RAG trust level ${check.trustLevel}`
          : "Check completed.",
  };
}

function normalizeDecision(value: unknown): string | undefined {
  if (value === "ALLOW" || value === "BLOCK" || value === "REDACT" || value === "ASK_APPROVAL" || value === "REVIEW") {
    return value;
  }
  if (value === "HUMAN_REVIEW" || value === "REQUIRE_APPROVAL" || value === "TAKEOVER_REQUIRED") return "ASK_APPROVAL";
  if (value === "ALLOW_WITH_REDACTION" || value === "REWRITE") return "REDACT";
  return undefined;
}

function normalizeRisk(value: unknown): string | undefined {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "CRITICAL" ? value : undefined;
}

/** Same thresholds as SoterGuard.node.ts and lib/guard/workflowAudit.ts. */
function riskLevelFromScore(score: number): string {
  if (score >= 85) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

function riskRank(level: string): number {
  return { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[level] ?? 0;
}

function scoreFromCheck(check: Record<string, unknown>): number {
  if (typeof check.riskScore === "number") return normalizeScore(check.riskScore);
  // The RAG layer reports trust, which is the inverse of risk. Failing to
  // invert it would read a highly-trusted document as maximally dangerous.
  if (typeof check.trustScore === "number") return normalizeScore(100 - check.trustScore);
  return 0;
}

function normalizeScore(value: number): number {
  // Some endpoints report 0-1, others 0-100. Treating 0.9 as "score 0.9" would
  // silently downgrade a near-certain threat to LOW.
  const scaled = value > 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function collectCategories(checks: Array<Record<string, unknown>>): string[] {
  const out = new Set<string>();
  for (const check of checks) {
    for (const key of ["categories", "riskTypes"]) {
      const value = check[key];
      if (Array.isArray(value)) {
        for (const entry of value) if (typeof entry === "string") out.add(entry);
      }
    }
  }
  return [...out];
}

function firstString(checks: Array<Record<string, unknown>>, keys: string[]): string {
  for (const check of checks) {
    for (const key of keys) {
      const value = check[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return "";
}

function enforce(decision: string, onThreat: string, originalText: string, safeText: string) {
  if (decision === "ALLOW") return { blocked: false, outputText: originalText };
  switch (onThreat) {
    case "BLOCK":
      return { blocked: decision === "BLOCK" || decision === "ASK_APPROVAL", outputText: decision === "REDACT" ? safeText : "" };
    case "REDACT":
      return { blocked: false, outputText: safeText || "[REDACTED]" };
    case "WARN":
    case "CONTINUE":
    default:
      return { blocked: false, outputText: originalText };
  }
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  return `${value}`.toLowerCase() === "true" || `${value}` === "1" || `${value}`.toLowerCase() === "yes";
}
