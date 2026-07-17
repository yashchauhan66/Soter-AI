import * as vscode from "vscode";
import { createHash } from "crypto";
import {
    extractEnvSecrets,
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
            const bytes = await vscode.workspace.fs.readFile(this.vaultUri());
            const key = await this.getOrCreateKey();
            const json = await decryptVault(new TextDecoder().decode(bytes), key);
            const parsed = JSON.parse(json) as VaultFile;
            return { version: parsed.version ?? 1, entries: parsed.entries ?? [] };
        } catch {
            return { version: 1, entries: [] };
        }
    }

    private async writeVault(vault: VaultFile): Promise<void> {
        await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
        const key = await this.getOrCreateKey();
        const payload = await encryptVault(JSON.stringify(vault), key);
        await vscode.workspace.fs.writeFile(this.vaultUri(), new TextEncoder().encode(payload));
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
        const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
        const candidates = extractEnvSecrets(text);
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
        const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
        const candidates = extractEnvSecrets(text);
        if (candidates.length === 0) return 0;

        const rel = vscode.workspace.asRelativePath(fileUri);

        // 1. Encrypted backup before any destructive change.
        await this.writeEncryptedBackup(fileUri, text);

        // 2. Replace raw values with placeholders in the workspace file.
        const masked = applyPlaceholders(text, candidates);
        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(masked));

        // 3. Persist encrypted entries (metadata carries hash only; rawValue lives
        //    only inside the AES-GCM encrypted vault file).
        const vault = await this.readVault();
        for (const c of candidates) {
            const meta = await buildVaultMetadata(c, rel);
            // De-dupe on placeholder+file so re-migrating updates in place.
            vault.entries = vault.entries.filter(
                (e) => !(e.placeholder === meta.placeholder && e.originalFile === rel),
            );
            vault.entries.push({ ...meta, rawValue: c.rawValue });
        }
        await this.writeVault(vault);
        return candidates.length;
    }

    /**
     * Restore placeholders in a file back to their raw values using the vault.
     * Returns the number of placeholders restored.
     */
    async restore(fileUri: vscode.Uri): Promise<number> {
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
        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(restored));
        return count;
    }

    /** Produce a safe `.env.example` sibling from a file. Never writes secrets. */
    async writeEnvExample(fileUri: vscode.Uri): Promise<vscode.Uri> {
        const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
        const example = generateEnvExample(text);
        const dir = vscode.Uri.joinPath(fileUri, "..");
        const exampleUri = vscode.Uri.joinPath(dir, ".env.example");
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
            const bytes = await vscode.workspace.fs.readFile(this.backupUri(fileUri));
            const key = await this.getOrCreateKey();
            const json = await decryptVault(new TextDecoder().decode(bytes), key);
            const parsed = JSON.parse(json) as { content?: string };
            if (typeof parsed.content !== "string") return false;
            await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(parsed.content));
            return true;
        } catch {
            return false;
        }
    }
}

/** A masked, secret-free preview of a candidate value for display. */
function redactValuePreview(c: VaultCandidate): string {
    const v = c.rawValue;
    if (v.length <= 6) return "••••";
    return `${v.slice(0, 2)}${"•".repeat(Math.min(v.length - 4, 12))}${v.slice(-2)}`;
}
