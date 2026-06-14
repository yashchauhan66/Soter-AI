export const RISK_TYPES = [
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "SYSTEM_PROMPT_LEAKAGE",
  "PII_DETECTED",
  "INDIA_PII_DETECTED",
  "SECRET_DETECTED",
  "UNSAFE_OUTPUT",
  "RATE_LIMIT",
  "TOKEN_ABUSE",
  "LOW_RISK",
] as const;

export type RiskType = (typeof RISK_TYPES)[number];
export type GuardAction = "ALLOW" | "ALLOW_WITH_REDACTION" | "REWRITE" | "BLOCK" | "HUMAN_REVIEW";
export type GuardDirection = "INPUT" | "OUTPUT" | "ANALYZE";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface GuardFinding {
  type: RiskType;
  label: string;
  severity: Severity;
  score: number;
  matched?: string;
  message: string;
  start?: number;
  end?: number;
  redactionToken?: string;
}

export interface GuardResult {
  allowed: boolean;
  action: GuardAction;
  riskScore: number;
  riskTypes: RiskType[];
  originalText?: string;
  redactedText?: string;
  safeText?: string;
  reason: string;
  findings: GuardFinding[];
  metadata?: Record<string, unknown>;
}

export type Detector = (text: string) => GuardFinding[];
