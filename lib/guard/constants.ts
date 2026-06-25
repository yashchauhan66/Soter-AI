import type { RiskType } from "./types";

function positiveInteger(name: string, fallback: number, maximum: number) {
  const parsed = Number(process.env[name] ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

export const MAX_TEXT_LENGTH = positiveInteger("MAX_GUARD_TEXT_LENGTH", 8000, 100_000);
export const DEFAULT_RPM = positiveInteger("DEFAULT_RPM", 60, 100_000);
export const PUBLIC_ANALYZE_RPM = positiveInteger("PUBLIC_ANALYZE_RPM", 20, 10_000);
export const FREE_PLAN_LIMIT_PER_MONTH = positiveInteger("FREE_PLAN_LIMIT_PER_MONTH", 1000, 100_000_000);
export const STARTER_LIMIT_PER_MONTH = positiveInteger("STARTER_LIMIT_PER_MONTH", 10_000, 100_000_000);
export const PRO_LIMIT_PER_MONTH = positiveInteger("PRO_LIMIT_PER_MONTH", 50_000, 100_000_000);
export const AGENCY_LIMIT_PER_MONTH = positiveInteger("AGENCY_LIMIT_PER_MONTH", 250_000, 100_000_000);
export const ENTERPRISE_LIMIT_PER_MONTH = positiveInteger("ENTERPRISE_LIMIT_PER_MONTH", 5_000_000, 1_000_000_000);
export const USAGE_WARNING_THRESHOLD = 0.8;

export const RISK_WEIGHTS: Record<Exclude<RiskType, "LOW_RISK">, number> = {
  PROMPT_INJECTION: 40,
  JAILBREAK: 35,
  SYSTEM_PROMPT_LEAK_ATTEMPT: 45,
  SYSTEM_PROMPT_LEAKAGE: 60,
  PII_DETECTED: 25,
  INDIA_PII_DETECTED: 30,
  SECRET_DETECTED: 70,
  UNSAFE_OUTPUT: 40,
  RATE_LIMIT: 30,
  TOKEN_ABUSE: 30,
};
