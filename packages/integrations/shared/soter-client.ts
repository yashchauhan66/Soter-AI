/**
 * Shared Soter API client for all integration nodes/plugins/connectors.
 *
 * This is a thin HTTP wrapper that calls the existing Soter REST API.
 * It does NOT duplicate any detection logic — all security analysis
 * happens server-side via the existing guard engine.
 *
 * SECURITY:
 * - API keys are never logged or exposed in error messages.
 * - Raw user text is never logged by the client.
 * - All inputs are validated before making network calls.
 */

import {
  SoterIntegrationError,
  SoterAuthError,
  SoterRateLimitError,
  SoterNetworkError,
} from "./errors";
import type {
  SoterClientOptions,
  CheckInput,
  CheckOutput,
  RedactPiiInput,
  ScanRagInput,
  CreateIncidentInput,
  GuardCheckResult,
  RedactPiiResult,
  ScanRagResult,
  CreateIncidentResult,
  DetectedEntity,
  RagIssue,
  OnThreat,
  Metadata,
} from "./types";
import {
  assertNonEmptyText,
  assertApiKey,
  normalizePolicyMode,
  normalizeMetadata,
  normalizeRedactionMode,
  maskApiKey,
} from "./validators";

const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRY_BACKOFF_MS = 250;
const DEFAULT_MAX_RETRIES = 1;
const USER_AGENT = "soter-integration/1.0";

