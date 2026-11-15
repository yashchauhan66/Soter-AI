import * as path from "node:path";
import { constants, openSync, closeSync, fstatSync, lstatSync, realpathSync, readSync, readdirSync, type Stats } from "node:fs";
import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";
import { isPathWithin } from "../../../core/src/pathContainment";
import type { VaultAppDescriptor } from "../../../core/src/VaultAppDescriptor";
import { createVaultAppArtifact, VAULT_APP_ARTIFACT_LIMITS, vaultArtifactPath, type VaultAppArtifact, type VaultAppArtifactModule } from "../../../core/src/VaultAppArtifact";
import { fileIdentity, samePath, vaultUnavailable } from "../firewall/VaultStorage";
import { artifactImports } from "./ArtifactImports";

/** Private synchronous binding. Source bytes remain in private snapshots;
 * the finite artifact profile never resolves modules from the live filesystem. */
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
const importCache = new Map<string, { bytes: number; imports: readonly string[] }>();
let importCacheBytes = 0;
function checkedImports(source: string, digest: string, bytes: number): readonly string[] {
    const cached = importCache.get(digest); if (cached) return cached.imports;
    const imports = artifactImports(source);
    // Repeated live guards still reread/hash every file. Only parse-only results
    // for exactly identical bytes are cached, within the same closure bounds.
    while (importCache.size >= VAULT_APP_ARTIFACT_LIMITS.modules || importCacheBytes + bytes > VAULT_APP_ARTIFACT_LIMITS.totalBytes) {
        const key = importCache.keys().next().value as string | undefined; if (key === undefined) break;
        importCacheBytes -= importCache.get(key)!.bytes; importCache.delete(key);
    }
    importCache.set(digest, { bytes, imports }); importCacheBytes += bytes; return imports;
}
/** Capture the complete supported dependency closure before approval. Reads are
 * canonical, single-link, bounded and rechecked after the last module is read.
 * The returned immutable bytes, rather than these paths, are the runnable app. */
export function captureRuntimeArtifact(root: string, program: string): VaultAppArtifact {
    canonical(root, program);
    const entry = vaultArtifactPath(path.relative(root, program).split(path.sep).join("/"));
    const pending = [entry], modules = new Map<string, VaultAppArtifactModule>();
    const reads = new Map<string, { identity: string; digest: string }>();
    let bytes = 0;
    while (pending.length) {
        const relative = pending.pop()!; if (modules.has(relative)) continue;
        if (modules.size >= VAULT_APP_ARTIFACT_LIMITS.modules || !/\.(?:cjs|js|json)$/.test(relative)) return vaultUnavailable();
        const absolute = path.resolve(root, ...relative.split("/")), captured = file(root, absolute, VAULT_APP_ARTIFACT_LIMITS.fileBytes);
        bytes += captured.bytes.length; if (bytes > VAULT_APP_ARTIFACT_LIMITS.totalBytes) return vaultUnavailable();
        const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(captured.bytes);
        if (Buffer.from(source, "utf8").compare(captured.bytes) !== 0) return vaultUnavailable();
        const kind = relative.endsWith(".json") ? "json" as const : "commonjs" as const;
        const digest = createHash("sha256").update(captured.bytes).digest("hex");
        const imports = (kind === "commonjs" ? checkedImports(source, digest, captured.bytes.length) : []).map(specifier => {
            const target = specifier.startsWith("node:") ? specifier
                : vaultArtifactPath(path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier)));
            if (!target.startsWith("node:")) pending.push(target);
            return { specifier, target };
        });
        modules.set(relative, { path: relative, kind, source, imports });
        reads.set(relative, { identity: captured.identity, digest });
    }
    const artifact = createVaultAppArtifact(entry, [...modules.values()]);
    for (const [relative, expected] of reads) {
        const current = file(root, path.resolve(root, ...relative.split("/")), VAULT_APP_ARTIFACT_LIMITS.fileBytes);
        if (current.identity !== expected.identity || createHash("sha256").update(current.bytes).digest("hex") !== expected.digest) return vaultUnavailable();
    }
    return artifact;
}
export function runtimeBinding(descriptor: VaultAppDescriptor): { source: string; identity: string; programIdentity: string; artifactDigest: string; cwdIdentity: string; rootIdentity: string } {
    canonical(descriptor.root, descriptor.cwd);
    const root = lstatSync(descriptor.root), cwd = lstatSync(descriptor.cwd);
    if (!root.isDirectory() || !cwd.isDirectory()) return vaultUnavailable();
    const app = file(descriptor.root, descriptor.program, 1024 * 1024), source = file(descriptor.root, descriptor.source, 65536);
    if (createHash("sha256").update(app.bytes).digest("hex") !== descriptor.programDigest) return vaultUnavailable();
    const artifact = captureRuntimeArtifact(descriptor.root, descriptor.program);
    if (artifact.digest !== descriptor.artifactDigest) return vaultUnavailable();
    return { source: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(source.bytes), identity: source.identity,
        programIdentity: app.identity, artifactDigest: artifact.digest, cwdIdentity: directoryIdentity(cwd), rootIdentity: directoryIdentity(root) };
}
export function runtimeStoreUnchanged(directory: string, expected: string): boolean {
    try {
        if (readdirSync(directory).some(name => name.startsWith("vault-portable-"))) return false;
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
