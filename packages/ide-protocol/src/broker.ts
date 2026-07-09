/**
 * Local AI Broker HTTP contract as consumed by every IDE adapter and the CLI.
 *
 * This is a transcription of the routes implemented by
 * `apps/local-ai-broker/src/BrokerServer.ts`. It exists so adapters in other
 * languages and the TypeScript client stay in lockstep with one written spec.
 * The broker is loopback-only and requires a bearer token on every route
 * except `GET /health`.
 */

export const BROKER_HOST = "127.0.0.1" as const;
export const DEFAULT_BROKER_PORT = 47321 as const;
export const DEFAULT_BROKER_URL = `http://${BROKER_HOST}:${DEFAULT_BROKER_PORT}` as const;

/** Path, relative to the token file, under the user home directory. */
export const BROKER_TOKEN_RELATIVE_PATH = [".soterai", "broker", "auth-token"] as const;

/** Guard decision vocabulary. Matches `GuardAction` in guard-core. */
export type GuardDecision =
    | "allow"
    | "warn"
    | "redact"
    | "block"
    | "approval_required";

export type SafeModeLevel = "developer" | "strict" | "enterprise";

export interface BrokerMessage {
    role: string;
    content: string;
    name?: string;
}

/** Broker endpoint registry — single source of truth for method + path. */
export const BrokerRoutes = {
    health: { method: "GET", path: "/health", auth: false },
    version: { method: "GET", path: "/version", auth: true },
    safeModeStatus: { method: "GET", path: "/v1/safe-mode/status", auth: true },
    safeModeEnable: { method: "POST", path: "/v1/safe-mode/enable", auth: true },
    safeModeDisable: { method: "POST", path: "/v1/safe-mode/disable", auth: true },
    scan: { method: "POST", path: "/v1/scan", auth: true },
    decision: { method: "POST", path: "/v1/decision", auth: true },
    redact: { method: "POST", path: "/v1/redact", auth: true },
    recentEvents: { method: "GET", path: "/v1/events/recent", auth: true },
    exportRedacted: { method: "POST", path: "/v1/events/export-redacted", auth: true },
    approvals: { method: "GET", path: "/v1/approvals", auth: true },
    memoryStart: { method: "POST", path: "/v1/memory/session/start", auth: true },
    memoryEvent: { method: "POST", path: "/v1/memory/session/event", auth: true },
    memoryEnd: { method: "POST", path: "/v1/memory/session/end", auth: true },
} as const;

// ---- Request bodies -------------------------------------------------------

export interface ScanRequest {
    /** Provide either free-form content or an explicit message array. */
    content?: string;
    messages?: BrokerMessage[];
}

export interface RedactRequest {
    content: string;
}

export interface SafeModeEnableRequest {
    level?: SafeModeLevel;
}

// ---- Response bodies ------------------------------------------------------

export interface HealthResponse {
    status: "ok";
    localOnly: true;
    host: string;
    startedAt?: string;
}

export interface VersionResponse {
    name: string;
    version: string;
}

export interface ScanResponse {
    decision: GuardDecision;
    riskScore: number;
    categories: string[];
    redactedMessages?: BrokerMessage[];
    redacted: boolean;
    canaryInRequest: boolean;
    /** Stable hash of the scanned content; never the raw content. */
    contentHash: string;
    safe: boolean;
    /** Already-redacted preview safe to show in UI. Never raw secrets. */
    evidencePreview?: string;
}

export interface RedactResponse {
    redacted: string;
}

export interface SafeModeStatusResponse {
    enabled: boolean;
    level: SafeModeLevel;
    rules?: unknown[];
}

export interface RecentEventsResponse {
    events: SafeBrokerEventDto[];
}

/**
 * Redacted event shape returned by `/v1/events/recent`. Mirrors
 * `SafeBrokerEvent` in the broker — evidence is already minimized.
 */
export interface SafeBrokerEventDto {
    eventId: string;
    sessionId?: string;
    timestamp: string;
    source: "broker";
    eventType: string;
    decision: GuardDecision;
    riskScore: number;
    categories: string[];
    redactedEvidence?: string;
    contentHash?: string;
    responseHash?: string;
    model?: string;
    provider?: string;
    safeMode: boolean;
    policyVersion: string;
}

export interface BrokerErrorBody {
    error: { code: string; message: string; requestId?: string };
}

/** Endpoints that a decision must clear before content may leave the machine. */
export function decisionAllowsForward(decision: GuardDecision, approved: boolean): boolean {
    if (decision === "allow" || decision === "warn" || decision === "redact") return true;
    if (decision === "approval_required") return approved;
    return false; // "block"
}
