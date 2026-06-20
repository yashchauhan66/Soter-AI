const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8000;

export type ComplianceEvidenceType =
  | "POLICY"
  | "GUARD_DECISION"
  | "REDACTION"
  | "APPROVAL"
  | "INCIDENT"
  | "RAG_SCAN"
  | "AGENT_PASSPORT"
  | "TOOL_CHAIN"
  | "CANARY"
  | "RED_TEAM"
  | "DATA_FLOW"
  | "COST_CONTROL"
  | "CUSTOM";

export type ComplianceEvidenceStatus = "ACTIVE" | "PASS" | "FAIL" | "WARNING" | "RESOLVED";
export type ComplianceEvidenceReportType = "SECURITY_POSTURE" | "INCIDENT_SUMMARY" | "CUSTOMER_TRUST" | "AUDIT_EXPORT" | "AI_RISK_REVIEW";
export type ComplianceRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface EvidenceVaultClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export interface CollectComplianceEvidenceRequest {
  evidenceType?: ComplianceEvidenceType;
  title?: string;
  summary?: string;
  riskLevel?: ComplianceRiskLevel;
  controlName?: string;
  status?: ComplianceEvidenceStatus;
  evidence?: Record<string, unknown>;
  autoCollect?: boolean;
  include?: ComplianceEvidenceType[];
}

export interface GenerateEvidenceReportRequest {
  reportName: string;
  reportType?: ComplianceEvidenceReportType;
  evidenceIds?: string[];
  includeTypes?: ComplianceEvidenceType[];
}

export function collectComplianceEvidence(options: EvidenceVaultClientOptions, input: CollectComplianceEvidenceRequest) {
  return post(options, "/api/evidence/collect", input);
}

export function listComplianceEvidenceItems(options: EvidenceVaultClientOptions) {
  return get(options, "/api/evidence/items");
}

export function generateEvidenceReport(options: EvidenceVaultClientOptions, input: GenerateEvidenceReportRequest) {
  return post(options, "/api/evidence/report/generate", input);
}

export function listEvidenceReports(options: EvidenceVaultClientOptions) {
  return get(options, "/api/evidence/reports");
}

export function getEvidenceReport(options: EvidenceVaultClientOptions, reportId: string) {
  return get(options, `/api/evidence/reports/${encodeURIComponent(reportId)}`);
}

export function exportEvidenceReport(options: EvidenceVaultClientOptions, reportId: string) {
  return post(options, `/api/evidence/reports/${encodeURIComponent(reportId)}/export`, {});
}

async function post<T = unknown>(options: EvidenceVaultClientOptions, path: string, body: unknown): Promise<T> {
  return requestJson<T>(options, path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    headers: { "Content-Type": "application/json" },
  });
}

async function get<T = unknown>(options: EvidenceVaultClientOptions, path: string): Promise<T> {
  return requestJson<T>(options, path, { method: "GET" });
}

async function requestJson<T>(options: EvidenceVaultClientOptions, path: string, init: RequestInit): Promise<T> {
  if (!options.apiKey) throw new Error("apiKey is required.");
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("Global fetch is not available. Pass options.fetch explicitly.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers = {
    ...(init.headers ?? {}),
    ...(options.headers ?? {}),
    "x-api-key": options.apiKey,
    "User-Agent": "cybersecurityguard-sdk/evidence-vault",
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
