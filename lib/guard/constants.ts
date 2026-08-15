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

// ── Per-minute limits ────────────────────────────────────────────────────────
// The monthly meter is the authoritative spend control; the per-minute limit
// exists only to bound abuse and protect the service from a runaway client. It
// therefore has to sit well ABOVE the sustained rate a plan actually sells,
// otherwise the RPM silently becomes the real quota.
//
// A flat 60 RPM did exactly that: ENTERPRISE sells 5,000,000 calls/month, which
// is ~116 req/min sustained, so 60 RPM capped the plan at 2,592,000/month — the
// customer could not physically consume what they paid for. Batch clients hurt
// worse: n8n / Make / Zapier iterate items in a loop, so a 100-item workflow
// fires 100 calls in seconds and everything past item 60 got a 429 that looked
// like a false block.
export const FREE_PLAN_RPM = positiveInteger("FREE_PLAN_RPM", 60, 100_000);
export const STARTER_RPM = positiveInteger("STARTER_RPM", 120, 100_000);
export const PRO_RPM = positiveInteger("PRO_RPM", 300, 100_000);
export const AGENCY_RPM = positiveInteger("AGENCY_RPM", 600, 100_000);
export const ENTERPRISE_RPM = positiveInteger("ENTERPRISE_RPM", 3_000, 100_000);

export const RISK_WEIGHTS: Record<Exclude<RiskType, "LOW_RISK">, number> = {
  PROMPT_INJECTION: 40,
  JAILBREAK: 35,
  SYSTEM_PROMPT_LEAK_ATTEMPT: 45,
  SYSTEM_PROMPT_LEAKAGE: 60,
  // Classic application-security injection syntax (SQL / XSS / shell) sitting in
  // a prompt. Deliberately BELOW PROMPT_INJECTION (40): a payload like
  // `' OR 1=1--` is an attack on a downstream database, not on the model, and it
  // is a weak signal that the sender is attacking the *LLM*. It was previously
  // reported as PROMPT_INJECTION, which both mislabelled it and over-scored it.
  // Note this is the floor, not the ceiling — a destructive command in a tool
  // context still carries its own declared finding score (see scoreRisk, which
  // takes the max of the type sum and the highest declared score), so
  // reclassifying does not silently downgrade a genuine destructive request.
  CODE_INJECTION: 20,
  PII_DETECTED: 25,
  INDIA_PII_DETECTED: 30,
  SECRET_DETECTED: 70,
  UNSAFE_OUTPUT: 40,
  DATA_EXFILTRATION: 60,
  RATE_LIMIT: 30,
  TOKEN_ABUSE: 30,
  TOXICITY: 50,
  BIAS_DETECTED: 35,
  COMPETITIVE_INTEL_EXTRACTION: 45,
  RECURSIVE_INJECTION: 45,
  MCP_TOOL_POISONING: 65,
  MEMORY_POISONING: 60,
  SSRF_ATTEMPT: 55,
  HALLUCINATION: 30,
  MULTIMODAL_INJECTION: 50,
  MODEL_SUPPLY_CHAIN: 55,
  BEHAVIORAL_ANOMALY: 45,
  ADVANCED_SMUGGLING: 40,
  // Off-topic is a *product* signal, not a security one: a message that has
  // nothing to do with the tenant's declared subject matter is usually a user
  // wandering, occasionally a probe. At 15 it can never on its own reach the
  // REWRITE band (31), so an off-topic message is reported, not acted on,
  // unless something genuinely adversarial also fired.
  OFF_TOPIC: 15,
};
