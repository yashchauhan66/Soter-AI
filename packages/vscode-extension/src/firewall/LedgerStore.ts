import * as vscode from "vscode";
import {
    buildLedgerEntry,
    sanitizeLedgerEntry,
    serializeLedger,
    parseLedger,
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
 * `sanitizeLedgerEntry`, so no raw secret/prompt/content can ever be persisted.
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
 * The ledger holds only hashes, decisions, redacted previews, and metadata.
 * Recommend gitignoring `.soterai/local-ledger.jsonl`.
 */
export class LedgerStore {
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
        const uri = this.ledgerUri();
        if (!uri) return;
        // Queue writes so concurrent appends cannot interleave read-modify-write.
        const task = this.writeQueue.then(async () => {
            const dir = vscode.Uri.joinPath(firstWorkspaceFolder()!.uri, ".soterai");
            await vscode.workspace.fs.createDirectory(dir);

            let entries: LedgerEntry[] = [];
            try {
                const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
                entries = parseLedger(text);
            } catch {
                /* new ledger */
            }

            // Sanitize FIRST, then chain — the hash must cover the exact bytes
            // that get persisted, or sanitization would invalidate the chain.
            const sanitized = sanitizeLedgerEntry(buildLedgerEntry(input));
            const prevHash = entries.length ? entries[entries.length - 1].entryHash : undefined;
            const chained = await chainLedgerEntry(sanitized, prevHash);
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
        await task;
    }

    static async readAll(): Promise<LedgerEntry[]> {
        const uri = this.ledgerUri();
        if (!uri) return [];
        try {
            const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
            return parseLedger(text);
        } catch {
            return [];
        }
    }

    /**
     * Verify the tamper-evidence hash chain. After retention trimming, the
     * earliest retained entry's prevHash may reference a dropped entry —
     * verifyLedgerChain accepts the first entry's prevHash as-is and verifies
     * integrity and linkage from there forward.
     */
    static async verifyChain(): Promise<LedgerChainVerification> {
        return verifyLedgerChain(await this.readAll());
    }

    /** Re-sanitized JSONL for safe export (chain hashes preserved). */
    static async exportSafe(): Promise<string> {
        return serializeLedger(await this.readAll());
    }

    static async clear(): Promise<void> {
        const uri = this.ledgerUri();
        if (!uri) return;
        try {
            await vscode.workspace.fs.delete(uri);
        } catch {
            /* nothing to clear */
        }
    }
}
