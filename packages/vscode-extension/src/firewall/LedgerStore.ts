import * as vscode from "vscode";
import {
    buildLedgerEntry,
    sanitizeLedgerEntry,
    serializeLedger,
    parseLedger,
    type LedgerEntry,
    type BuildLedgerEntryInput,
} from "@soterai/guard-core";
import { firstWorkspaceFolder } from "./util";

/**
 * LedgerStore — the "What AI Saw" append-only local audit log
 * (`.soterai/local-ledger.jsonl`). EVERY write is forced through
 * `sanitizeLedgerEntry`, so no raw secret/prompt/content can ever be persisted.
 *
 * The ledger holds only hashes, decisions, redacted previews, and metadata.
 * Recommend gitignoring `.soterai/local-ledger.jsonl`.
 */
export class LedgerStore {
    static ledgerUri(): vscode.Uri | undefined {
        const folder = firstWorkspaceFolder();
        if (!folder) return undefined;
        return vscode.Uri.joinPath(folder.uri, ".soterai", "local-ledger.jsonl");
    }

    /** Append a sanitized entry. Silently no-ops if there is no workspace. */
    static async append(input: BuildLedgerEntryInput): Promise<void> {
        const uri = this.ledgerUri();
        if (!uri) return;
        const entry = buildLedgerEntry(input); // already sanitized inside
        const dir = vscode.Uri.joinPath(firstWorkspaceFolder()!.uri, ".soterai");
        await vscode.workspace.fs.createDirectory(dir);

        let existing = "";
        try {
            existing = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        } catch {
            /* new ledger */
        }
        const line = JSON.stringify(sanitizeLedgerEntry(entry));
        const next = existing ? `${existing.replace(/\n$/, "")}\n${line}\n` : `${line}\n`;
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(next));
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

    /** Re-sanitized JSONL for safe export. */
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
