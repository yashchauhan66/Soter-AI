/**
 * Cross-IDE schemas shared by adapters: policy, memory events, approvals,
 * safe context, and redacted telemetry. These are the wire/config shapes that
 * every host serializes; the authoritative runtime lives in guard-core.
 */

import type { GuardDecision, SafeModeLevel } from "./broker";

// ---- Policy schema --------------------------------------------------------

export interface GuardPolicy {
    version: string;
    safeMode: { enabled: boolean; level: SafeModeLevel };
    /** Glob patterns whose contents must never be sent to AI. */
    protectedGlobs: string[];
    /** Category => decision override, e.g. { "india-pii": "block" }. */
    categoryOverrides: Record<string, GuardDecision>;
    /** Block cloud connect entirely regardless of per-request decisions. */
    localOnly: boolean;
}

export const DEFAULT_POLICY: GuardPolicy = {
    version: "1.0.0",
    safeMode: { enabled: false, level: "developer" },
    protectedGlobs: ["**/.env*", "**/*.pem", "**/id_rsa", "**/secrets/**"],
    categoryOverrides: {},
    localOnly: true,
};

// ---- Memory event schema --------------------------------------------------

export type MemoryEventKind =
    | "broker_request_scanned"
    | "broker_request_redacted"
    | "broker_request_blocked"
    | "broker_response_scanned"
    | "broker_response_leak_detected"
    | "memory_session_started"
    | "memory_session_ended";

export type MemorySource =
    | "broker"
    | "safe-context-builder"
    | "scan-before-ai-prompt"
    | "manual-output-scan"
    | "git-scan"
    | "terminal-check"
    | "mcp-scan";

export interface MemoryEventSchema {
    eventId: string;
    timestamp: string;
    kind: MemoryEventKind;
    source: MemorySource;
    decision: GuardDecision;
    riskScore: number;
    categories: string[];
    /** Already-minimized. Never carries raw secrets. */
    redactedEvidence?: string;
    requestHash?: string;
    responseHash?: string;
    canaryExposed?: boolean;
    model?: string;
    provider?: string;
}

// ---- Approval schema ------------------------------------------------------

export type ApprovalScope = "once" | "session" | "workspace";
export type ApprovalOutcome = "approve" | "deny" | "redact_and_allow";

export interface ApprovalRequestSchema {
    sessionId: string;
    /** Hash of the content the user is approving — never the content itself. */
    contentHash: string;
    scope: ApprovalScope;
    outcome: ApprovalOutcome;
}

// ---- Safe context schema --------------------------------------------------

/** The minimized, shareable context an adapter hands to an AI feature. */
export interface SafeContextSchema {
    contentHash: string;
    decision: GuardDecision;
    /** Redacted text safe to forward. Empty when decision is "block". */
    redactedContent: string;
    categories: string[];
    canaryInRequest: boolean;
}

// ---- Redacted telemetry schema -------------------------------------------

/**
 * The only telemetry shape an adapter may emit. It carries no raw source,
 * secrets, prompts, or file contents — hashes and counts only.
 */
export interface RedactedTelemetrySchema {
    adapter: string; // e.g. "vscode", "jetbrains", "neovim"
    adapterVersion: string;
    feature: string; // GuardFeatureKey
    decision: GuardDecision;
    riskScore: number;
    categories: string[];
    contentHash?: string;
    /** Wall-clock milliseconds for the guarded operation. */
    durationMs?: number;
    safeMode: boolean;
}

// ---- Lightweight runtime guards (no dependency) --------------------------

export function isGuardDecision(value: unknown): value is GuardDecision {
    return (
        value === "allow" ||
        value === "warn" ||
        value === "redact" ||
        value === "block" ||
        value === "approval_required"
    );
}

export function isSafeModeLevel(value: unknown): value is SafeModeLevel {
    return value === "developer" || value === "strict" || value === "enterprise";
}

/** Assert an emitted telemetry object carries no obvious raw-content fields. */
export function assertNoRawContent(payload: Record<string, unknown>): void {
    for (const forbidden of ["content", "prompt", "source", "raw", "text", "body"]) {
        if (forbidden in payload) {
            throw new Error(
                `Redacted telemetry must not include a "${forbidden}" field; emit hashes only`,
            );
        }
    }
}
