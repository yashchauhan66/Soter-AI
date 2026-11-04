import { createHash } from "node:crypto";

/** Private wire parsing only. Bodies and paths must never become command results. */
export const HISTORY_LIMITS = Object.freeze({ commits: 32, blobs: 128, blobBytes: 65536, totalBytes: 1048576,
    treeBytes: 262144, listBytes: 4096, stderrBytes: 8192, milliseconds: 60000 });
export interface HistoryBlobIdentity { readonly oid: string; readonly size: number }
export interface HistoryTreeBlob extends HistoryBlobIdentity { readonly source: string }
const OID = /^[a-f0-9]{40}$/;
const unavailable = (): never => { throw new Error("History data unavailable; existing protection is preserved."); };
function bounded(value: Uint8Array, maximum: number): Buffer {
    if (!(value instanceof Uint8Array) || value.byteLength > maximum) return unavailable();
    return Buffer.from(value);
}
function utf8(value: Uint8Array): string { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(value); }
const decimal = (value: string): number => {
    if (!/^(?:0|[1-9][0-9]*)$/.test(value)) return unavailable();
    const number = Number(value); if (!Number.isSafeInteger(number) || number < 0) return unavailable(); return number;
};

export function parseHistoryCommitList(value: Uint8Array): Readonly<{ commits: readonly string[]; capped: boolean }> {
    try {
        const bytes = bounded(value, HISTORY_LIMITS.listBytes);
        if (!bytes.length) return Object.freeze({ commits: Object.freeze([]), capped: false });
        const text = utf8(bytes); if (!text.endsWith("\n")) return unavailable();
        const commits = text.slice(0, -1).split("\n").map(line => line.endsWith("\r") ? line.slice(0, -1) : line);
        if (commits.length > HISTORY_LIMITS.commits + 1 || !commits.every(oid => OID.test(oid)) || new Set(commits).size !== commits.length) return unavailable();
        return Object.freeze({ commits: Object.freeze(commits.slice(0, HISTORY_LIMITS.commits)), capped: commits.length > HISTORY_LIMITS.commits });
    } catch { return unavailable(); }
}

export function parseHistoryTree(value: Uint8Array): Readonly<{ blobs: readonly HistoryTreeBlob[]; skipped: number }> {
    try {
        const bytes = bounded(value, HISTORY_LIMITS.treeBytes), blobs: HistoryTreeBlob[] = [];
        let cursor = 0, entries = 0, skipped = 0;
        while (cursor < bytes.length) {
            if (++entries > 4096) return unavailable();
            const end = bytes.indexOf(0, cursor), tab = bytes.indexOf(9, cursor);
            if (end <= cursor || tab <= cursor || tab >= end || tab - cursor > 96) return unavailable();
            const header = /^(100644|100755|120000|160000) (blob|commit) ([a-f0-9]{40}) +([0-9]+|-)$/u.exec(utf8(bytes.subarray(cursor, tab)));
            if (!header) return unavailable();
            const name = bytes.subarray(tab + 1, end); if (!name.length || name.length > 2048) return unavailable();
            const source = utf8(name);
            if (/^[\/]|[\\:\x00-\x1f\x7f-\x9f]/u.test(source) || source.split("/").some(part => !part || part === "." || part === "..")) return unavailable();
            const [, mode, type, oid, length] = header;
            if (mode === "160000") { if (type !== "commit" || length !== "-") return unavailable(); skipped++; }
            else {
                if (type !== "blob") return unavailable(); const size = decimal(length);
                if (mode === "120000") skipped++;
                else blobs.push(Object.freeze({ oid, size, source }));
            }
            cursor = end + 1;
        }
        return Object.freeze({ blobs: Object.freeze(blobs), skipped });
    } catch { return unavailable(); }
}

/** Exact byte framing and object identity, without interpreting blob contents. */
export function parseHistoryBatch(value: Uint8Array, expected: readonly HistoryBlobIdentity[]): readonly Readonly<{ oid: string; bytes: Buffer }>[] {
    try {
        if (!Array.isArray(expected) || expected.length > HISTORY_LIMITS.blobs) return unavailable();
        let total = 0; const identities = new Set<string>();
        for (const request of expected) {
            if (!request || ![Object.prototype, null].includes(Object.getPrototypeOf(request))
                || Object.keys(request).sort().join(",") !== "oid,size" || Object.values(Object.getOwnPropertyDescriptors(request)).some(field => field.get || field.set)
                || typeof request.oid !== "string" || !OID.test(request.oid) || identities.has(request.oid)
                || !Number.isSafeInteger(request.size) || request.size < 0 || request.size > HISTORY_LIMITS.blobBytes) return unavailable();
            identities.add(request.oid); total += request.size; if (total > HISTORY_LIMITS.totalBytes) return unavailable();
        }
        const bytes = bounded(value, HISTORY_LIMITS.totalBytes + HISTORY_LIMITS.blobs * 96), result: Array<Readonly<{ oid: string; bytes: Buffer }>> = [];
        let cursor = 0;
        for (const request of expected) {
            const end = bytes.indexOf(10, cursor); if (end <= cursor || end - cursor > 96) return unavailable();
            const header = /^([a-f0-9]{40}) blob (0|[1-9][0-9]*)$/u.exec(utf8(bytes.subarray(cursor, end)));
            if (!header || header[1] !== request.oid || decimal(header[2]) !== request.size) return unavailable();
            const start = end + 1, next = start + request.size;
            if (next >= bytes.length || bytes[next] !== 10) return unavailable();
            const body = bytes.subarray(start, next);
            if (createHash("sha1").update("blob " + request.size + "\0").update(body).digest("hex") !== request.oid) return unavailable();
            result.push(Object.freeze({ oid: request.oid, bytes: Buffer.from(body) })); cursor = next + 1;
        }
        if (cursor !== bytes.length) return unavailable();
        return Object.freeze(result);
    } catch { return unavailable(); }
}

export function decodeHistoryBlob(value: Uint8Array): string | undefined {
    const bytes = bounded(value, HISTORY_LIMITS.blobBytes);
    try { const text = utf8(bytes); return /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(text) ? undefined : text; }
    catch { return undefined; }
}
