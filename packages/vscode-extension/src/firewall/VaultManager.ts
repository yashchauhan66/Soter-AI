import * as vscode from "vscode";
import { createHash, randomUUID } from "crypto";
import {
    extractVaultCandidates,
    applyPlaceholders,
    restorePlaceholders,
    buildVaultMetadata,
    generateEnvExample,
    generateVaultKey,
    encryptVault,
    decryptVault,
    type VaultCandidate,
    type VaultEntryMetadata,
} from "@soterai/guard-core";
import { assertWorkspaceFileUri, assertWorkspaceOutputUri } from "../security/WorkspacePathGuard";

/**
 * VaultManager — the extension-side orchestration of the Protected Secret Vault.
 *
 * Honest design:
 *  - The encrypted vault file lives in the extension's GLOBAL storage
 *    (`context.globalStorageUri`), OUTSIDE the workspace, so other extensions
 *    walking the workspace never see it.
 *  - The AES-256 key lives in VS Code SecretStorage, separate from the file.
 *  - Migration removes raw secrets from workspace files, replacing them with
 *    `[SOTERAI_PROTECTED_*]` placeholders, after writing an ENCRYPTED backup
 *    into extension global storage (never a plaintext file in the workspace —
 *    a workspace `.bak` would hand the raw secrets straight to any AI tool or
 *    extension that reads workspace files).
 *  - Raw secret values are never written to logs, telemetry, the ledger, or the
 *    webview — only hash-bearing metadata is ever surfaced.
 *
 * This prevents ACCIDENTAL exposure of secrets to AI tools that read migrated
 * files. It does not stop an extension from reading a file you have not migrated
 * — see docs/ide-guard-limitations.md.
 */

const KEY_SECRET_ID = "soterai.vaultKey";

interface StoredVaultEntry extends VaultEntryMetadata {
    /** Raw value, only present inside the decrypted-in-memory vault. */
    rawValue: string;
}

interface VaultFile {
    version: number;
    entries: StoredVaultEntry[];
}

export interface VaultStatus {
    exists: boolean;
    location: string;
    entryCount: number;
    /** Metadata only — never raw values. */
    entries: VaultEntryMetadata[];
}

export interface MigrationPreview {
    file: string;
    candidates: Array<{ key: string; type: string; placeholder: string; redactedPreview: string }>;
}

export class VaultManager {
    /** Serialize vault mutations so concurrent watcher/command runs cannot lose entries. */
    private static mutationQueue: Promise<void> = Promise.resolve();

    constructor(private readonly context: vscode.ExtensionContext) {}

