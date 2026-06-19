const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8000;

export type AgentDryRunType =
  | "EMAIL"
  | "FORM_SUBMIT"
  | "TERMINAL"
  | "FILE_WRITE"
  | "FILE_DELETE"
  | "API_CALL"
  | "PAYMENT"
  | "PACKAGE_INSTALL"
  | "DATABASE_WRITE"
  | "CUSTOM";

export type AgentDryRunDecision = "SAFE_TO_EXECUTE" | "REQUIRE_APPROVAL" | "BLOCK" | "REVIEW";
export type AgentDryRunRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface DryRunClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export interface SimulateAgentActionRequest {
  sessionId: string;
  agentIdentityId?: string;
  dryRunType: AgentDryRunType;
  tool: string;
  action: string;
  target?: string;
  simulatedPayload?: string;
  metadata?: Record<string, unknown>;
}

export interface SimulateAgentActionResponse {
  dryRunId: string;
  sessionId: string;
  decision: AgentDryRunDecision;
  riskLevel: AgentDryRunRiskLevel;
  reason: string;
  findings: string[];
  simulatedPayloadRedacted: string | null;
  simulatedEffects: Record<string, unknown>;
}

export function simulateAgentAction(options: DryRunClientOptions, input: SimulateAgentActionRequest): Promise<SimulateAgentActionResponse> {
  return post(options, "/api/dry-run/simulate", input);
}

export function getDryRun(options: DryRunClientOptions, dryRunId: string) {
  return get(options, `/api/dry-run/${encodeURIComponent(dryRunId)}`);
}

export function getDryRunSession(options: DryRunClientOptions, sessionId: string) {
  return get(options, `/api/dry-run/session/${encodeURIComponent(sessionId)}`);
}

async function post<T = unknown>(options: DryRunClientOptions, path: string, body: unknown): Promise<T> {
  return requestJson<T>(options, path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    headers: { "Content-Type": "application/json" },
  });
}

async function get<T = unknown>(options: DryRunClientOptions, path: string): Promise<T> {
  return requestJson<T>(options, path, { method: "GET" });
}

async function requestJson<T>(options: DryRunClientOptions, path: string, init: RequestInit): Promise<T> {
  if (!options.apiKey) throw new Error("apiKey is required.");
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("Global fetch is not available. Pass options.fetch explicitly.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers = {
    ...(init.headers ?? {}),
    ...(options.headers ?? {}),
    "x-api-key": options.apiKey,
    "User-Agent": "cybersecurityguard-sdk/dry-run",
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
