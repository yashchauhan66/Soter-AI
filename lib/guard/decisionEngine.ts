import type { GuardAction, GuardDirection, RiskType } from "./types";

const sensitiveTypes: RiskType[] = ["PII_DETECTED", "INDIA_PII_DETECTED", "SECRET_DETECTED"];

export function decideGuardAction(riskScore: number, riskTypes: RiskType[], direction: GuardDirection): GuardAction {
  const has = (type: RiskType) => riskTypes.includes(type);
  if (has("RATE_LIMIT") || has("SYSTEM_PROMPT_LEAK_ATTEMPT") || has("SYSTEM_PROMPT_LEAKAGE")) return "BLOCK";
  if (has("PROMPT_INJECTION") && has("JAILBREAK")) return "BLOCK";
  if (riskScore >= 86) return "BLOCK";
  if (has("SECRET_DETECTED")) return direction === "OUTPUT" ? "BLOCK" : "HUMAN_REVIEW";
  if (riskScore >= 61) return has("PROMPT_INJECTION") || has("JAILBREAK") ? "BLOCK" : "HUMAN_REVIEW";
  if (riskTypes.some((type) => sensitiveTypes.includes(type))) return "ALLOW_WITH_REDACTION";
  if (riskScore >= 31) return "REWRITE";
  return "ALLOW";
}