export class SoterClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly projectId?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBackoffMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly extraHeaders: Record<string, string>;
  private readonly debug: boolean;

  constructor(options: SoterClientOptions) {
    this.apiKey = assertApiKey(options.apiKey);
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.projectId = options.projectId;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBackoffMs = options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.extraHeaders = options.headers ?? {};
    this.debug = options.debug ?? false;

    if (!this.fetchImpl) {
      throw new SoterIntegrationError(
        "Global fetch is not available. Pass options.fetch explicitly.",
        { code: "config_error" },
      );
    }
  }

  async checkInput(input: CheckInput): Promise<GuardCheckResult> {
    const text = assertNonEmptyText(input.text, "input text");
    const metadata = this.buildMetadata(input.projectId, input.policyMode, input.metadata);

    const raw = await this.post<RawGuardResult>("/api/guard/input", {
      message: text,
      userId: input.userId,
      sessionId: input.sessionId,
      metadata,
    });

    return toGuardCheckResult(raw);
  }

  async checkOutput(input: CheckOutput): Promise<GuardCheckResult> {
    const text = assertNonEmptyText(input.text, "output text");
    const metadata = this.buildMetadata(input.projectId, input.policyMode, input.metadata);

    const raw = await this.post<RawGuardResult>("/api/guard/output", {
      aiResponse: text,
      sessionId: input.sessionId,
      metadata,
    });

    return toGuardCheckResult(raw);
  }

  async redactPii(input: RedactPiiInput): Promise<RedactPiiResult> {
    const text = assertNonEmptyText(input.text, "text");
    const redactionMode = normalizeRedactionMode(input.redactionMode);
    const metadata = this.buildMetadata(input.projectId, undefined, input.metadata);

    const raw = await this.post<RawGuardResult>("/api/guard/input", {
      message: text,
      metadata: { ...metadata, _redactionMode: redactionMode },
    });

    return toRedactPiiResult(raw);
  }

  async scanRagDocument(input: ScanRagInput): Promise<ScanRagResult> {
    const text = input.text ?? (input.chunks ? input.chunks.join("\n\n") : undefined);
    assertNonEmptyText(text, "document text or chunks");

    if (input.documentId) {
      try {
        const raw = await this.post<RawRagTrustResult>("/api/rag/document/trust-score", {
          projectId: input.projectId ?? this.projectId,
          documentId: input.documentId,
          content: text,
          source: input.source ?? "unknown",
          metadata: input.metadata,
        });
        return toScanRagResult(raw, text!);
      } catch (e) {
        this.log("RAG trust-score endpoint unavailable, falling back to guard/input");
      }
    }

    const extra: Record<string, string | number | boolean | null> = {
      ...input.metadata,
      _ragScan: true,
    };
    if (input.sourceName) extra._sourceName = input.sourceName;
    const metadata = this.buildMetadata(input.projectId, undefined, extra);

    const raw = await this.post<RawGuardResult>("/api/guard/input", {
      message: text,
      metadata,
    });

    return toScanRagResultFromGuard(raw);
  }

  /**
   * Attempt to create an incident record via the ops API.
   *
   * NOTE: The `/api/ops/incidents` endpoint requires admin session auth,
   * not API-key auth. When called with an API key (the typical integration
   * path), it will 401 and the catch block returns a graceful no-op result.
   * Guard results are already persisted server-side by the guard endpoints,
   * so explicit incident creation is only needed for custom admin workflows.
   */
  async createIncident(input: CreateIncidentInput): Promise<CreateIncidentResult> {
    const metadata: Metadata = {
      platform: input.platform,
      ...(input.workflowId ? { workflowId: input.workflowId } : {}),
      ...(input.riskScore != null ? { riskScore: input.riskScore } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      ...input.metadata,
    };

    try {
      const raw = await this.post<{ id?: string; incidentId?: string }>("/api/ops/incidents", {
        platform: input.platform,
        workflowId: input.workflowId,
        riskScore: input.riskScore,
        reason: input.reason,
        metadata,
      });
      return {
        incidentId: raw.incidentId ?? raw.id,
        dashboardUrl: raw.incidentId ? `${this.baseUrl}/dashboard/incidents/${raw.incidentId}` : undefined,
        rawResponse: raw,
      };
    } catch {
      return {
        incidentId: undefined,
        dashboardUrl: undefined,
        rawResponse: { note: "Incident logging endpoint not available. Result stored via guard API metadata." },
      };
    }
  }

  private buildMetadata(
    projectId?: string,
    policyMode?: unknown,
    extra?: Metadata,
  ): Metadata {
    const result: Metadata = {};
    const pid = projectId ?? this.projectId;
    if (pid) result.projectId = pid;
    const mode = policyMode != null ? normalizePolicyMode(policyMode) : undefined;
    if (mode) result.policyMode = mode;
    const normalized = normalizeMetadata(extra);
    if (normalized) Object.assign(result, normalized);
    return result;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      "x-api-key": this.apiKey,
      ...this.extraHeaders,
    };

    this.log(`POST ${path}`);

    try {
      const response = await this.fetchWithRetry(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });
      return await this.handleResponse<T>(response);
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let attempt = 0;
    for (;;) {
      try {
        return await this.fetchImpl(url, init);
      } catch (caught) {
        const isAbort = caught instanceof Error && caught.name === "AbortError";
        if (attempt >= this.maxRetries) {
          throw new SoterNetworkError(
            isAbort
              ? `Request timed out after ${this.timeoutMs}ms.`
              : caught instanceof Error
                ? caught.message
                : "Network request failed.",
            caught,
          );
        }
        attempt += 1;
        await delay(this.retryBackoffMs * attempt);
      }
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new SoterIntegrationError("Server returned non-JSON response.", {
          status: response.status,
        });
      }
    }

    if (!response.ok) {
      const message = extractMessage(data) ?? `Request failed with status ${response.status}.`;
      if (response.status === 401 || response.status === 403) {
        throw new SoterAuthError(message, response.status);
      }
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 0) || undefined;
        throw new SoterRateLimitError(message, response.status, retryAfter);
      }
      throw new SoterIntegrationError(message, { status: response.status, details: data });
    }

    return data as T;
  }

  private log(message: string): void {
    if (!this.debug) return;
    console.debug(`[soter-integration] ${message}`);
  }
}

// ── Raw API response shapes (internal) ──────────────────────────────────

interface RawGuardFinding {
  type?: string;
  label?: string;
  severity?: string;
  score?: number;
  message?: string;
  matched?: string;
}

