export type GuardAction = "ALLOW" | "ALLOW_WITH_REDACTION" | "REWRITE" | "BLOCK" | "HUMAN_REVIEW";

/**
 * Normalized, integration-friendly decision derived from the server `action`.
 * `ALLOW_WITH_REDACTION` and `REWRITE` both collapse to `REDACT` because both
 * produce a `safeText`/`redactedText` the caller should forward instead of the
 * original text.
 */
export type GuardDecision = "ALLOW" | "REDACT" | "BLOCK" | "HUMAN_REVIEW";

export type GuardDirection = "INPUT" | "OUTPUT" | "ANALYZE";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RiskType =
  | "PROMPT_INJECTION"
  | "JAILBREAK"
  | "SYSTEM_PROMPT_LEAK_ATTEMPT"
  | "SYSTEM_PROMPT_LEAKAGE"
  | "PII_DETECTED"
  | "INDIA_PII_DETECTED"
  | "SECRET_DETECTED"
  | "UNSAFE_OUTPUT"
  | "RATE_LIMIT"
  | "TOKEN_ABUSE"
  | "LOW_RISK";

/** Alias kept for parity with the Python SDK / docs naming. */
export type GuardRiskType = RiskType;

export interface GuardFinding {
  type: RiskType;
  label: string;
  severity: Severity;
  score: number;
  message: string;
  matched?: string;
}

export interface GuardResult {
  allowed: boolean;
  action: GuardAction;
  /** Normalized decision derived from `action`. Populated by the SDK. */
  decision?: GuardDecision;
  riskScore: number;
  riskTypes: RiskType[];
  reason: string;
  redactedText?: string;
  safeText?: string;
  findings: GuardFinding[];
  metadata?: Record<string, unknown>;
}

export type MetadataValue = string | number | boolean | null;

export interface GuardInputRequest {
  /** Primary text to inspect. Alias of `message`; one of the two is required. */
  text?: string;
  /** Native API field. Alias of `text`; one of the two is required. */
  message?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
}

export interface GuardOutputRequest {
  /** Primary text to inspect. Alias of `aiResponse`; one of the two is required. */
  text?: string;
  /** Native API field. Alias of `text`; one of the two is required. */
  aiResponse?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
}

export interface AnalyzeRequest {
  text: string;
  direction: "INPUT" | "OUTPUT";
  metadata?: Record<string, MetadataValue>;
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Optional project identifier, forwarded as request metadata. */
  projectId?: string;
  timeoutMs?: number;
  /** Number of retry attempts for transient (5xx / network) failures. Default 0. */
  retries?: number;
  /**
   * When true, the SDK logs redacted diagnostics. The API key and raw text are
   * NEVER logged regardless of this flag.
   */
  debug?: boolean;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

/** Friendlier alias used throughout the docs and examples. */
export type CyberRakshakConfig = ClientOptions;

export interface SecureChatOptions {
  message: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
  callLLM: (input: { safeInput: string; original: string; inputResult: GuardResult }) => Promise<string>;
  blockedResponse?: string;
}

export interface SecureChatResult {
  reply: string;
  blocked: boolean;
  inputResult: GuardResult;
  outputResult?: GuardResult;
}

/** Options for the combined {@link conversation-style} helper. */
export interface GuardConversationOptions {
  input: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
  callLLM: (safeInput: string) => Promise<string>;
  blockedResponse?: string;
}
