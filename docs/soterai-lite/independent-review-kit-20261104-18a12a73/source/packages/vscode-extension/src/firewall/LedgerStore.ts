import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { selfHygieneEnabled } from "../self-hygiene/SelfHygieneFlags";
import {
    buildLedgerEntry,
    sanitizeLedgerEntry,
    chainLedgerEntry,
    verifyLedgerChain,
    type LedgerChainVerification,
    type LedgerEntry,
    type BuildLedgerEntryInput,
} from "@soterai/guard-core";
import { firstWorkspaceFolder } from "./util";

/**
 * LedgerStore — the "What AI Saw" local audit log
 * (`.soterai/local-ledger.jsonl`). EVERY write is forced through
 * `sanitizeLedgerEntry` after metadata minimization. Existing legacy records
 * remain unchanged; unsafe legacy history blocks further appends.
 *
 * Tamper evidence: entries are hash-chained (prevHash → entryHash). Editing,
 * deleting, or reordering entries breaks `verifyChain()`. This is tamper
 * EVIDENCE, not immutability — the file is plain JSONL a local process could
 * rewrite wholesale; the chain makes silent single-entry edits detectable.
 *
 * Retention: capped at MAX_ENTRIES; the oldest entries are dropped and the
 * chain restarts from the retained head (verifyChain treats the first retained
 * entry as the new genesis when trimming occurred).
 *
 * New records contain generated identifiers and finite decision metadata.
 * Recommend gitignoring `.soterai/local-ledger.jsonl`.
 */
