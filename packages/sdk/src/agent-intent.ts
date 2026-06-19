const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8000;

export type AgentIntentCategory =
  | "READ"
  | "SUMMARIZE"
  | "SEARCH"
  | "WRITE_DRAFT"
  | "SEND_MESSAGE"
  | "DELETE"
  | "MODIFY"
  | "PURCHASE"
  | "PAYMENT"
  | "LOGIN"
  | "EXPORT_DATA"
  | "CALL_EXTERNAL_API"
  | "RUN_CODE"
  | "INSTALL_PACKAGE"
  | "MEMORY_WRITE"
  | "UNKNOWN";

export type AgentIntentDecision = "ALLOW" | "BLOCK" | "ASK_APPROVAL" | "REVIEW";
export type AgentIntentRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AgentIntentClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export interface ExtractAgentIntentRequest {
  sessionId: string;
  userPrompt: string;
  allowedIntentCategories?: AgentIntentCategory[];
  forbiddenIntentCategories?: AgentIntentCategory[];
  metadata?: Record<string, unknown>;
}

export interface CheckIntentActionRequest {
  sessionId: string;
  intentRecordId?: string;
  tool: string;
  action: string;
  target?: string;
  actionDescription?: string;
  metadata?: Record<string, unknown>;
}

export interface ExtractedAgentIntent {
  primaryCategory: AgentIntentCategory;
  categories: AgentIntentCategory[];
  confidence: number;
  summary: string;
  signals: string[];
  injectionDetected: boolean;
}

export interface ExtractAgentIntentResponse {
  intentRecordId: string;
  projectId: string;
  sessionId: string;
  userPromptHash: string;
  userPromptRedacted: string;
  extractedIntent: ExtractedAgentIntent;
  allowedIntentCategories: AgentIntentCategory[];
  forbiddenIntentCategories: AgentIntentCategory[];
}

export interface CheckIntentActionResponse {
  actionCheckId: string;
  intentRecordId: string;
  sessionId: string;
  intentMatchScore: number;
  actionCategories: AgentIntentCategory[];
  decision: AgentIntentDecision;
  riskLevel: AgentIntentRiskLevel;
  reason: string;
  policyMatches: Array<{ id: string; label: string; severity: AgentIntentRiskLevel }>;
}

export function extractAgentIntent(options: AgentIntentClientOptions, input: ExtractAgentIntentRequest): Promise<ExtractAgentIntentResponse> {
  return post(options, "/api/intent/extract", input);
}

export function checkIntentAction(options: AgentIntentClientOptions, input: CheckIntentActionRequest): Promise<CheckIntentActionResponse> {
  return post(options, "/api/intent/action/check", input);
}

export function getIntentSession(options: AgentIntentClientOptions, sessionId: string) {
  return get(options, `/api/intent/session/${encodeURIComponent(sessionId)}`);
}

async function post<T = unknown>(options: AgentIntentClientOptions, path: string, body: unknown): Promise<T> {
  return requestJson<T>(options, path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    headers: { "Content-Type": "application/json" },
  });
}

async function get<T = unknown>(options: AgentIntentClientOptions, path: string): Promise<T> {
  return requestJson<T>(options, path, { method: "GET" });
}

async function requestJson<T>(options: AgentIntentClientOptions, path: string, init: RequestInit): Promise<T> {
  if (!options.apiKey) throw new Error("apiKey is required.");
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("Global fetch is not available. Pass options.fetch explicitly.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers = {
    ...(init.headers ?? {}),
    ...(options.headers ?? {}),
    "x-api-key": options.apiKey,
    "User-Agent": "cybersecurityguard-sdk/agent-intent",
  };

  let response: Response;
  try {
    response = await fetchImpl(`${(options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data && typeof data.message === "string"
      ? data.message
      : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return data as T;
}
