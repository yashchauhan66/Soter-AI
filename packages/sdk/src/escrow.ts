const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8000;

export type EscrowRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EscrowActorType = "USER" | "ADMIN" | "SYSTEM";

export interface EscrowClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export interface CreateEscrowTransactionRequest {
  sessionId: string;
  agentIdentityId?: string;
  transactionType: string;
  tool: string;
  action: string;
  target?: string;
  originalPayload?: string;
  safePayload?: string;
  riskLevel?: EscrowRiskLevel;
  policyAllowsCriticalReview?: boolean;
  expiresAt?: string;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface ResolveEscrowRequest {
  escrowTransactionId?: string;
  approvalToken?: string;
  reason?: string;
  actorType?: EscrowActorType;
  metadata?: Record<string, unknown>;
}

export interface EditAndApproveEscrowRequest extends ResolveEscrowRequest {
  editedPayload: string;
}

export interface ExecuteEscrowRequest {
  escrowTransactionId?: string;
  approvalToken?: string;
  metadata?: Record<string, unknown>;
}

export function createEscrowTransaction(options: EscrowClientOptions, input: CreateEscrowTransactionRequest) {
  return post(options, "/api/escrow/create", input);
}

export function approveEscrowTransaction(options: EscrowClientOptions, input: ResolveEscrowRequest) {
  return post(options, "/api/escrow/approve", input);
}

export function denyEscrowTransaction(options: EscrowClientOptions, input: ResolveEscrowRequest) {
  return post(options, "/api/escrow/deny", input);
}

export function editAndApproveEscrow(options: EscrowClientOptions, input: EditAndApproveEscrowRequest) {
  return post(options, "/api/escrow/edit-and-approve", input);
}

export function executeEscrowTransaction(options: EscrowClientOptions, input: ExecuteEscrowRequest) {
  return post(options, "/api/escrow/execute", input);
}

export function getEscrowTransaction(options: EscrowClientOptions, escrowTransactionId: string) {
  return get(options, `/api/escrow/${encodeURIComponent(escrowTransactionId)}`);
}

export function listPendingEscrowTransactions(options: EscrowClientOptions) {
  return get(options, "/api/escrow/pending");
}

async function post<T = unknown>(options: EscrowClientOptions, path: string, body: unknown): Promise<T> {
  return requestJson<T>(options, path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    headers: { "Content-Type": "application/json" },
  });
}

async function get<T = unknown>(options: EscrowClientOptions, path: string): Promise<T> {
  return requestJson<T>(options, path, { method: "GET" });
}

async function requestJson<T>(options: EscrowClientOptions, path: string, init: RequestInit): Promise<T> {
  if (!options.apiKey) throw new Error("apiKey is required.");
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("Global fetch is not available. Pass options.fetch explicitly.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers = {
    ...(init.headers ?? {}),
    ...(options.headers ?? {}),
    "x-api-key": options.apiKey,
    "User-Agent": "cybersecurityguard-sdk/escrow",
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
