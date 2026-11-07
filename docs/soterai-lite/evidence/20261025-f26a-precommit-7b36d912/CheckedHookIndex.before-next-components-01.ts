import { createHash } from "node:crypto";
import { lstatSync, realpathSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { TextDecoder } from "node:util";
import { prepareCheckedGitMetadata, type CheckedGitMetadata } from "../terminal/CheckedGitMetadata";
import { parseStagedEntries, PRE_COMMIT_LIMITS, type StagedEntry } from "./PreCommitProtocol";

export interface CheckedHookIndex {
    readonly root: string; readonly indexFile: string; readonly metadata: CheckedGitMetadata;
    readonly environment: NodeJS.ProcessEnv; readonly entries: readonly StagedEntry[]; available(): boolean;
}
const genuine = new WeakSet<object>(), sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const same = (a: string, b: string) => process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
const unavailable = (): never => { throw Error("Effective index unavailable."); };
export function isCheckedHookIndex(value: unknown): value is CheckedHookIndex { return !!value && typeof value === "object" && genuine.has(value); }
function identity(file: string, directory: boolean): string {
    if (!path.isAbsolute(file) || /^[\\/]{2}|[\x00-\x1f\x7f-\x9f\p{Cf}]/u.test(file) || !same(realpathSync(file), file)) return unavailable();
    let cursor = file;
    for (;;) { if (lstatSync(cursor).isSymbolicLink()) return unavailable(); const parent = path.dirname(cursor); if (parent === cursor) break; cursor = parent; }
    const stat = lstatSync(file);
    if (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1) return unavailable();
    return JSON.stringify(directory ? [stat.ino, stat.birthtimeMs] : [stat.ino, stat.birthtimeMs, stat.size, stat.mtimeMs, stat.ctimeMs, stat.nlink]);
}
function selected(root: string, value: unknown): string {
    if (typeof root !== "string" || !path.isAbsolute(root) || !same(path.normalize(root), root) || /^[\\/]{2}/.test(root)) return unavailable();
    let file: string;
    if (value === undefined) file = path.join(root, ".git", "index");
    else {
        if (typeof value !== "string" || !value || value.length > 2048 || /[\x00-\x1f\x7f-\x9f\p{Cf}]/u.test(value) || /^[\\/]{2}/.test(value)) return unavailable();
        if (path.isAbsolute(value)) { if (!same(path.normalize(value), value)) return unavailable(); file = value; }
        else { if (/[\\:]/.test(value)) return unavailable(); file = path.resolve(root, ...value.split("/")); }
        const components = value.replace(/^[A-Za-z]:[\\/]/, "").split(/[\\/]/);
        if (components.some(part => !part || part === "." || part === ".." || /[. ]$|[<>:"|?*]|~[0-9]+(?:\.|$)/i.test(part)
            || /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$|clock\$)(?:\.|$)/i.test(part))) return unavailable();
    }
    const git = path.join(root, ".git"), relative = path.relative(git, file);
    if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) return unavailable();
    return file;
}
function entries(bytes: Buffer): readonly StagedEntry[] {
    if (bytes.length < 32 || bytes.length > 4194304 || bytes.toString("ascii", 0, 4) !== "DIRC"
        || ![2, 3].includes(bytes.readUInt32BE(4)) || bytes.readUInt32BE(8) > PRE_COMMIT_LIMITS.entries
        || !createHash("sha1").update(bytes.subarray(0, -20)).digest().equals(bytes.subarray(-20))) return unavailable();
    const end = bytes.length - 20, rows: string[] = []; let cursor = 12, listingBytes = 0;
    for (let remaining = bytes.readUInt32BE(8); remaining > 0; remaining--) {
        if (cursor + 62 >= end) return unavailable();
        const start = cursor, flags = bytes.readUInt16BE(cursor + 60), mode = bytes.readUInt32BE(cursor + 24);
        if (flags & 0x7000 || ![0o100644, 0o100755].includes(mode)) return unavailable();
        const terminator = bytes.indexOf(0, cursor + 62);
        if (terminator < cursor + 62 || terminator >= end || terminator - cursor - 62 !== (flags & 0xfff)) return unavailable();
        const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(cursor + 62, terminator));
        const next = start + Math.ceil((terminator + 1 - start) / 8) * 8;
        if (next > end || bytes.subarray(terminator, next).some(value => value !== 0)) return unavailable();
        const row = mode.toString(8) + " " + bytes.toString("hex", cursor + 40, cursor + 60) + " 0\t" + source + "\0";
        listingBytes += Buffer.byteLength(row); if (listingBytes > PRE_COMMIT_LIMITS.listingBytes) return unavailable(); rows.push(row); cursor = next;
    }
    const extensions = new Set<string>();
    while (cursor < end) {
        if (cursor + 8 > end) return unavailable();
        const name = bytes.toString("ascii", cursor, cursor + 4), length = bytes.readUInt32BE(cursor + 4);
        if (!["TREE", "REUC"].includes(name) || extensions.has(name) || length > end - cursor - 8) return unavailable();
        extensions.add(name); cursor += 8 + length;
    }
    const parsed = parseStagedEntries(Buffer.from(rows.join(""))); if (!parsed) return unavailable(); return parsed;
}
function capture(root: string, file: string): Readonly<{ stamp: string; bytes: Buffer }> {
    const parents: string[] = []; let cursor = path.dirname(file);
    for (;;) { parents.push(identity(cursor, true)); if (same(cursor, root)) break; const next = path.dirname(cursor); if (next === cursor) return unavailable(); cursor = next; }
    const before = identity(file, false); if (lstatSync(file).size > 4194304) return unavailable();
    const bytes = readFileSync(file); if (bytes.length > 4194304 || identity(file, false) !== before) return unavailable();
    return Object.freeze({ bytes, stamp: sha(JSON.stringify([file, parents, before, sha(bytes)])) });
}
/** Builds new metadata authority for this exact root. No caller-provided
 * repository descriptor, ambient index authority, worktree fallback or Git child. */
export async function prepareCheckedHookIndex(root: string, indexPath: unknown, ambient: NodeJS.ProcessEnv,
    enabled: () => boolean): Promise<CheckedHookIndex | undefined> {
    let live = true;
    const guard = () => { if (!live) return false; try { live = enabled() === true; } catch { live = false; } return live; };
    try {
        if (!guard()) return undefined;
        const file = selected(root, indexPath), before = capture(root, file), parsed = entries(before.bytes);
        const metadata = await prepareCheckedGitMetadata(root, ambient, guard);
        if (!metadata || !guard()) return undefined;
        const environment = Object.freeze({ ...metadata.environment, GIT_INDEX_FILE: file });
        const available = () => {
            if (!guard()) return false;
            try { live = metadata.available() && capture(root, file).stamp === before.stamp; } catch { live = false; }
            return live;
        };
        const descriptor = Object.freeze({ root, indexFile: file, metadata, environment, entries: parsed, available });
        if (!available()) return undefined; genuine.add(descriptor); return descriptor;
    } catch { live = false; return undefined; }
}
