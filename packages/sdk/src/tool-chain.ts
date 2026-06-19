const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8000;

export type ToolChainSourceType =
  | "PUBLIC_DATA"
  | "PRIVATE_DATA"
  | "RAG_DOCUMENT"
  | "RAG_CONFIDENTIAL"
  | "MEMORY"
  | "FILE"
  | "TERMINAL"
  | "BROWSER_PAGE"
  | "BROWSER_PAGE_UNTRUSTED"
  | "MCP_TOOL"
  | "MCP_TOOL_CHANGED"
  | "SYSTEM_PROMPT"
  | "SECRET"
  | "UNKNOWN";

export type ToolChainDestinationType =
  | "INTERNAL"
  | "FINAL_OUTPUT"
  | "EXTERNAL_EMAIL"
  | "EMAIL_SEND"
  | "EXTERNAL_API"
  | "EXTERNAL_POST"
  | "UNKNOWN_TOOL"
  | "TOOL_CALL"
  | "NETWORK_POST"
  | "MEMORY"
  | "FILE"
  | "DATABASE"
  | "NONE"
  | "UNKNOWN";

export type ToolChainDataSensitivity = "PUBLIC" | "INTERNAL" | "PRIVATE" | "CONFIDENTIAL" | "SECRET" | "SYSTEM_PROMPT" | "REGULATED" | "UNKNOWN";
export type ToolChainDecision = "ALLOW" | "BLOCK" | "ASK_APPROVAL" | "REVIEW";
export type ToolChainRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ToolChainClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export interface StartToolChainSessionRequest {
  sessionId?: string;
  agentIdentityId?: string;
  metadata?: Record<string, unknown>;
}

export interface CheckToolChainStepRequest {
  sessionId: string;
  tool: string;
  action: string;
  sourceType?: ToolChainSourceType;
  destinationType?: ToolChainDestinationType;
  dataSensitivity?: ToolChainDataSensitivity;
  metadata?: Record<string, unknown>;
}

export interface ToolChainFinding {
  findingType: string;
  riskLevel: ToolChainRiskLevel;
  summary: string;
  involvedSteps: number[];
  recommendation: string;
}

export interface CheckToolChainStepResponse {
  stepId: string;
  sessionId: string;
  decision: ToolChainDecision;
  riskLevel: ToolChainRiskLevel;
  reason: string;
  findings: ToolChainFinding[];
  findingIds: string[];
}

export function startToolChainSession(options: ToolChainClientOptions, input: StartToolChainSessionRequest = {}) {
  return post(options, "/api/tool-chain/session/start", input);
}

export function checkToolChainStep(options: ToolChainClientOptions, input: CheckToolChainStepRequest): Promise<CheckToolChainStepResponse> {
  return post(options, "/api/tool-chain/step/check", input);
}

export function getToolChainSession(options: ToolChainClientOptions, sessionId: string) {
  return get(options, `/api/tool-chain/session/${encodeURIComponent(sessionId)}`);
}

export function getToolChainFindings(options: ToolChainClientOptions, sessionId?: string) {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  return get(options, `/api/tool-chain/findings${query}`);
}

async function post<T = unknown>(options: ToolChainClientOptions, path: string, body: unknown): Promise<T> {
  return requestJson<T>(options, path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    headers: { "Content-Type": "application/json" },
  });
}

async function get<T = unknown>(options: ToolChainClientOptions, path: string): Promise<T> {
  return requestJson<T>(options, path, { method: "GET" });
}

async function requestJson<T>(options: ToolChainClientOptions, path: string, init: RequestInit): Promise<T> {
  if (!options.apiKey) throw new Error("apiKey is required.");
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("Global fetch is not available. Pass options.fetch explicitly.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers = {
    ...(init.headers ?? {}),
    ...(options.headers ?? {}),
    "x-api-key": options.apiKey,
    "User-Agent": "cybersecurityguard-sdk/tool-chain",
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
