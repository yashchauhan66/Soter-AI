import type { GuardAction, GuardDirection, RiskType } from "./types";

const sensitiveTypes: RiskType[] = ["PII_DETECTED", "INDIA_PII_DETECTED", "SECRET_DETECTED"];

export function decideGuardAction(riskScore: number, riskTypes: RiskType[], direction: GuardDirection, _text?: string): GuardAction {
  const has = (type: RiskType) => riskTypes.includes(type);

  if (has("RATE_LIMIT") || has("SYSTEM_PROMPT_LEAK_ATTEMPT") || has("SYSTEM_PROMPT_LEAKAGE")) return "BLOCK";
  if (has("SSRF_ATTEMPT")) return "BLOCK";
  if (has("MCP_TOOL_POISONING") || has("MEMORY_POISONING")) return "BLOCK";
  if (has("TOXICITY") && riskScore >= 45) return "BLOCK";
  if (has("TOXICITY")) return "HUMAN_REVIEW";
  // Data-exfiltration beacons (zero-click markdown/image/link channels) are hard
  // blocked on OUTPUT so a poisoned model response cannot leak context to an
  // external destination; on INPUT they are held for human review.
  if (has("DATA_EXFILTRATION")) return direction === "OUTPUT" ? "BLOCK" : "HUMAN_REVIEW";
  if (has("PROMPT_INJECTION") && has("JAILBREAK")) return "BLOCK";
  if (has("RECURSIVE_INJECTION") && has("PROMPT_INJECTION")) return "BLOCK";
  if (has("COMPETITIVE_INTEL_EXTRACTION") && riskScore >= 45) return "BLOCK";
  if (has("COMPETITIVE_INTEL_EXTRACTION")) return "HUMAN_REVIEW";
  if (riskScore >= 86) return "BLOCK";
  if (has("SECRET_DETECTED")) return direction === "OUTPUT" ? "BLOCK" : "HUMAN_REVIEW";
  if (has("UNSAFE_OUTPUT")) return "HUMAN_REVIEW";
  if (has("TOKEN_ABUSE")) return "HUMAN_REVIEW";
  if (has("BIAS_DETECTED")) return "HUMAN_REVIEW";
  if (has("HALLUCINATION")) return "HUMAN_REVIEW";
  if (has("RECURSIVE_INJECTION")) return "HUMAN_REVIEW";
  if (riskScore >= 61) return has("PROMPT_INJECTION") || has("JAILBREAK") ? "BLOCK" : "HUMAN_REVIEW";
  // PII in OUTPUT direction is blocked to prevent data leakage in model responses
  if (riskTypes.some((type) => sensitiveTypes.includes(type))) {
    if (direction === "OUTPUT" && (has("PII_DETECTED") || has("INDIA_PII_DETECTED"))) return "BLOCK";
    return "ALLOW_WITH_REDACTION";
  }
  if (riskScore >= 31) return "REWRITE";
  return "ALLOW";
}