interface RawGuardResult {
  allowed?: boolean;
  action?: string;
  riskScore?: number;
  riskTypes?: string[];
  reason?: string;
  safeText?: string;
  redactedText?: string;
  findings?: RawGuardFinding[];
  metadata?: Record<string, unknown>;
  incidentId?: string;
}

interface RawRagTrustResult {
  trustScore?: number;
  trustLevel?: string;
  findings?: RawGuardFinding[];
  recommendedAction?: string;
}

// ── Normalizers ─────────────────────────────────────────────────────────

function toGuardCheckResult(raw: RawGuardResult): GuardCheckResult {
  return {
    allowed: raw.allowed ?? true,
    riskScore: raw.riskScore ?? 0,
    categories: raw.riskTypes ?? [],
    safeText: raw.safeText ?? raw.redactedText,
    reason: raw.reason ?? "",
    incidentId: raw.incidentId ?? (raw.metadata?.incidentId as string | undefined),
    rawResponse: raw,
  };
}

function toRedactPiiResult(raw: RawGuardResult): RedactPiiResult {
  const entities: DetectedEntity[] = (raw.findings ?? [])
    .filter((f) => f.type === "PII_DETECTED" || f.type === "INDIA_PII_DETECTED" || f.type === "SECRET_DETECTED")
    .map((f) => ({
      type: f.type ?? "UNKNOWN",
      label: f.label ?? f.type ?? "PII",
      severity: f.severity ?? "MEDIUM",
      sample: f.matched ? maskSample(f.matched) : undefined,
    }));

  return {
    safeText: raw.safeText ?? raw.redactedText ?? "",
    detectedEntities: entities,
    riskScore: raw.riskScore ?? 0,
    rawResponse: raw,
  };
}

function toScanRagResult(raw: RawRagTrustResult, originalText: string): ScanRagResult {
  const score = raw.trustScore ?? 100;
  const allowed = score >= 50 && raw.recommendedAction !== "QUARANTINE";
  const issues: RagIssue[] = (raw.findings ?? []).map((f) => ({
    type: f.type ?? "UNKNOWN",
    severity: f.severity ?? "MEDIUM",
    message: f.message ?? f.label ?? "",
  }));

  return {
    allowed,
    riskScore: 100 - score,
    issues,
    safeText: allowed ? originalText : undefined,
    incidentId: undefined,
    rawResponse: raw,
  };
}

function toScanRagResultFromGuard(raw: RawGuardResult): ScanRagResult {
  const issues: RagIssue[] = (raw.findings ?? []).map((f) => ({
    type: f.type ?? "UNKNOWN",
    severity: f.severity ?? "MEDIUM",
    message: f.message ?? f.label ?? "",
  }));

  return {
    allowed: raw.allowed ?? true,
    riskScore: raw.riskScore ?? 0,
    issues,
    safeText: raw.safeText ?? raw.redactedText,
    incidentId: raw.incidentId,
    rawResponse: raw,
  };
}

function extractMessage(data: unknown): string | undefined {
  if (data && typeof data === "object" && "message" in data) {
    const msg = (data as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return undefined;
}

function maskSample(matched: string): string {
  if (matched.length <= 4) return "****";
  return `${matched.slice(0, 2)}…${matched.slice(-2)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Apply the local "onThreat" policy to a guard result.
 * This is a client-side convenience — the server-side policy is authoritative.
 */
export function applyOnThreat(
  result: GuardCheckResult,
  onThreat: OnThreat,
  originalText: string,
): GuardCheckResult & { blocked: boolean; outputText: string } {
  if (result.allowed) {
    return { ...result, blocked: false, outputText: result.safeText ?? originalText };
  }

  switch (onThreat) {
    case "BLOCK":
      return { ...result, blocked: true, outputText: "" };
    case "REDACT":
      return { ...result, blocked: false, outputText: result.safeText ?? "[REDACTED]" };
    case "WARN":
      return { ...result, blocked: false, outputText: originalText };
    case "CONTINUE":
      return { ...result, allowed: true, blocked: false, outputText: originalText };
    default:
      return { ...result, blocked: true, outputText: "" };
  }
}
