import type { GuardAction, Severity } from "./types";
import { containsRawSecret } from "./Redactor";

/**
 * "What AI Saw" ledger — the append-only local audit record of every firewall
 * decision (context prepared, blocked, redacted, output scanned, canary hit).
 *
 * Privacy contract (mirrors sanitizeDecisionForCache): a LedgerEntry stores ONLY
 * hashes, redacted previews, decisions, and metadata — never raw secrets,
 * prompts, file content, terminal output, or AI responses. Every write MUST go
 * through {@link sanitizeLedgerEntry} (enforced by the extension's LedgerStore).
 */

export type LedgerEventType =
    | "context_inspected"
    | "context_built"
    | "context_blocked"
    | "context_approved"
    | "output_scanned"
    | "canary_leak"
    | "vault_migrated"
    | "vault_restored"
    // ── Phase 8: Local AI Broker / Safe Mode / Memory events (additive) ──
    | "broker_request_scanned"
    | "broker_request_redacted"
    | "broker_request_blocked"
    | "broker_response_scanned"
    | "broker_response_leak_detected"
    | "safe_mode_enabled"
    | "safe_mode_disabled"
    | "memory_session_started"
    | "memory_session_ended"
    | "protected_file_attempted"
    | "approval_required"
    | "approval_granted"
    | "approval_denied"
    | "mcp_tool_blocked"
    | "terminal_command_blocked";

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
    // ── Phase 8 broker fields (all optional; additive) ──
    source?: LedgerEventSource;
    sessionId?: string;
    model?: string;
    provider?: string;
    protectedFileAttempt?: boolean;
    safeMode?: boolean;
    // ── Tamper evidence (additive) ──
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

export function buildLedgerEntry(input: BuildLedgerEntryInput): LedgerEntry {
    return sanitizeLedgerEntry({
        eventId: input.eventId,
        timestamp: input.timestamp ?? new Date().toISOString(),
        workspacePseudoId: input.workspacePseudoId,
        eventType: input.eventType,
        action: input.action,
        decision: input.decision ?? input.action,
        severity: input.severity,
        riskScore: input.riskScore,
        categories: input.categories ?? [],
        filePaths: input.filePaths,
        contentHashes: input.contentHashes ?? [],
        redactedEvidencePreview: input.redactedEvidencePreview,
        policyVersion: input.policyVersion,
        detectorVersions: input.detectorVersions ?? {},
        approvalSessionId: input.approvalSessionId,
        source: input.source,
        sessionId: input.sessionId,
        model: input.model,
        provider: input.provider,
        protectedFileAttempt: input.protectedFileAttempt,
        safeMode: input.safeMode,
    });
}

/**
 * Last line of defense before a ledger entry is persisted or exported. Any
 * string field that still contains a raw high-risk secret is replaced with a
 * placeholder. Returns a shallow clone; the input is untouched.
 */
export function sanitizeLedgerEntry(entry: LedgerEntry): LedgerEntry {
    const scrub = (value: string | undefined, placeholder: string): string | undefined => {
        if (value === undefined) return undefined;
        return containsRawSecret(value) ? placeholder : value;
    };
    return {
        ...entry,
        redactedEvidencePreview: scrub(entry.redactedEvidencePreview, "[REDACTED]"),
        // Paths are not secrets, but scrub defensively in case a secret was ever
        // embedded in a path-like string.
        filePaths: entry.filePaths?.map((p) => (containsRawSecret(p) ? "[REDACTED_PATH]" : p)),
        contentHashes: entry.contentHashes.filter((h) => !containsRawSecret(h)),
        // Provider/model labels are metadata, not secrets — scrub defensively.
        model: scrub(entry.model, "[REDACTED]"),
        provider: scrub(entry.provider, "[REDACTED]"),
    };
}

/** Serialize a batch of entries as JSONL (one sanitized entry per line). */
export function serializeLedger(entries: LedgerEntry[]): string {
    return entries.map((e) => JSON.stringify(sanitizeLedgerEntry(e))).join("\n");
}

