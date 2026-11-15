import * as vscode from "vscode";
import * as path from "node:path";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { RECOVERY_ENVELOPE_LIMITS } from "../../../core/src/RecoveryEnvelope";
import { isPathWithin } from "../../../core/src/pathContainment";
import { readVaultFile, samePath, vaultUnavailable } from "./VaultStorage";

type Parent = { path: string; identity: string };
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const identity = (value: { dev: number; ino: number; birthtimeMs: number }) => JSON.stringify([value.dev, value.ino, value.birthtimeMs]);
export class PortableRecoveryFile {
    private constructor(readonly uri: vscode.Uri, private readonly storage: string, private readonly parents: readonly Parent[]) {}
    static async capture(uri: vscode.Uri, storage: string): Promise<PortableRecoveryFile> {
        if (!(uri instanceof vscode.Uri) || uri.scheme !== "file" || uri.authority || uri.query || uri.fragment
            || !path.isAbsolute(uri.fsPath) || /[\x00-\x1f\x7f]/.test(uri.fsPath)) return vaultUnavailable();
        const parents: Parent[] = [];
        for (let directory = path.dirname(uri.fsPath);; directory = path.dirname(directory)) {
            if (parents.length >= 64) return vaultUnavailable();
            const stat = await lstat(directory);
            if (!stat.isDirectory() || stat.isSymbolicLink() || !samePath(await realpath(directory), directory)) return vaultUnavailable();
            parents.push({ path: directory, identity: identity(stat) });
            if (path.dirname(directory) === directory) break;
        }
        const result = new PortableRecoveryFile(uri, storage, parents);
        await result.fresh(); return result;
    }
    async fresh(): Promise<void> {
        if (isPathWithin(this.storage, this.uri.fsPath)) return vaultUnavailable();
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            if (folder.uri.scheme !== "file" || isPathWithin(folder.uri.fsPath, this.uri.fsPath)
                || isPathWithin(await realpath(folder.uri.fsPath), this.uri.fsPath)) return vaultUnavailable();
        }
        for (const parent of this.parents) {
            const stat = await lstat(parent.path);
            if (!stat.isDirectory() || stat.isSymbolicLink() || identity(stat) !== parent.identity || !samePath(await realpath(parent.path), parent.path)) return vaultUnavailable();
        }
    }
    async read(): Promise<{ bytes: Uint8Array; identity: string; sha256: string }> {
        await this.fresh(); const value = await readVaultFile(this.uri.fsPath, RECOVERY_ENVELOPE_LIMITS.maxEnvelopeBytes);
        await this.fresh(); const bytes = Buffer.from(value.text, "utf8");
        return { bytes, identity: value.identity, sha256: digest(bytes) };
    }
    async create(bytes: Uint8Array): Promise<void> {
        if (bytes.byteLength > RECOVERY_ENVELOPE_LIMITS.maxEnvelopeBytes) return vaultUnavailable();
        await this.fresh();
        const handle = await open(this.uri.fsPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
        try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
        const stored = await this.read(); if (stored.sha256 !== digest(bytes)) return vaultUnavailable();
    }
}
