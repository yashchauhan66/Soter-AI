import type { GuardFinding, GuardResult, RiskType } from "./types";

/**
 * Guard routing advisory (Phase 4 — unify general guard, agent firewall, tool
 * check, and RAG protection).
 *
 * Problem this solves: a caller who only ever calls `/guard/input` (general
 * guard) may assume every agent/tool/RAG risk is covered. It is not — the deep
 * agent firewall (`/api/agent/*`), tool-check, and RAG endpoints exist for that.
 * When the general guard sees text that *looks like* an agent action, a tool
 * invocation, or retrieved-document content, it should still surface the risk
 * AND tell the caller which specialized endpoint to use next.
 *
 * This is purely additive: it never changes the guard's allow/block decision or
 * the existing response fields. It attaches a `metadata.advisory` object so SDKs
 * and dashboards can route users correctly. Backward-compatible by construction.
 */

export type AdvisoryRiskClass =
  | "TOOL_ABUSE"
  | "EXCESSIVE_AGENCY"
  | "RAG_INDIRECT_INJECTION"
  | "DATA_EXFILTRATION"
  | "PROMPT_ATTACK"
  | "SENSITIVE_DATA"
  | "NONE";

export interface GuardAdvisory {
  /** The dominant class of risk, used to pick the recommended surface. */
  riskClass: AdvisoryRiskClass;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** The specialized endpoint that fully covers this risk class, if any. */
  recommendedEndpoint: string | null;
  /** Matching SDK method name for the recommended surface. */
  recommendedSdkMethod: string | null;
  /** Plain-language next step for the integrator. */
  safeNextAction: string;
  /** Whether the general guard alone is sufficient for this payload. */
  generalGuardSufficient: boolean;
}

/**
 * Heuristics that recognize agent/tool/RAG-shaped intent from the raw text.
 * These are deliberately broad (advisory only — they never block) and complement
 * the scored detectors, which may or may not have produced a finding.
 */
const TOOL_INVOCATION = /\b(?:use|call|invoke|run|execute|trigger)\b[^.]{0,60}\b(?:tool|function|shell|exec|command|api|webhook|connector|mcp|database|db|email|payment|search|browser|http)\b/i;
const DESTRUCTIVE_OP = /\b(?:rm\s+-rf|drop\s+table|delete\s+(?:all|every|from)|truncate\b|wipe|destroy|shutdown|format\s+(?:disk|drive))\b/i;
const UNBOUNDED_AGENCY = /\b(?:autonomously|without (?:confirmation|approval|asking)|do not ask|skip (?:the )?(?:approval|confirmation)|in a loop|until (?:you|it) (?:find|get|have) (?:every|all)|repeatedly|whatever it takes)\b/i;
const RAG_DOC_INSTRUCTION = /(?:note to (?:any )?(?:ai|assistant)|instructions? for (?:the )?ai|if an ai (?:reads|sees) this|this (?:document|page|chunk|record) (?:has (?:higher|top) priority|overrides|instructs)|<!--\s*ai\b|dear (?:ai|assistant))/i;

function highestSeverity(findings: GuardFinding[]): GuardAdvisory["severity"] {
  const order = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;
  let best: GuardAdvisory["severity"] = "LOW";
  for (const f of findings) if (order[f.severity] > order[best]) best = f.severity;
  return best;
}

/**
 * Derives an advisory from the analyzed text + findings. Pure and side-effect
 * free. Returns a NONE advisory (generalGuardSufficient=true) for ordinary
 * prompt attacks and clean input, so it only speaks up when a specialized
 * surface would genuinely add coverage.
 */
