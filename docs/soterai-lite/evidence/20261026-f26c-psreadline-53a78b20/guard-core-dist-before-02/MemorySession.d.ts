import type { GuardAction } from "./types";
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
export type MemorySource = "broker" | "safe-context-builder" | "scan-before-ai-prompt" | "manual-output-scan" | "git-scan" | "terminal-check" | "mcp-scan";
export type MemoryEventKind = "broker_request_scanned" | "broker_request_redacted" | "broker_request_blocked" | "broker_response_scanned" | "broker_response_leak_detected" | "context_built" | "context_blocked" | "protected_file_attempted" | "output_scanned" | "approval_required" | "approval_granted" | "mcp_tool_blocked" | "terminal_command_blocked";
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
export declare function sanitizeMemoryEvent(event: MemoryEvent): MemoryEvent;
export declare class MemoryStore {
    private sessions;
    startSession(input: StartSessionInput): MemorySession;
    /** Append a (sanitized) event and update session aggregates. */
    addEvent(sessionId: string, event: MemoryEvent): MemoryEvent;
    endSession(sessionId: string, endedAt?: string): MemorySession | undefined;
    clearSession(sessionId: string): void;
    clearAll(): void;
    getSession(sessionId: string): MemorySession | undefined;
    listSessions(): MemorySession[];
    /**
     * Export all sessions as a redacted report. Every event is re-sanitized on
     * the way out so an export can never contain a raw secret or canary.
     */
    exportRedacted(): {
        generatedAt: string;
        sessions: MemorySession[];
    };
}
/** Rough size estimate for content without storing it. */
export declare function estimateContentSize(text: string): number;
//# sourceMappingURL=MemorySession.d.ts.map