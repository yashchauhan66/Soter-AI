import { createHash } from "node:crypto";
import { TextDecoder, types } from "node:util";

export const PRE_PUSH_LIMITS = Object.freeze({ refs: 32, transcriptBytes: 32768, refBytes: 1024,
    commits: 32, blobs: 128, entries: 4096, blobBytes: 65536, totalBytes: 1048576, stderrBytes: 8192, milliseconds: 60000 });
export interface PrePushUpdate { readonly localRef: string; readonly localOid: string; readonly remoteRef: string; readonly remoteOid: string; readonly deletion: boolean }
const length = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!.get!;
const zero = "0".repeat(40), oid = /^[a-f0-9]{40}$/;
const unsafe = /[\p{White_Space}\p{Cc}\p{Cf}\u2028\u2029]/u;
function branch(value: string): boolean {
    return value.startsWith("refs/heads/") && Buffer.byteLength(value) <= PRE_PUSH_LIMITS.refBytes && value.normalize("NFC") === value
        && !unsafe.test(value) && !/[~^:?*\[\\]|\.\.|@\{/.test(value)
        && value.split("/").every(part => !!part && !/^[.-]|\.$|\.lock$/i.test(part));
}
function copy(raw: unknown): Buffer | undefined {
    if (!types.isUint8Array(raw) || !Buffer.isBuffer(raw)) return undefined;
    const size: number = length.call(raw); if (size > PRE_PUSH_LIMITS.transcriptBytes) return undefined;
    const bytes = Buffer.alloc(size); Uint8Array.prototype.set.call(bytes, raw); return bytes;
}
/** Complete private Git stdin framing only. No ref expression is evaluated and
 * no caller metadata grants filesystem, process, owner or push authority. */
export function parsePrePushTranscript(raw: Buffer): readonly Readonly<PrePushUpdate>[] | undefined {
    try {
        const bytes = copy(raw); if (!bytes) return undefined;
        const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
        if (!text) return Object.freeze([]); if (!text.endsWith("\n")) return undefined;
        const lines = text.slice(0, -1).split("\n"); if (lines.length > PRE_PUSH_LIMITS.refs) return undefined;
        const result: Readonly<PrePushUpdate>[] = [], targets = new Set<string>();
        for (const line of lines) {
            const fields = line.split(" "); if (fields.length !== 4) return undefined;
            const [localRef, localOid, remoteRef, remoteOid] = fields;
            if (!localRef || Buffer.byteLength(localRef) > PRE_PUSH_LIMITS.refBytes || unsafe.test(localRef)
                || !oid.test(localOid) || !oid.test(remoteOid) || !branch(remoteRef)) return undefined;
            const deletion = localOid === zero;
            if ((localRef === "(delete)") !== deletion || deletion && remoteOid === zero) return undefined;
            const target = remoteRef.toLowerCase(); if (targets.has(target)) return undefined; targets.add(target);
            result.push(Object.freeze({ localRef, localOid, remoteRef, remoteOid, deletion }));
        }
        return Object.freeze(result);
    } catch { return undefined; }
}
export function prePushTranscriptDigest(raw: Buffer): string | undefined {
    try { const bytes = copy(raw); return bytes && parsePrePushTranscript(bytes) ? createHash("sha256").update(bytes).digest("hex") : undefined; }
    catch { return undefined; }
}