/** Parse JSONL back into entries, skipping malformed lines. */
export function parseLedger(jsonl: string): LedgerEntry[] {
    const out: LedgerEntry[] = [];
    for (const line of jsonl.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            out.push(JSON.parse(trimmed) as LedgerEntry);
        } catch {
            // Skip corrupt lines rather than failing the whole read.
        }
    }
    return out;
}

// ── Tamper-evident hash chain ───────────────────────────────────────────────
// Each entry records prevHash (the previous entry's entryHash) and entryHash
// (SHA-256 over its own canonical JSON minus entryHash). Editing, reordering,
// or deleting mid-chain entries breaks verification. This is TAMPER EVIDENCE,
// not immutability: an attacker who can rewrite the whole file can rebuild the
// chain — but cannot do so silently against an exported/remembered head hash.

export const LEDGER_GENESIS_HASH = "genesis";

/**
 * SHA-256 over `text`, from whichever provider the host actually has.
 *
 * `globalThis.crypto` is not available unflagged in Node 18 — it became a global
 * in Node 19 — and VS Code 1.85, the `engines` floor this ledger ships under,
 * runs Node 18. A bare `crypto.subtle` therefore threw `crypto is not defined`
 * there, which took Emergency Lockdown down on every older editor while passing
 * on newer ones. `node:crypto` is imported lazily, so runtimes that do have
 * WebCrypto never resolve it.
 *
 * Both paths hash the same UTF-8 bytes with the same algorithm, so a chain
 * written under one provider verifies under the other — that matters the moment
 * a user upgrades their editor. There is deliberately no weak-hash fallback: a
 * chain that silently degrades its digest is not tamper evidence, so an absent
 * provider is an error rather than a downgrade.
 */
async function sha256Hex(text: string): Promise<string> {
    const subtle = (globalThis as any).crypto?.subtle;
    if (typeof subtle?.digest === "function") {
        const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
        return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    try {
        const { createHash } = await import("node:crypto");
        return createHash("sha256").update(text, "utf8").digest("hex");
    } catch (error) {
        throw new Error(
            "Ledger hash chaining requires SHA-256, but neither globalThis.crypto.subtle nor node:crypto is " +
                `available in this runtime (${error instanceof Error ? error.message : String(error)}).`,
        );
    }
}

function canonicalForHash(entry: LedgerEntry): string {
    const { entryHash, ...rest } = entry;
    return JSON.stringify(rest, Object.keys(rest).sort());
}

/** Return a copy of `entry` chained onto `prevEntryHash`. */
export async function chainLedgerEntry(entry: LedgerEntry, prevEntryHash: string | undefined): Promise<LedgerEntry> {
    const chained: LedgerEntry = { ...entry, prevHash: prevEntryHash ?? LEDGER_GENESIS_HASH };
    chained.entryHash = await sha256Hex(canonicalForHash(chained));
    return chained;
}

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
export async function verifyLedgerChain(entries: LedgerEntry[]): Promise<LedgerChainVerification> {
    let prev: string | undefined;
    let checked = 0;
    let unchained = 0;
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry.entryHash) {
            // Pre-chain legacy entry: allowed only before the first chained one.
            if (checked > 0) return { valid: false, checkedEntries: checked, unchainedEntries: unchained, firstInvalidIndex: i, reason: "unchained entry after chained entries" };
            unchained++;
            continue;
        }
        if (prev !== undefined && (entry.prevHash ?? LEDGER_GENESIS_HASH) !== prev) {
            return { valid: false, checkedEntries: checked, unchainedEntries: unchained, firstInvalidIndex: i, reason: "prevHash mismatch (entry removed, reordered, or edited)" };
        }
        const recomputed = await sha256Hex(canonicalForHash(entry));
        if (recomputed !== entry.entryHash) {
            return { valid: false, checkedEntries: checked, unchainedEntries: unchained, firstInvalidIndex: i, reason: "entryHash mismatch (entry content edited)" };
        }
        prev = entry.entryHash;
        checked++;
    }
    return { valid: true, checkedEntries: checked, unchainedEntries: unchained };
}
