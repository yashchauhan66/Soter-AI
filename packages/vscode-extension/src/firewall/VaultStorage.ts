import * as vscode from "vscode";
import * as path from "node:path";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, readdir, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { verifyExistingPath, verifyOutputPath } from "../security/FileSystemPathPolicy";
import { isPathWithin } from "../security/pathContainment";

export const VAULT_LIMIT = 2 * 1024 * 1024;
export const vaultUnavailable = (): never => { throw new Error("Protected vault operation withheld. Encrypted recovery is retained; no plaintext rollback was performed."); };
export const missing = (error: unknown): boolean => (error as { code?: string })?.code === "ENOENT";
export const samePath = (a: string, b: string): boolean => process.platform === "win32"
    ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b);
export const fileIdentity = (stat: { dev: number; ino: number; birthtimeMs: number; size: number; mtimeMs: number }): string =>
    JSON.stringify([process.platform === "win32" ? 0 : stat.dev, stat.ino, stat.birthtimeMs, stat.size, stat.mtimeMs]);

/** Strict JSON records reject duplicate/unknown keys at the consuming schema. */
export function vaultJson(text: string): unknown {
    const value: unknown = JSON.parse(text), tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
    const stack: Array<Set<string> | undefined> = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === "{") stack.push(new Set()); else if (token === "[") stack.push(undefined);
        else if (token === "}" || token === "]") stack.pop();
        else if (token.startsWith('"') && tokens[i + 1] === ":") {
            const keys = stack.at(-1), name = JSON.parse(token) as string;
            if (!keys || keys.has(name)) return vaultUnavailable(); keys.add(name);
        }
    }
    return value;
}
export function vaultObject(value: unknown, keys: string[], required = keys): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
        || Object.keys(value).some(key => !keys.includes(key)) || required.some(key => !Object.hasOwn(value, key))) return vaultUnavailable();
    return value as Record<string, unknown>;
}