export function deriveAdvisory(text: string, findings: GuardFinding[], riskTypes: RiskType[]): GuardAdvisory {
  const severity = findings.length ? highestSeverity(findings) : "LOW";

  const looksDestructive = DESTRUCTIVE_OP.test(text);
  const looksToolCall = TOOL_INVOCATION.test(text);
  const looksUnbounded = UNBOUNDED_AGENCY.test(text);
  const looksRagPoison = RAG_DOC_INSTRUCTION.test(text);
  const hasExfil = riskTypes.includes("DATA_EXFILTRATION") || riskTypes.includes("SSRF_ATTEMPT");
  const hasSensitive = riskTypes.includes("PII_DETECTED") || riskTypes.includes("INDIA_PII_DETECTED") || riskTypes.includes("SECRET_DETECTED");

  // Order matters: most-specialized surface first.
  if (looksDestructive || (looksToolCall && looksUnbounded)) {
    return {
      riskClass: "TOOL_ABUSE",
      severity: severity === "LOW" ? "HIGH" : severity,
      recommendedEndpoint: "/api/agent/tool/check",
      recommendedSdkMethod: "guard.toolCall()",
      safeNextAction:
        "This looks like a tool/function invocation with destructive or unbounded intent. Route it through the agent tool-check firewall (guard.toolCall) which enforces per-tool policy, not just text analysis.",
      generalGuardSufficient: false,
    };
  }

  if (looksUnbounded || (looksToolCall && /\b(?:agent|autonomous|goal|task|objective)\b/i.test(text))) {
    return {
      riskClass: "EXCESSIVE_AGENCY",
      severity: severity === "LOW" ? "MEDIUM" : severity,
      recommendedEndpoint: "/api/agent/action/check",
      recommendedSdkMethod: "guard.agentAction()",
      safeNextAction:
        "This resembles an autonomous agent action. Evaluate it with the agent action firewall (guard.agentAction) so escrow/approval and blast-radius limits apply.",
      generalGuardSufficient: false,
    };
  }

  if (looksRagPoison) {
    return {
      riskClass: "RAG_INDIRECT_INJECTION",
      severity: severity === "LOW" ? "HIGH" : severity,
      recommendedEndpoint: "/api/rag/document/trust-score",
      recommendedSdkMethod: "guard.rag()",
      safeNextAction:
        "This text contains instructions aimed at the AI reading it (indirect prompt injection typical of poisoned retrieved documents). Score retrieved chunks with the RAG document trust-score guard (guard.rag) before indexing or grounding on them.",
      generalGuardSufficient: false,
    };
  }

  if (hasExfil) {
    return {
      riskClass: "DATA_EXFILTRATION",
      severity: severity === "LOW" ? "HIGH" : severity,
      recommendedEndpoint: "/api/guard/output",
      recommendedSdkMethod: "guard.output()",
      safeNextAction:
        "This carries a data-exfiltration pattern. Also scan model OUTPUT (guard.output) so exfil payloads in generated responses are caught, not just the input.",
      generalGuardSufficient: false,
    };
  }

  if (hasSensitive) {
    return {
      riskClass: "SENSITIVE_DATA",
      severity: severity === "LOW" ? "MEDIUM" : severity,
      recommendedEndpoint: null,
      recommendedSdkMethod: "guard.output()",
      safeNextAction:
        "Sensitive data (PII/secret) was detected and handled here. Ensure you also guard model OUTPUT (guard.output) to prevent leaks on the way back.",
      generalGuardSufficient: true,
    };
  }

  if (riskTypes.some((t) => t === "PROMPT_INJECTION" || t === "JAILBREAK" || t === "SYSTEM_PROMPT_LEAK_ATTEMPT")) {
    return {
      riskClass: "PROMPT_ATTACK",
      severity,
      recommendedEndpoint: null,
      recommendedSdkMethod: null,
      safeNextAction: "A prompt-level attack was detected and handled by the general guard. No additional surface required.",
      generalGuardSufficient: true,
    };
  }

  return {
    riskClass: "NONE",
    severity: "LOW",
    recommendedEndpoint: null,
    recommendedSdkMethod: null,
    safeNextAction: "No agent/tool/RAG-specific risk detected. The general guard result is sufficient.",
    generalGuardSufficient: true,
  };
}

/** Attaches the advisory to an existing GuardResult's metadata (additive). */
export function withAdvisory(result: GuardResult, advisory: GuardAdvisory): GuardResult {
  return {
    ...result,
    metadata: { ...(result.metadata ?? {}), advisory },
  };
}