export class LedgerStore {
    private static generation = 0;
    private static ownerToken = 0;
    private static active = false;
    static initialize(context: vscode.ExtensionContext): void {
        const owner = ++this.ownerToken;
        this.generation++;
        this.active = true;
        const listener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration("soterai.lite.selfHygiene")) this.generation++;
        });
        // Initialization belongs to this extension host, not a repository scope.
        context.subscriptions.push(listener, { dispose: () => {
            listener.dispose();
            if (owner === this.ownerToken) { this.active = false; this.generation++; }
        } });
    }
    static available(): boolean { return this.active && selfHygieneEnabled(); }
    private static admitted(epoch: number): boolean { return this.available() && epoch === this.generation; }

    /** Fresh value-free projection. Original chain material remains private. */
    private static project(input: Partial<LedgerEntry>, index: number): LedgerEntry {
        const events = new Set(["context_inspected", "context_built", "context_blocked", "context_approved", "output_scanned", "canary_leak", "vault_migrated", "vault_restored", "broker_request_scanned", "broker_request_redacted", "broker_request_blocked", "broker_response_scanned", "broker_response_leak_detected", "safe_mode_enabled", "safe_mode_disabled", "memory_session_started", "memory_session_ended", "protected_file_attempted", "approval_required", "approval_granted", "approval_denied", "mcp_tool_blocked", "terminal_command_blocked"]);
        const actions = new Set(["allow", "block", "warn", "redact", "approval_required"]);
        const timestamp = typeof input.timestamp === "string" && input.timestamp.length === 24 && Number.isFinite(Date.parse(input.timestamp)) && new Date(input.timestamp).toISOString() === input.timestamp ? input.timestamp : "1970-01-01T00:00:00.000Z";
        return sanitizeLedgerEntry(buildLedgerEntry({
            eventId: `ledger_event_${index}`, timestamp, workspacePseudoId: "local-workspace",
            eventType: events.has(input.eventType as string) ? input.eventType! : "context_inspected",
            action: actions.has(input.action as string) ? input.action! : "block",
            decision: actions.has(input.decision as string) ? input.decision! : "block",
            severity: ["low", "medium", "high", "critical"].includes(input.severity as string) ? input.severity! : "high",
            riskScore: typeof input.riskScore === "number" && Number.isInteger(input.riskScore) && input.riskScore >= 0 && input.riskScore <= 100 ? input.riskScore : 100,
            categories: [], contentHashes: [], detectorVersions: {}, policyVersion: "owned-metadata-v1",
        }));
    }
    /** Retention cap — keeps the file bounded and reads/writes fast. */
    static readonly MAX_ENTRIES = 5000;

    /** Serialize concurrent appends inside this extension host. */
    private static writeQueue: Promise<void> = Promise.resolve();

    static ledgerUri(): vscode.Uri | undefined {
        const folder = firstWorkspaceFolder();
        if (!folder) return undefined;
        return vscode.Uri.joinPath(folder.uri, ".soterai", "local-ledger.jsonl");
    }

    /** Append a sanitized, hash-chained entry. No-ops if there is no workspace. */
    static async append(input: BuildLedgerEntryInput): Promise<void> {
        if (!this.available()) return;
        const epoch = this.generation;
        const uri = this.ledgerUri();
        if (!uri) return;
        const folder = firstWorkspaceFolder();
        if (!folder) return;
        // Minimize synchronously before enqueueing: no queued closure owns input.
        const sanitized = this.project({ eventType: input.eventType, action: input.action, decision: input.decision ?? input.action,
            severity: input.severity, riskScore: input.riskScore }, 0);
        sanitized.eventId = `owned_${randomUUID()}`;
        sanitized.timestamp = new Date().toISOString();
        // Queue writes so concurrent appends cannot interleave read-modify-write.
        const task = this.writeQueue.then(async () => {
            if (!this.admitted(epoch)) return;
            const dir = vscode.Uri.joinPath(folder.uri, ".soterai");
            await vscode.workspace.fs.createDirectory(dir);
            if (!this.admitted(epoch)) return;

            let entries: LedgerEntry[] = [];
            try {
                const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
                entries = text.split("\n").filter(line => line.trim()).map(line => JSON.parse(line));
            } catch (error) {
                const code = error && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, "code")?.value : undefined;
                if (code !== "ENOENT" && code !== "FileNotFound") throw new Error("Owned ledger storage unavailable.");
            }
            if (!this.admitted(epoch)) return;

            // Never rewrite or re-sign legacy/private history as sanitized history.
            const safe = entries.every((entry, index) => {
                const { eventId, prevHash, entryHash, ...rest } = entry;
                const { eventId: ignored, ...projection } = this.project(entry, index);
                return typeof eventId === "string" && /^owned_[0-9a-f-]{36}$/.test(eventId)
                    && JSON.stringify(rest) === JSON.stringify(projection)
                    && typeof entryHash === "string" && /^[0-9a-f]{64}$/.test(entryHash)
                    && (prevHash === "genesis" || (typeof prevHash === "string" && /^[0-9a-f]{64}$/.test(prevHash)));
            });
            if (!safe || !(await verifyLedgerChain(entries)).valid) throw new Error("Owned ledger history requires explicit review before appending.");
            if (!this.admitted(epoch)) return;

            // Sanitize FIRST, then chain — the hash must cover the exact bytes
            // that get persisted, or sanitization would invalidate the chain.
            const prevHash = entries.length ? entries[entries.length - 1].entryHash : undefined;
            const chained = await chainLedgerEntry(sanitized, prevHash);
            if (!this.admitted(epoch)) return;
            entries.push(chained);

            // Retention cap: drop oldest. The chain restarts at the trim point;
            // verifyChain() accepts the retained head as genesis via prevHash
            // continuity from the next entry onward, so we re-chain the head.
            if (entries.length > this.MAX_ENTRIES) {
                entries = entries.slice(entries.length - this.MAX_ENTRIES);
            }

            const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
            await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(lines));
        });
        // Keep the queue alive even if a write fails.
        this.writeQueue = task.catch(() => undefined);
        try { await task; } catch { throw new Error("Owned ledger update unavailable."); }
    }

    static async readAll(): Promise<LedgerEntry[]> {
        if (!this.available()) return [];
        const epoch = this.generation;
        const entries = await this.readOriginal();
        return this.admitted(epoch) ? entries.map((entry, index) => this.project(entry, index)) : [];
    }

    private static async readOriginal(): Promise<LedgerEntry[]> {
        const uri = this.ledgerUri();
        if (!uri) throw new Error("Owned ledger storage unavailable.");
        try {
            const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
            const entries: LedgerEntry[] = text.split("\n").filter(line => line.trim()).map(line => JSON.parse(line));
            if (entries.some(entry => !entry || typeof entry !== "object" || Array.isArray(entry))) throw new Error("Invalid record");
            return entries;
        } catch {
            throw new Error("Owned ledger storage unavailable.");
        }
    }

    /**
     * Verify the tamper-evidence hash chain. After retention trimming, the
     * earliest retained entry's prevHash may reference a dropped entry —
     * verifyLedgerChain accepts the first entry's prevHash as-is and verifies
     * integrity and linkage from there forward.
     */
    static async verifyChain(): Promise<LedgerChainVerification> {
        if (!this.available()) throw new Error("Owned ledger verification withheld.");
        const epoch = this.generation;
        const result = await verifyLedgerChain(await this.readOriginal());
        if (!this.admitted(epoch)) throw new Error("Owned ledger verification withheld.");
        return result;
    }

    /** Metadata-only JSONL projection. Original hashes are deliberately withheld. */
    static async exportSafe(): Promise<string> {
        if (!this.available()) return "";
        const epoch = this.generation;
        const entries = await this.readAll();
        if (!this.admitted(epoch)) return "";
        return entries.map(entry => JSON.stringify({ ...entry, sanitizedProjection: true, integrityScope: "original storage verification only" })).join("\n");
    }

    /** Inspect original storage locally; a withheld/failed read is never a clean result. */
    static async containsCanary(tokens: readonly string[]): Promise<boolean | undefined> {
        if (!this.available()) return undefined;
        const epoch = this.generation, uri = this.ledgerUri();
        if (!uri) return undefined;
        try {
            const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
            if (!this.admitted(epoch)) return undefined;
            const records = text.split("\n").filter(line => line.trim()).map(line => JSON.parse(line));
            const serialized = JSON.stringify(records);
            return tokens.some(value => value.length > 0 && serialized.includes(value));
        } catch { return undefined; }
    }

    static async clear(): Promise<void> {
        // Invalidate pending reads/appends even if the flag later returns to on.
        this.generation++;
        const uri = this.ledgerUri();
        if (!uri) return;
        const task = this.writeQueue.then(async () => {
            try { await vscode.workspace.fs.delete(uri); }
            catch (error) {
                const code = error && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, "code")?.value : undefined;
                if (code !== "ENOENT" && code !== "FileNotFound") throw new Error("Owned ledger clear unavailable.");
            }
        });
        this.writeQueue = task.catch(() => undefined);
        await task;
    }
}