/** Scoped storage and ordinary-file checks; this is not an OS isolation boundary. */
export class VaultStorage {
    constructor(readonly directory: string) {}
    private async safeDirectory(create: boolean): Promise<void> {
        if (!path.isAbsolute(this.directory)) return vaultUnavailable();
        const parent = path.dirname(this.directory);
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            if (folder.uri.scheme === "file" && isPathWithin(folder.uri.fsPath, this.directory)) return vaultUnavailable();
        }
        // Validate every existing ancestor before mkdir: a rejected project or
        // junction path must not gain even an empty extension storage directory.
        let existing = this.directory;
        while (true) {
            try { await lstat(existing); break; }
            catch (error) { if (!missing(error) || path.dirname(existing) === existing) throw error; existing = path.dirname(existing); }
        }
        let ancestor = existing;
        while (path.dirname(ancestor) !== ancestor) { if ((await lstat(ancestor)).isSymbolicLink()) return vaultUnavailable(); ancestor = path.dirname(ancestor); }
        const resolved = path.join(await realpath(existing), path.relative(existing, this.directory));
        if (!samePath(resolved, this.directory)) return vaultUnavailable();
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            if (folder.uri.scheme === "file" && isPathWithin(await realpath(folder.uri.fsPath), resolved)) return vaultUnavailable();
        }
        if (create) await mkdir(this.directory, { recursive: true });
        const canonical = await realpath(this.directory);
        if (!samePath(canonical, this.directory) || !(await lstat(this.directory)).isDirectory()
            || (await lstat(this.directory)).isSymbolicLink()) return vaultUnavailable();
        await verifyExistingPath(parent, this.directory);
        // Reject aliases in all existing directory components, not just the last one.
        let current = this.directory;
        while (path.dirname(current) !== current) { if ((await lstat(current)).isSymbolicLink()) return vaultUnavailable(); current = path.dirname(current); }
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            if (folder.uri.scheme === "file" && (isPathWithin(folder.uri.fsPath, canonical)
                || isPathWithin(await realpath(folder.uri.fsPath), canonical))) return vaultUnavailable();
        }
    }
    private name(name: string): string {
        if (!/^[A-Za-z0-9.-]{1,160}$/.test(name) || name === "." || name === "..") return vaultUnavailable();
        return path.join(this.directory, name);
    }
    async read(name: string, limit = VAULT_LIMIT): Promise<string | undefined> {
        try { await this.safeDirectory(false); } catch (error) { if (missing(error)) return undefined; throw error; }
        const target = this.name(name);
        try { await lstat(target); } catch (error) { if (missing(error)) return undefined; throw error; }
        // Once observed, an encrypted record disappearing is never an empty vault.
        await verifyExistingPath(this.directory, target); return (await readVaultFile(target, limit)).text;
    }
    async hasGenerations(): Promise<boolean> {
        try { await this.safeDirectory(false); } catch (error) { if (missing(error)) return false; throw error; }
        const entries = await readdir(this.directory); if (entries.length > 8192) return vaultUnavailable();
        return entries.some(name => /^vault-generation-[a-f0-9-]{36}\.enc$/i.test(name));
    }
    async write(name: string, text: string, exclusive = false): Promise<void> {
        if (Buffer.byteLength(text, "utf8") > VAULT_LIMIT) return vaultUnavailable();
        await this.safeDirectory(true); const target = this.name(name); await verifyOutputPath(this.directory, target);
        if (!exclusive) { const old = await this.read(name); if (old !== undefined) await verifyExistingPath(this.directory, target); }
        const temporary = exclusive ? target : this.name("write-" + randomUUID() + ".enc");
        const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
        try { await file.writeFile(text, "utf8"); await file.sync(); } finally { await file.close(); }
        if (!exclusive) { await this.safeDirectory(false); await verifyOutputPath(this.directory, target); await rename(temporary, target); }
        if (await this.read(name) !== text) return vaultUnavailable();
    }
    async remove(name: string, expected: string): Promise<void> {
        if (await this.read(name) !== expected) return vaultUnavailable();
        await unlink(this.name(name));
    }
    async lock<T>(operation: () => Promise<T>): Promise<T> {
        await this.safeDirectory(true);
        const name = "vault-mutation.lock", content = JSON.stringify({ schemaVersion: 1, pid: process.pid, nonce: randomUUID() });
        try { await this.write(name, content, true); }
        catch (error) {
            if ((error as { code?: string })?.code !== "EEXIST") throw error;
            const old = await this.read(name, 1024); if (!old) return vaultUnavailable();
            const owner = vaultObject(vaultJson(old), ["schemaVersion", "pid", "nonce"]);
            if (owner.schemaVersion !== 1 || !Number.isSafeInteger(owner.pid) || (owner.pid as number) <= 0
                || typeof owner.nonce !== "string" || !/^[a-f0-9-]{36}$/i.test(owner.nonce)) return vaultUnavailable();
            try { process.kill(owner.pid as number, 0); return vaultUnavailable(); }
            catch (probe) { if ((probe as { code?: string })?.code !== "ESRCH") throw probe; }
            await this.remove(name, old); await this.write(name, content, true);
        }
        try { return await operation(); }
        finally { await this.remove(name, content); }
    }
}

export async function readVaultFile(target: string, limit = 65536, ownerDamagedRecovery = false): Promise<{ text: string; identity: string }> {
    const before = await lstat(target);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > limit) return vaultUnavailable();
    const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const stat = await handle.stat(); if (fileIdentity(stat) !== fileIdentity(before)) return vaultUnavailable();
        const buffer = Buffer.alloc(limit + 1); let length = 0;
        while (length < buffer.length) { const result = await handle.read(buffer, length, buffer.length - length, length); if (!result.bytesRead) break; length += result.bytesRead; }
        if (length > limit || fileIdentity(await handle.stat()) !== fileIdentity(before) || fileIdentity(await lstat(target)) !== fileIdentity(before)) return vaultUnavailable();
        // Owner recovery binds exact bytes, including malformed UTF-8. Latin-1
        // is a private one-to-one byte representation, never a UI/tool preview.
        if (ownerDamagedRecovery) return { text: buffer.subarray(0, length).toString("latin1"), identity: fileIdentity(before) };
        const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, length));
        if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\uD800-\uDFFF]/u.test(text)) return vaultUnavailable();
        return { text, identity: fileIdentity(before) };
    } finally { await handle.close(); }
}
