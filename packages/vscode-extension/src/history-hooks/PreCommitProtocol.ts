import { TextDecoder, types } from "node:util";

export interface StagedEntry { readonly path: string; readonly oid: string; readonly mode: "100644" | "100755" }
export const PRE_COMMIT_LIMITS = Object.freeze({ entries: 128, listingBytes: 262144, pathBytes: 2048,
    componentUnits: 255, blobBytes: 65536, totalBytes: 1048576, stderrBytes: 8192, milliseconds: 60000 });
const byteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!.get!;
const unsafe = /[<>:"\\|?*\p{Cc}\p{Cf}\u2028\u2029]/u;
const device = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$|clock\$)(?:\.|$)/i;

/** Private framing only: no filesystem/index/object authority or commit decision.
 * Refuse a whole listing on unknown input; never return an admitted prefix. */
export function parseStagedEntries(raw: Buffer): readonly Readonly<StagedEntry>[] | undefined {
    try {
        // Native view admission precedes property access, including for proxies
        // and lookalikes. Copy underlying bytes without caller method/coercion.
        if (!types.isUint8Array(raw) || !Buffer.isBuffer(raw)) return undefined;
        const size: number = byteLength.call(raw);
        if (size > PRE_COMMIT_LIMITS.listingBytes) return undefined;
        const copy = new Uint8Array(size); Uint8Array.prototype.set.call(copy, raw);
        const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(copy);
        if (!text) return Object.freeze([]);
        if (!text.endsWith("\0")) return undefined;
        const rows = text.slice(0, -1).split("\0");
        if (rows.length > PRE_COMMIT_LIMITS.entries) return undefined;
        const paths = new Set<string>(), directories = new Set<string>(), entries: Readonly<StagedEntry>[] = [];
        for (const row of rows) {
            const match = /^(100644|100755) ([a-f0-9]{40}) 0\t([^\0]+)$/u.exec(row);
            if (!match) return undefined;
            const relative = match[3];
            if (Buffer.byteLength(relative, "utf8") > PRE_COMMIT_LIMITS.pathBytes || unsafe.test(relative)) return undefined;
            const components = relative.split("/");
            if (components.some(part => !part || part === "." || part === ".." || part.length > PRE_COMMIT_LIMITS.componentUnits
                || /[. ]$/.test(part) || part.toLowerCase() === ".git" || device.test(part) || /~[0-9]+(?:\.|$)/i.test(part))) return undefined;
            const key = relative.normalize("NFC").toLowerCase();
            if (paths.has(key) || directories.has(key)) return undefined;
            let parent = "";
            for (const component of key.split("/").slice(0, -1)) {
                parent = parent ? parent + "/" + component : component;
                if (paths.has(parent)) return undefined;
                directories.add(parent);
            }
            paths.add(key);
            entries.push(Object.freeze({ path: relative, oid: match[2], mode: match[1] as StagedEntry["mode"] }));
        }
        return Object.freeze(entries);
    } catch { return undefined; }
}

/** Exact private batch-check framing. Expected identities are data, never argv. */
export function parsePreCommitSizes(raw: Buffer, oids: readonly string[]): readonly Readonly<{ oid: string; size: number }>[] | undefined {
    try {
        if (!types.isUint8Array(raw) || !Buffer.isBuffer(raw) || byteLength.call(raw) > 12288
            || !oids || typeof oids !== "object" || types.isProxy(oids) || !Array.isArray(oids)
            || Object.getPrototypeOf(oids) !== Array.prototype) return undefined;
        const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(oids), count = fields.length.value;
        if (!Number.isSafeInteger(count) || count < 1 || count > PRE_COMMIT_LIMITS.entries || Reflect.ownKeys(oids).length !== count + 1
            || Object.values(fields).some(field => field.get || field.set)) return undefined;
        const expected: string[] = [], seen = new Set<string>();
        for (let i = 0; i < count; i++) {
            const id = fields[String(i)]?.value;
            if (typeof id !== "string" || !/^[a-f0-9]{40}$/.test(id) || seen.has(id)) return undefined;
            seen.add(id); expected.push(id);
        }
        const copy = new Uint8Array(byteLength.call(raw)); Uint8Array.prototype.set.call(copy, raw);
        const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(copy);
        if (!text.endsWith("\n")) return undefined;
        const rows = text.slice(0, -1).split("\n"); if (rows.length !== count) return undefined;
        let total = 0; const result: Readonly<{ oid: string; size: number }>[] = [];
        for (let i = 0; i < rows.length; i++) {
            const match = /^([a-f0-9]{40}) blob (0|[1-9][0-9]*)$/.exec(rows[i]);
            if (!match || match[1] !== expected[i]) return undefined;
            const size = Number(match[2]);
            if (!Number.isSafeInteger(size) || size > PRE_COMMIT_LIMITS.blobBytes) return undefined;
            total += size; if (total > PRE_COMMIT_LIMITS.totalBytes) return undefined;
            result.push(Object.freeze({ oid: match[1], size }));
        }
        return Object.freeze(result);
    } catch { return undefined; }
}