    private vaultUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.context.globalStorageUri, "soterai-vault.enc");
    }

    private async getOrCreateKey(): Promise<string> {
        let key = await this.context.secrets.get(KEY_SECRET_ID);
        if (!key) {
            key = generateVaultKey();
            await this.context.secrets.store(KEY_SECRET_ID, key);
        }
        return key;
    }

    private async readVault(): Promise<VaultFile> {
        try {
            await vscode.workspace.fs.stat(this.vaultUri());
        } catch (error) {
            if (isFileNotFound(error)) return { version: 1, entries: [] };
            throw new Error("Protected vault storage is not accessible; no workspace file was changed.");
        }

        try {
            const bytes = await vscode.workspace.fs.readFile(this.vaultUri());
            const key = await this.context.secrets.get(KEY_SECRET_ID);
            if (!key) {
                throw new Error("vault key is unavailable");
            }
            const json = await decryptVault(new TextDecoder().decode(bytes), key);
            const parsed = JSON.parse(json) as VaultFile;
            if (!parsed || !Array.isArray(parsed.entries)) throw new Error("vault format is invalid");
            if (parsed.entries.some((entry) =>
                !entry ||
                typeof entry.rawValue !== "string" ||
                typeof entry.placeholder !== "string" ||
                typeof entry.originalFile !== "string"
            )) {
                throw new Error("vault entries are invalid");
            }
            return { version: parsed.version ?? 1, entries: parsed.entries };
        } catch {
            // Never reinterpret a corrupt/undecryptable existing vault as empty.
            // Doing so would overwrite the only encrypted copy during migration.
            throw new Error(
                "Protected vault could not be decrypted or validated. Migration stopped without changing the workspace file.",
            );
        }
    }

    private async writeVault(vault: VaultFile): Promise<void> {
        await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
        const key = await this.getOrCreateKey();
        const payload = await encryptVault(JSON.stringify(vault), key);
        const tempUri = vscode.Uri.joinPath(
            this.context.globalStorageUri,
            `soterai-vault.${randomUUID()}.tmp`,
        );
        try {
            await vscode.workspace.fs.writeFile(tempUri, new TextEncoder().encode(payload));
            await vscode.workspace.fs.rename(tempUri, this.vaultUri(), { overwrite: true });
        } catch (error) {
            try { await vscode.workspace.fs.delete(tempUri); } catch { /* best-effort temp cleanup */ }
            throw error;
        }
    }

    /** Vault status for display — metadata only, never raw values. */
    async status(): Promise<VaultStatus> {
        const vault = await this.readVault();
        let exists = false;
        try {
            await vscode.workspace.fs.stat(this.vaultUri());
            exists = true;
        } catch {
            /* no vault yet */
        }
        const entries: VaultEntryMetadata[] = vault.entries.map(({ rawValue, ...meta }) => meta);
        return {
            exists,
            location: this.vaultUri().fsPath,
            entryCount: entries.length,
            entries,
        };
    }

    /** Preview which secrets WOULD migrate from a file (no changes made). */
    async preview(fileUri: vscode.Uri): Promise<MigrationPreview> {
        await assertWorkspaceFileUri(fileUri);
        const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
        const candidates = extractVaultCandidates(text);
        const rel = vscode.workspace.asRelativePath(fileUri);
        return {
            file: rel,
            candidates: candidates.map((c) => ({
                key: c.key,
                type: c.type,
                placeholder: c.placeholder,
                redactedPreview: redactValuePreview(c),
            })),
        };
    }

    /**
     * Migrate secrets from a file into the vault:
     *  1. write an encrypted backup into extension global storage (OUTSIDE the
     *     workspace — a plaintext workspace `.bak` would leak every raw secret
     *     to anything that reads workspace files)
     *  2. replace raw values with placeholders in the workspace file
     *  3. store encrypted entries in the vault (metadata + raw value)
     * Returns the number of secrets migrated.
     */
    async migrate(fileUri: vscode.Uri): Promise<number> {
        return this.runMutation(() => this.migrateLocked(fileUri));
    }

    private async migrateLocked(fileUri: vscode.Uri): Promise<number> {
        await assertWorkspaceFileUri(fileUri);
        const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
        const candidates = extractVaultCandidates(text);
        if (candidates.length === 0) return 0;

        const rel = vscode.workspace.asRelativePath(fileUri);

        // Fail before touching the workspace when an existing vault is corrupt,
        // missing its key, or unreadable. A corrupt vault must never look empty.
        const vault = await this.readVault();
        for (const c of candidates) {
            const meta = await buildVaultMetadata(c, rel);
            vault.entries = vault.entries.filter(
                (e) => !(e.placeholder === meta.placeholder && e.originalFile === rel),
            );
            vault.entries.push({ ...meta, rawValue: c.rawValue });
        }

        // 1. Encrypted backup before any destructive change.
        await this.writeEncryptedBackup(fileUri, text);

        // Abort on file/editor drift instead of overwriting newer user changes.
        this.assertDocumentReady(fileUri, text);
        await assertWorkspaceFileUri(fileUri);
        const latest = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
        if (latest !== text) throw new Error("File changed during migration; retry after edits finish.");

        // 2. Commit encrypted entries before removing plaintext. If this write
        // fails, the workspace file is still byte-for-byte untouched.
        await this.writeVault(vault);

        // 3. Replace raw values with placeholders in the workspace file/editor.
        const masked = applyPlaceholders(text, candidates);
        await assertWorkspaceFileUri(fileUri);
        await this.writeDocumentOrFile(fileUri, text, masked);

        const written = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
        for (const c of candidates) {
            if (written.includes(c.rawValue) || !written.includes(c.placeholder)) {
                throw new Error(
                    "Migration verification failed. The encrypted backup is intact; use Restore File From Backup if needed.",
                );
            }
        }
        return candidates.length;
    }

    /**
     * Restore placeholders in a file back to their raw values using the vault.
     * Returns the number of placeholders restored.
     */
    async restore(fileUri: vscode.Uri): Promise<number> {
        return this.runMutation(() => this.restoreLocked(fileUri));
    }

    private async restoreLocked(fileUri: vscode.Uri): Promise<number> {
        await assertWorkspaceFileUri(fileUri);
        const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
        const vault = await this.readVault();
        const rel = vscode.workspace.asRelativePath(fileUri);

        const map: Record<string, string> = {};
        for (const e of vault.entries) {
            if (e.originalFile === rel && text.includes(e.placeholder)) {
                map[e.placeholder] = e.rawValue;
            }
        }
        const count = Object.keys(map).length;
        if (count === 0) return 0;

        // Backup the placeholder version (encrypted, outside the workspace)
        // before restoring raw secrets back in.
        await this.writeEncryptedBackup(fileUri, text);

        const restored = restorePlaceholders(text, map);
        this.assertDocumentReady(fileUri, text);
        await assertWorkspaceFileUri(fileUri);
        await this.writeDocumentOrFile(fileUri, text, restored);
        return count;
    }

    /** Produce a safe `.env.example` sibling from a file. Never writes secrets. */
    async writeEnvExample(fileUri: vscode.Uri): Promise<vscode.Uri> {
        await assertWorkspaceFileUri(fileUri);
        const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
        const example = generateEnvExample(text);
        const dir = vscode.Uri.joinPath(fileUri, "..");
        const exampleUri = vscode.Uri.joinPath(dir, ".env.example");
        await assertWorkspaceOutputUri(exampleUri);
        await vscode.workspace.fs.writeFile(exampleUri, new TextEncoder().encode(example));
        return exampleUri;
    }

    /** All known placeholders (for output-scan reversal detection). */
    async knownPlaceholders(): Promise<string[]> {
        const vault = await this.readVault();
        return [...new Set(vault.entries.map((e) => e.placeholder))];
    }

    // ── Encrypted out-of-workspace backups ────────────────────────────────────
    // Backups use the same AES key as the vault and live in globalStorage under
    // `backups/`. Filenames are hash-derived so they leak neither the workspace
    // path nor the file name to other processes browsing globalStorage.

    private backupDir(): vscode.Uri {
        return vscode.Uri.joinPath(this.context.globalStorageUri, "backups");
    }

    private backupUri(fileUri: vscode.Uri): vscode.Uri {
        const id = createHash("sha256").update(fileUri.toString()).digest("hex").slice(0, 32);
        return vscode.Uri.joinPath(this.backupDir(), `${id}.enc`);
    }

    /** Write an encrypted pre-change backup of a file OUTSIDE the workspace. */
    private async writeEncryptedBackup(fileUri: vscode.Uri, content: string): Promise<void> {
        await vscode.workspace.fs.createDirectory(this.backupDir());
        const key = await this.getOrCreateKey();
        const payload = await encryptVault(
            JSON.stringify({ file: fileUri.toString(), savedAt: new Date().toISOString(), content }),
            key,
        );
        await vscode.workspace.fs.writeFile(this.backupUri(fileUri), new TextEncoder().encode(payload));
    }

    /** Restore a file from its encrypted backup. Returns false if none exists. */
    async restoreFromBackup(fileUri: vscode.Uri): Promise<boolean> {
        try {
            await assertWorkspaceFileUri(fileUri);
            const bytes = await vscode.workspace.fs.readFile(this.backupUri(fileUri));
            const key = await this.getOrCreateKey();
            const json = await decryptVault(new TextDecoder().decode(bytes), key);
            const parsed = JSON.parse(json) as { content?: string };
            if (typeof parsed.content !== "string") return false;
            const current = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
            this.assertDocumentReady(fileUri, current);
            await assertWorkspaceFileUri(fileUri);
            await this.writeDocumentOrFile(fileUri, current, parsed.content);
            return true;
        } catch {
            return false;
        }
    }

    private async runMutation<T>(operation: () => Promise<T>): Promise<T> {
        const result = VaultManager.mutationQueue.then(operation, operation);
        VaultManager.mutationQueue = result.then(() => undefined, () => undefined);
        return result;
    }

    private openDocument(fileUri: vscode.Uri): vscode.TextDocument | undefined {
        const key = fileUri.toString();
        return vscode.workspace.textDocuments.find((document) => document.uri.toString() === key);
    }

    private assertDocumentReady(fileUri: vscode.Uri, diskText: string): void {
        const document = this.openDocument(fileUri);
        if (!document) return;
        if (document.isDirty) {
            throw new Error("Save or discard the file's pending edits before vault migration.");
        }
        if (document.getText() !== diskText) {
            throw new Error("The open editor is out of sync with disk; reload it and retry.");
        }
    }

    private async writeDocumentOrFile(fileUri: vscode.Uri, original: string, next: string): Promise<void> {
        await assertWorkspaceFileUri(fileUri);
        const document = this.openDocument(fileUri);
        if (!document) {
            await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(next));
            return;
        }
        this.assertDocumentReady(fileUri, original);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(fileUri, new vscode.Range(document.positionAt(0), document.positionAt(original.length)), next);
        if (!await vscode.workspace.applyEdit(edit)) throw new Error("VS Code refused the protected file edit.");
        if (!await document.save()) throw new Error("VS Code could not save the protected file edit.");
    }
}

function isFileNotFound(error: unknown): boolean {
    const code = (error as { code?: unknown } | undefined)?.code;
    return code === "FileNotFound" || code === "ENOENT";
}

/** A masked, secret-free preview of a candidate value for display. */
function redactValuePreview(c: VaultCandidate): string {
    const v = c.rawValue;
    if (v.length <= 6) return "••••";
    return `${v.slice(0, 2)}${"•".repeat(Math.min(v.length - 4, 12))}${v.slice(-2)}`;
}
