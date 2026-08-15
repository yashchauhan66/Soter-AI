export const RISK_TYPES = [
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "SYSTEM_PROMPT_LEAKAGE",
  "CODE_INJECTION",
  "PII_DETECTED",
  "INDIA_PII_DETECTED",
  "SECRET_DETECTED",
  "UNSAFE_OUTPUT",
  "DATA_EXFILTRATION",
  "RATE_LIMIT",
  "TOKEN_ABUSE",
  "TOXICITY",
  "BIAS_DETECTED",
  "COMPETITIVE_INTEL_EXTRACTION",
  "RECURSIVE_INJECTION",
  "MCP_TOOL_POISONING",
  "MEMORY_POISONING",
  "SSRF_ATTEMPT",
  "HALLUCINATION",
  "MULTIMODAL_INJECTION",
  "MODEL_SUPPLY_CHAIN",
  "BEHAVIORAL_ANOMALY",
  "ADVANCED_SMUGGLING",
  "OFF_TOPIC",
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
  /**
   * Set by lib/guard/evidenceFusion.ts when this rule's MEASURED fire rate on
   * known-benign text is too high for it to carry an action on its own and no
   * independent rule family corroborated it. The finding is still reported and
   * still reaches the ledger — it simply does not contribute to `riskScore`,
   * `riskTypes`, redaction, or the decision floors.
   *
   * Not to be confused with `metadata.advisory` on GuardResult, which is the
   * unrelated endpoint-routing hint from lib/guard/routingAdvisory.ts.
   */
  advisoryOnly?: boolean;
  /** Why it was demoted, in plain language, for the audit trail. */
  advisoryReason?: string;
}

export interface GuardResult {
  allowed: boolean;
  action: GuardAction;
  riskScore: number;
  riskTypes: RiskType[];
  /**
   * Per-category confidence (0-1) for every category that fired. Lets a caller
   * distinguish a weak code-syntax overlap from an unambiguous injection, which
   * the single aggregate `riskScore` cannot express. Absent when nothing fired.
   */
  categoryConfidence?: Partial<Record<RiskType, number>>;
  /**
   * The category the verdict actually rests on, ranked by confidence x weight.
   * Callers previously read `riskTypes[0]`, which is detector registration
   * order — that is why SQL payloads surfaced as PROMPT_INJECTION.
   */
  primaryRiskType?: RiskType;
  originalText?: string;
  redactedText?: string;
  safeText?: string;
  reason: string;
  findings: GuardFinding[];
  metadata?: Record<string, unknown>;
}

export type Detector = (text: string) => GuardFinding[];
