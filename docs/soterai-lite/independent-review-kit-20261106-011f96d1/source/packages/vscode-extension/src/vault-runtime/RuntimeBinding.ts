import * as path from "node:path";
import { constants, openSync, closeSync, fstatSync, lstatSync, realpathSync, readSync, type Stats } from "node:fs";
import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";
import { isPathWithin } from "../../../core/src/pathContainment";
import type { VaultAppDescriptor } from "../../../core/src/VaultAppDescriptor";
import { fileIdentity, samePath, vaultUnavailable } from "../firewall/VaultStorage";

/** Private synchronous final binding. No source contents/digests are returned
 * through commands. Dependencies are owner-reviewed app behavior, not locked. */
function canonical(root: string, target: string): void {
    if (!isPathWithin(root, target) || !samePath(root, realpathSync(root)) || !samePath(target, realpathSync(target))) return vaultUnavailable();
    let component = target;
    while (true) {
        if (lstatSync(component).isSymbolicLink()) return vaultUnavailable();
        const next = path.dirname(component); if (next === component) break; component = next;
    }
}
function file(root: string, target: string, limit: number): { bytes: Buffer; identity: string } {
    canonical(root, target); const descriptor = openSync(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const before = fstatSync(descriptor);
        if (!before.isFile() || before.nlink !== 1 || before.size > limit || before.size < 0) return vaultUnavailable();
        // One bounded allocation even if another writer grows the file after
        // stat; never read an unbounded file-until-EOF into a private guard.
        const buffer = Buffer.alloc(before.size + 1); let used = 0;
        while (used < buffer.length) { const count = readSync(descriptor, buffer, used, buffer.length - used, used); if (!count) break; used += count; }
        const bytes = buffer.subarray(0, used), after = fstatSync(descriptor);
        if (used !== before.size || used > limit || fileIdentity(before) !== fileIdentity(after) || fileIdentity(after) !== fileIdentity(lstatSync(target))) return vaultUnavailable();
        canonical(root, target); return { bytes, identity: fileIdentity(after) };
    } finally { closeSync(descriptor); }
}
const directoryIdentity = (stat: Stats): string => JSON.stringify([process.platform === "win32" ? 0 : stat.dev, stat.ino, stat.birthtimeMs]);
export function runtimeBinding(descriptor: VaultAppDescriptor): { source: string; identity: string; programIdentity: string; cwdIdentity: string; rootIdentity: string } {
    canonical(descriptor.root, descriptor.cwd);
    const root = lstatSync(descriptor.root), cwd = lstatSync(descriptor.cwd);
    if (!root.isDirectory() || !cwd.isDirectory()) return vaultUnavailable();
    const app = file(descriptor.root, descriptor.program, 1024 * 1024), source = file(descriptor.root, descriptor.source, 65536);
    if (createHash("sha256").update(app.bytes).digest("hex") !== descriptor.programDigest) return vaultUnavailable();
    return { source: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(source.bytes), identity: source.identity,
        programIdentity: app.identity, cwdIdentity: directoryIdentity(cwd), rootIdentity: directoryIdentity(root) };
}
export function runtimeStoreUnchanged(directory: string, expected: string): boolean {
    try {
        try { lstatSync(path.join(directory, "vault-pending.json")); return false; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") return false; }
        return file(directory, path.join(directory, "soterai-vault.enc"), 2 * 1024 * 1024).bytes.toString("utf8") === expected;
    } catch { return false; }
}
export function runtimePolicyBinding(root: string): string {
    return JSON.stringify([".aiignore", ".soterai/policy.json", ".soterai/team-policy.json"].map(relative => {
        const target = path.join(root, relative);
        try { lstatSync(target); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return [relative, null]; throw error; }
        const record = file(root, target, relative.endsWith("team-policy.json") ? 131072 : 65536);
        return [relative, record.identity, createHash("sha256").update(record.bytes).digest("hex")];
    }));
}
