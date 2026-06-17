export type GuardAction = "ALLOW" | "ALLOW_WITH_REDACTION" | "REWRITE" | "BLOCK" | "HUMAN_REVIEW";
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
  message: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
}

export interface GuardOutputRequest {
  aiResponse: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
}

export interface AnalyzeRequest {
  text: string;
  direction: "INPUT" | "OUTPUT";
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

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

export interface ProtectChatOptions {
  message: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
  callLLM: (safeMessage: string, context: { originalMessage: string; inputGuard: GuardResult }) => Promise<string>;
  blockedResponse?: string;
  outputBlockedResponse?: string;
}

export interface ProtectChatResult {
  allowed: boolean;
  blocked: boolean;
  inputAction: GuardAction;
  outputAction?: GuardAction;
  llmCalled: boolean;
  safeResponse: string;
  inputGuard: GuardResult;
  outputGuard?: GuardResult;
  latencyMs: number;
}

export interface RagSource {
  id?: string;
  text: string;
  metadata?: Record<string, MetadataValue>;
  citation?: string;
}

export interface SafeRagSource extends RagSource {
  safeText: string;
  guard: GuardResult;
}

export interface ProtectRagOptions<TSource extends RagSource = RagSource> {
  query: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
  retrieve: (safeQuery: string) => Promise<TSource[]>;
  callLLM: (input: { safeQuery: string; safeContext: string; sources: SafeRagSource[] }) => Promise<string>;
  blockedResponse?: string;
  outputBlockedResponse?: string;
}

export interface ProtectRagResult {
  allowed: boolean;
  blocked: boolean;
  inputAction: GuardAction;
  outputAction?: GuardAction;
  llmCalled: boolean;
  retrieved: number;
  usedSources: SafeRagSource[];
  excludedSources: Array<{ source: RagSource; guard: GuardResult }>;
  safeResponse: string;
  inputGuard: GuardResult;
  outputGuard?: GuardResult;
  latencyMs: number;
}

export interface ExpressLikeRequest {
  body?: {
    message?: unknown;
    userId?: unknown;
    sessionId?: unknown;
    metadata?: unknown;
  };
}

export interface ExpressLikeResponse {
  status(code: number): ExpressLikeResponse;
  json(body: unknown): unknown;
}

export type ExpressLikeNext = (error?: unknown) => unknown;
