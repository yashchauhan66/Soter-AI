import type { GuardAction, Severity } from "./types";
/**
 * "What AI Saw" ledger — the append-only local audit record of every firewall
 * decision (context prepared, blocked, redacted, output scanned, canary hit).
 *
 * Privacy contract (mirrors sanitizeDecisionForCache): a LedgerEntry stores ONLY
 * hashes, redacted previews, decisions, and metadata — never raw secrets,
 * prompts, file content, terminal output, or AI responses. Every write MUST go
 * through {@link sanitizeLedgerEntry} (enforced by the extension's LedgerStore).
 */
export type LedgerEventType = "context_inspected" | "context_built" | "context_blocked" | "context_approved" | "output_scanned" | "canary_leak" | "vault_migrated" | "vault_restored" | "broker_request_scanned" | "broker_request_redacted" | "broker_request_blocked" | "broker_response_scanned" | "broker_response_leak_detected" | "safe_mode_enabled" | "safe_mode_disabled" | "memory_session_started" | "memory_session_ended" | "protected_file_attempted" | "approval_required" | "approval_granted" | "approval_denied" | "mcp_tool_blocked" | "terminal_command_blocked";
/** Source that produced a ledger/broker event. */
export type LedgerEventSource = "broker" | "vscode" | "manual" | "mcp" | "terminal";
export interface LedgerEntry {
    eventId: string;
    timestamp: string;
    workspacePseudoId: string;
    eventType: LedgerEventType;
    action: GuardAction;
    decision: GuardAction;
    severity: Severity;
    riskScore: number;
    categories: string[];
    /** File paths only if policy allows path logging (default on — they are not secrets). */
    filePaths?: string[];
    /** SHA-256 hashes of the content involved — never the content itself. */
    contentHashes: string[];
    /** Short, secret-free evidence preview. */
    redactedEvidencePreview?: string;
    policyVersion: string;
    detectorVersions: Record<string, string>;
    approvalSessionId?: string;
    source?: LedgerEventSource;
    sessionId?: string;
    model?: string;
    provider?: string;
    protectedFileAttempt?: boolean;
    safeMode?: boolean;
    /** SHA-256 of the previous entry's entryHash ("genesis" for the first). */
    prevHash?: string;
    /** SHA-256 over this entry's canonical JSON (excluding entryHash itself). */
    entryHash?: string;
}
export interface BuildLedgerEntryInput {
    eventId: string;
    timestamp?: string;
    workspacePseudoId: string;
    eventType: LedgerEventType;
    action: GuardAction;
    decision?: GuardAction;
    severity: Severity;
    riskScore: number;
    categories?: string[];
    filePaths?: string[];
    contentHashes?: string[];
    redactedEvidencePreview?: string;
    policyVersion: string;
    detectorVersions?: Record<string, string>;
    approvalSessionId?: string;
    source?: LedgerEventSource;
    sessionId?: string;
    model?: string;
    provider?: string;
    protectedFileAttempt?: boolean;
    safeMode?: boolean;
}
export declare function buildLedgerEntry(input: BuildLedgerEntryInput): LedgerEntry;
/**
 * Last line of defense before a ledger entry is persisted or exported. Any
 * string field that still contains a raw high-risk secret is replaced with a
 * placeholder. Returns a shallow clone; the input is untouched.
 */
export declare function sanitizeLedgerEntry(entry: LedgerEntry): LedgerEntry;
/** Serialize a batch of entries as JSONL (one sanitized entry per line). */
export declare function serializeLedger(entries: LedgerEntry[]): string;
/** Parse JSONL back into entries, skipping malformed lines. */
export declare function parseLedger(jsonl: string): LedgerEntry[];
export declare const LEDGER_GENESIS_HASH = "genesis";
/** Return a copy of `entry` chained onto `prevEntryHash`. */
export declare function chainLedgerEntry(entry: LedgerEntry, prevEntryHash: string | undefined): Promise<LedgerEntry>;
export interface LedgerChainVerification {
    valid: boolean;
    checkedEntries: number;
    /** Entries predating the hash chain (no entryHash) — reported, not failed. */
    unchainedEntries: number;
    firstInvalidIndex?: number;
    reason?: string;
}
/**
 * Verify the hash chain over parsed entries (in file order).
 *
 * The first chained entry's prevHash is accepted as-is (it may be "genesis"
 * or reference an entry dropped by retention trimming); every later entry must
 * link to its predecessor and every entryHash must match its content.
 */
export declare function verifyLedgerChain(entries: LedgerEntry[]): Promise<LedgerChainVerification>;
//# sourceMappingURL=Ledger.d.ts.map