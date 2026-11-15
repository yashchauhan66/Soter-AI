import { createHash } from "node:crypto";

/** Private source snapshots. Only the digest/count belong in approval metadata. */
export const VAULT_APP_ARTIFACT_LIMITS = Object.freeze({ modules: 64, fileBytes: 1024 * 1024,
    totalBytes: 4 * 1024 * 1024, imports: 128, pathBytes: 1024, astNodes: 65536 });
export interface VaultAppArtifactModule {
    readonly path: string;
    readonly kind: "commonjs" | "json";
    readonly source: string;
    readonly imports: readonly Readonly<{ specifier: string; target: string }>[];
}
export interface VaultAppArtifact {
    readonly schemaVersion: 1;
    readonly format: "commonjs-snapshot-v1";
    readonly entry: string;
    readonly modules: readonly VaultAppArtifactModule[];
    readonly digest: string;
}

// Builtins with file/network/process/loader authority are deliberately absent.
// The finite artifact profile performs computation and emits managed output.
export const VAULT_APP_ARTIFACT_BUILTINS: readonly string[] = Object.freeze([
    "node:assert", "node:assert/strict", "node:buffer", "node:crypto", "node:events",
    "node:path", "node:path/posix", "node:path/win32", "node:querystring", "node:string_decoder",
    "node:url", "node:util", "node:util/types",
]);
const fail = (): never => { throw Error("Managed application artifact unavailable. Review a bounded CommonJS bundle with static local imports."); };
const controls = /[\x00-\x1f\x7f-\x9f]/u;
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return fail();
    const fields = Object.getOwnPropertyDescriptors(value), own = Reflect.ownKeys(fields);
    if (own.length !== keys.length || own.some(key => typeof key !== "string" || !keys.includes(key)
        || !Object.hasOwn(fields[key], "value") || !fields[key].enumerable)) return fail();
    return Object.fromEntries(keys.map(key => [key, fields[key].value]));
}
function array(value: unknown, limit: number): unknown[] {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > limit) return fail();
    const fields = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(fields).length !== value.length + 1) return fail();
    return Array.from({ length: value.length }, (_, index) => {
        const field = fields[String(index)];
        if (!field || !Object.hasOwn(field, "value") || !field.enumerable) return fail();
        return field.value;
    });
}
export function vaultArtifactPath(value: unknown): string {
    if (typeof value !== "string" || !value || Buffer.byteLength(value) > VAULT_APP_ARTIFACT_LIMITS.pathBytes
        || controls.test(value) || /[\\:]/.test(value) || value.split("/").some(part => !part || part === "." || part === "..")
        || Buffer.from(value, "utf8").toString("utf8") !== value) return fail();
    return value;
}
export function vaultArtifactSpecifier(value: unknown): string {
    if (typeof value !== "string" || !value || Buffer.byteLength(value) > VAULT_APP_ARTIFACT_LIMITS.pathBytes
        || controls.test(value) || /[\\?#]/.test(value) || Buffer.from(value, "utf8").toString("utf8") !== value) return fail();
    if (VAULT_APP_ARTIFACT_BUILTINS.includes(value)) return value;
    if (!value.startsWith("./") && !value.startsWith("../") || value.includes(":")
        || !/\.(?:cjs|js|json)$/.test(value) || value.split("/").some(part => !part)) return fail();
    return value;
}

/** Construct a deterministic closed snapshot, copying only bounded own-data fields.
 * Syntax and canonical filesystem ownership are the host builder's responsibility. */
export function createVaultAppArtifact(entry: string, input: readonly VaultAppArtifactModule[]): VaultAppArtifact {
    const checkedEntry = vaultArtifactPath(entry); let bytes = 0;
    const paths = new Set<string>();
    const modules = array(input, VAULT_APP_ARTIFACT_LIMITS.modules).map(value => {
        const row = record(value, ["path", "kind", "source", "imports"]), file = vaultArtifactPath(row.path);
        if (paths.has(file.toLowerCase()) || row.kind !== "commonjs" && row.kind !== "json") return fail();
        paths.add(file.toLowerCase());
        if (typeof row.source !== "string" || Buffer.byteLength(row.source) > VAULT_APP_ARTIFACT_LIMITS.fileBytes
            || Buffer.from(row.source, "utf8").toString("utf8") !== row.source) return fail();
        bytes += Buffer.byteLength(row.source); if (bytes > VAULT_APP_ARTIFACT_LIMITS.totalBytes) return fail();
        const seen = new Set<string>();
        const imports = array(row.imports, VAULT_APP_ARTIFACT_LIMITS.imports).map(value => {
            const link = record(value, ["specifier", "target"]), specifier = vaultArtifactSpecifier(link.specifier);
            const target = specifier.startsWith("node:") ? specifier : vaultArtifactPath(link.target);
            if (link.target !== target || seen.has(specifier)) return fail(); seen.add(specifier);
            return Object.freeze({ specifier, target });
        }).sort((a, b) => a.specifier < b.specifier ? -1 : a.specifier > b.specifier ? 1 : 0);
        if (row.kind === "json" && imports.length) return fail();
        if (row.kind === "json") { try { JSON.parse(row.source); } catch { return fail(); } }
        return Object.freeze({ path: file, kind: row.kind, source: row.source, imports: Object.freeze(imports) });
    }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    const byPath = new Map(modules.map(row => [row.path, row]));
    if (!byPath.has(checkedEntry) || byPath.get(checkedEntry)!.kind !== "commonjs") return fail();
    const reached = new Set<string>(), pending = [checkedEntry];
    while (pending.length) {
        const file = pending.pop()!; if (reached.has(file)) continue; reached.add(file);
        const row = byPath.get(file); if (!row) return fail();
        for (const link of row.imports) if (!link.target.startsWith("node:")) pending.push(link.target);
    }
    if (reached.size !== modules.length) return fail();
    const payload = { schemaVersion: 1 as const, format: "commonjs-snapshot-v1" as const, entry: checkedEntry, modules: Object.freeze(modules) };
    return Object.freeze({ ...payload, digest: createHash("sha256").update(JSON.stringify(payload)).digest("hex") });
}

export function parseVaultAppArtifact(value: unknown): VaultAppArtifact | undefined {
    try {
        const row = record(value, ["schemaVersion", "format", "entry", "modules", "digest"]);
        if (row.schemaVersion !== 1 || row.format !== "commonjs-snapshot-v1" || typeof row.entry !== "string"
            || typeof row.digest !== "string" || !/^[a-f0-9]{64}$/.test(row.digest)) return undefined;
        const artifact = createVaultAppArtifact(row.entry, row.modules as VaultAppArtifactModule[]);
        return artifact.digest === row.digest ? artifact : undefined;
    } catch { return undefined; }
}
