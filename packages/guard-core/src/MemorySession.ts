import type { GuardAction } from "./types";
import { containsRawSecret, redactForSharing } from "./Redactor";

/**
 * AI Memory Inspector — the local record of "what AI saw" during a session, both
 * for brokered AI requests and for SoterAI-built/scanned context.
 *
 * Honest scope: for non-brokered third-party extensions this shows only
 * SoterAI-built context, SoterAI scans, the ledger, and user-initiated scans. It
 * cannot prove what another extension internally read unless traffic is routed
 * through the broker. See docs/broker-limitations.md.
 *
 * Privacy contract: NO raw prompts, secrets, file content, or AI responses are
 * stored. Only hashes, redacted previews, decisions, and metadata. Every write
 * passes through {@link sanitizeMemoryEvent}.
 */

export type MemorySource =
    | "broker"
    | "safe-context-builder"
    | "scan-before-ai-prompt"
    | "manual-output-scan"
    | "git-scan"
    | "terminal-check"
    | "mcp-scan";

export type MemoryEventKind =
    | "broker_request_scanned"
    | "broker_request_redacted"
    | "broker_request_blocked"
    | "broker_response_scanned"
    | "broker_response_leak_detected"
    | "context_built"
    | "context_blocked"
    | "protected_file_attempted"
    | "output_scanned"
    | "approval_required"
    | "approval_granted"
    | "mcp_tool_blocked"
    | "terminal_command_blocked";

export interface MemoryEvent {
    eventId: string;
    timestamp: string;
    kind: MemoryEventKind;
    source: MemorySource;
    decision: GuardAction;
    riskScore: number;
    categories: string[];
    /** Short, secret-free evidence preview. */
    redactedEvidence?: string;
    /** SHA-256 of any request content involved. */
    requestHash?: string;
    /** SHA-256 of any response content involved. */
    responseHash?: string;
    filePaths?: string[];
    protectedFileAttempt?: boolean;
    canaryExposed?: boolean;
    model?: string;
    provider?: string;
    /** Rough character/token size estimate — never the content. */
    contentSize?: number;
}

export interface MemorySession {
    sessionId: string;
    startedAt: string;
    endedAt?: string;
    tool?: string;
    provider?: string;
    source: MemorySource;
    filesIncluded: string[];
    filesBlocked: string[];
    protectedFilesAttempted: string[];
    riskCategories: string[];
    requestHashes: string[];
    responseHashes: string[];
    contentSizeEstimate: number;
    decisions: GuardAction[];
    approvals: string[];
    canaryExposed: boolean;
    events: MemoryEvent[];
}

export interface StartSessionInput {
    sessionId: string;
    source: MemorySource;
    tool?: string;
    provider?: string;
    startedAt?: string;
}

/**
 * Scrub a memory event so no raw secret can ever be persisted, exported, or shown
 * in a webview. Returns a shallow clone; the input is untouched.
 */
export function sanitizeMemoryEvent(event: MemoryEvent): MemoryEvent {
    const scrub = (v: string | undefined): string | undefined => {
        if (v === undefined) return undefined;
        // Redact first (masks known secret shapes incl. the canary token), then
        // hard-drop anything that still smells like a raw secret.
        const red = redactForSharing(v);
        return containsRawSecret(red) ? "[REDACTED]" : red;
    };
    return {
        ...event,
        redactedEvidence: scrub(event.redactedEvidence),
        // Hashes must never contain secrets; drop any that somehow do.
        requestHash: event.requestHash && !containsRawSecret(event.requestHash) ? event.requestHash : undefined,
        responseHash: event.responseHash && !containsRawSecret(event.responseHash) ? event.responseHash : undefined,
        filePaths: event.filePaths?.map((p) => (containsRawSecret(p) ? "[REDACTED_PATH]" : p)),
        model: scrub(event.model),
        provider: scrub(event.provider),
    };
}

export class MemoryStore {
    private sessions = new Map<string, MemorySession>();

    startSession(input: StartSessionInput): MemorySession {
        const session: MemorySession = {
            sessionId: input.sessionId,
            startedAt: input.startedAt ?? new Date().toISOString(),
            tool: input.tool,
            provider: input.provider,
            source: input.source,
            filesIncluded: [],
            filesBlocked: [],
            protectedFilesAttempted: [],
            riskCategories: [],
            requestHashes: [],
            responseHashes: [],
            contentSizeEstimate: 0,
            decisions: [],
            approvals: [],
            canaryExposed: false,
            events: [],
        };
        this.sessions.set(session.sessionId, session);
        return session;
    }

    /** Append a (sanitized) event and update session aggregates. */
    addEvent(sessionId: string, event: MemoryEvent): MemoryEvent {
        const session = this.sessions.get(sessionId) ?? this.startSession({ sessionId, source: event.source });
        const clean = sanitizeMemoryEvent(event);
        session.events.push(clean);

        for (const c of clean.categories) {
            if (!session.riskCategories.includes(c)) session.riskCategories.push(c);
        }
        if (clean.requestHash) session.requestHashes.push(clean.requestHash);
        if (clean.responseHash) session.responseHashes.push(clean.responseHash);
        if (typeof clean.contentSize === "number") session.contentSizeEstimate += clean.contentSize;
        session.decisions.push(clean.decision);
        if (clean.canaryExposed) session.canaryExposed = true;

        for (const p of clean.filePaths ?? []) {
            if (clean.protectedFileAttempt || clean.decision === "block") {
                if (!session.filesBlocked.includes(p)) session.filesBlocked.push(p);
                if (clean.protectedFileAttempt && !session.protectedFilesAttempted.includes(p)) {
                    session.protectedFilesAttempted.push(p);
                }
            } else if (!session.filesIncluded.includes(p)) {
                session.filesIncluded.push(p);
            }
        }
        if (clean.kind === "approval_granted") session.approvals.push(clean.eventId);
        return clean;
    }

    endSession(sessionId: string, endedAt?: string): MemorySession | undefined {
        const s = this.sessions.get(sessionId);
        if (s) s.endedAt = endedAt ?? new Date().toISOString();
        return s;
    }

    clearSession(sessionId: string): void {
        this.sessions.delete(sessionId);
    }

    clearAll(): void {
        this.sessions.clear();
    }

    getSession(sessionId: string): MemorySession | undefined {
        return this.sessions.get(sessionId);
    }

    listSessions(): MemorySession[] {
        return [...this.sessions.values()];
    }

    /**
     * Export all sessions as a redacted report. Every event is re-sanitized on
     * the way out so an export can never contain a raw secret or canary.
     */
    exportRedacted(): { generatedAt: string; sessions: MemorySession[] } {
        const sessions = this.listSessions().map((s) => ({
            ...s,
            events: s.events.map(sanitizeMemoryEvent),
        }));
        return { generatedAt: new Date().toISOString(), sessions };
    }
}

/** Rough size estimate for content without storing it. */
export function estimateContentSize(text: string): number {
    return text.length;
}
