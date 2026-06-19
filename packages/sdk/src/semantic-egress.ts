const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8000;

export type SemanticSensitivityLevel = "PUBLIC" | "INTERNAL" | "PRIVATE" | "CONFIDENTIAL" | "SECRET" | "REGULATED" | "SYSTEM_PROMPT";
export type SemanticDestinationType = "FINAL_OUTPUT" | "PUBLIC_OUTPUT" | "EXTERNAL_API" | "EMAIL" | "BROWSER_FORM" | "WEBHOOK" | "TOOL" | "MEMORY" | "FILE" | "CUSTOM";
export type SemanticEgressDecision = "ALLOW" | "BLOCK" | "REDACT" | "ASK_APPROVAL" | "REVIEW";
export type SemanticEgressRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SemanticEgressClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export interface FingerprintSemanticSourceRequest {
  sourceId: string;
  sourceType: string;
  sensitivityLevel: SemanticSensitivityLevel;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface CheckSemanticEgressRequest {
  sessionId: string;
  sourceIds?: string[];
  destinationType: SemanticDestinationType;
  destinationName?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface CheckSemanticEgressResponse {
  checkId: string;
  sessionId: string;
  decision: SemanticEgressDecision;
  riskLevel: SemanticEgressRiskLevel;
  semanticRiskScore: number;
  reason: string;
  findings: unknown[];
  matchedSources: unknown[];
  contentRedacted: string;
}

export function fingerprintSemanticSource(options: SemanticEgressClientOptions, input: FingerprintSemanticSourceRequest) {
  return post(options, "/api/semantic-egress/source/fingerprint", input);
}

export function checkSemanticEgress(options: SemanticEgressClientOptions, input: CheckSemanticEgressRequest): Promise<CheckSemanticEgressResponse> {
  return post(options, "/api/semantic-egress/check", input);
}

export function listSemanticEgressChecks(options: SemanticEgressClientOptions) {
  return get(options, "/api/semantic-egress/checks");
}

async function post<T = unknown>(options: SemanticEgressClientOptions, path: string, body: unknown): Promise<T> {
  return requestJson<T>(options, path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    headers: { "Content-Type": "application/json" },
  });
}

async function get<T = unknown>(options: SemanticEgressClientOptions, path: string): Promise<T> {
  return requestJson<T>(options, path, { method: "GET" });
}

async function requestJson<T>(options: SemanticEgressClientOptions, path: string, init: RequestInit): Promise<T> {
  if (!options.apiKey) throw new Error("apiKey is required.");
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("Global fetch is not available. Pass options.fetch explicitly.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers = {
    ...(init.headers ?? {}),
    ...(options.headers ?? {}),
    "x-api-key": options.apiKey,
    "User-Agent": "cybersecurityguard-sdk/semantic-egress",
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
