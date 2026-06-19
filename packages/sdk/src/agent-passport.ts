const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8000;

export type AgentIdentityType =
  | "CHATBOT"
  | "RAG_AGENT"
  | "COMPUTER_USE"
  | "BROWSER_AGENT"
  | "MCP_AGENT"
  | "CODING_AGENT"
  | "CUSTOM";

export type AgentIdentityStatus = "ACTIVE" | "DISABLED" | "QUARANTINED";
export type AgentPassportDecision = "ALLOW" | "BLOCK" | "ASK_APPROVAL";
export type AgentPassportRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AgentPassportClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export interface AgentPassportPolicyInput {
  allowedTools?: string[];
  blockedTools?: string[];
  approvalRequiredTools?: string[];
  allowedDomains?: string[];
  blockedDomains?: string[];
  dataScopes?: string[];
  memoryScopes?: string[];
}

export interface CreateAgentIdentityRequest {
  name: string;
  agentType?: AgentIdentityType;
  description?: string;
  status?: AgentIdentityStatus;
  defaultPolicy?: AgentPassportPolicyInput;
}

export interface IssueAgentPassportRequest extends AgentPassportPolicyInput {
  agentIdentityId: string;
  sessionId?: string;
  ttlSeconds?: number;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ValidateAgentPassportRequest {
  sessionId: string;
  passportToken?: string;
  tool?: string;
  action?: string;
  target?: string;
  domain?: string;
  metadata?: Record<string, unknown>;
}

export interface RevokeAgentPassportRequest {
  sessionId?: string;
  passportId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentPassportValidationResponse {
  decision: AgentPassportDecision;
  riskLevel: AgentPassportRiskLevel;
  reason: string;
  policyMatches: Array<{ id: string; label: string; severity: AgentPassportRiskLevel }>;
  passportId?: string;
  agentIdentityId?: string;
  sessionId?: string;
  expiresAt?: string;
}

export function createAgentIdentity(options: AgentPassportClientOptions, input: CreateAgentIdentityRequest) {
  return post(options, "/api/agent/identity/create", input);
}

export function issueAgentPassport(options: AgentPassportClientOptions, input: IssueAgentPassportRequest) {
  return post(options, "/api/agent/passport/issue", input);
}

export function validateAgentPassport(options: AgentPassportClientOptions, input: ValidateAgentPassportRequest): Promise<AgentPassportValidationResponse> {
  return post(options, "/api/agent/passport/validate", input);
}

export function revokeAgentPassport(options: AgentPassportClientOptions, input: RevokeAgentPassportRequest) {
  return post(options, "/api/agent/passport/revoke", input);
}

export function getAgentPassport(options: AgentPassportClientOptions, sessionId: string) {
  return get(options, `/api/agent/passport/${encodeURIComponent(sessionId)}`);
}

async function post<T = unknown>(options: AgentPassportClientOptions, path: string, body: unknown): Promise<T> {
  return requestJson<T>(options, path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    headers: { "Content-Type": "application/json" },
  });
}

async function get<T = unknown>(options: AgentPassportClientOptions, path: string): Promise<T> {
  return requestJson<T>(options, path, { method: "GET" });
}

async function requestJson<T>(options: AgentPassportClientOptions, path: string, init: RequestInit): Promise<T> {
  if (!options.apiKey) throw new Error("apiKey is required.");
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("Global fetch is not available. Pass options.fetch explicitly.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers = {
    ...(init.headers ?? {}),
    ...(options.headers ?? {}),
    "x-api-key": options.apiKey,
    "User-Agent": "cybersecurityguard-sdk/agent-passport",
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
