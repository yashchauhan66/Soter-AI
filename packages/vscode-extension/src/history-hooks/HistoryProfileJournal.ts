import fs, { type Stats } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import * as path from "node:path";
import { verifyOutputPath } from "../security/FileSystemPathPolicy";
import { parseHistoryProfileReceipt, type HistoryProfileReceipt } from "./HistoryProfileTransaction";

export const HISTORY_PROFILE_JOURNAL = "psreadline-history-state-v1.json";
const unavailable = () => Error("History journal unavailable.");
const comparable = (name: string) => process.platform === "win32" ? path.resolve(name).toLowerCase() : path.resolve(name);
const stamp = (s: Stats) => [s.ino, s.size, s.mtimeMs, s.ctimeMs, s.nlink].join(":");
const same = (a: Buffer | undefined, b: Buffer | undefined) => a === undefined ? b === undefined : b !== undefined && a.equals(b);
const allowed = (lease: () => boolean) => { try { return lease() === true; } catch { return false; } };
function encode(value: unknown): Buffer {
    const row = parseHistoryProfileReceipt(value); if (!row) throw unavailable();
    return Buffer.from(JSON.stringify({ schemaVersion: row.schemaVersion, generation: row.generation, identity: row.identity, phase: row.phase,
        existed: row.existed, beforeDigest: row.beforeDigest, afterDigest: row.afterDigest, backupHandle: row.backupHandle }) + "\n");
}

/** Private metadata only. Construction is inert; read never creates directories.
 * No Memento cache is journal authority. File CAS detects observed drift; it is
 * not an atomic cross-process or hostile same-user filesystem boundary. */
export class HistoryProfileJournal {
    #root: string;
    #file: string;
    #rootIdentity: string | undefined;
    #observed = false;
    #expected: Buffer | undefined;
    #busy = false;
    constructor(root: string) { this.#root = root; this.#file = path.join(root, HISTORY_PROFILE_JOURNAL); }
    #guard(): boolean {
        if (typeof this.#root !== "string" || !path.isAbsolute(this.#root) || path.resolve(this.#root) !== this.#root || this.#root.length > 4096
            || /[\p{Cc}\p{Cf}]/u.test(this.#root) || process.platform === "win32" && !/^[a-z]:\\/i.test(this.#root)) throw unavailable();
        const parsed = path.parse(this.#root); let current = parsed.root, missing = false;
        for (const part of this.#root.slice(parsed.root.length).split(path.sep)) {
            if (!part) continue; current = path.join(current, part);
            try {
                const entry = fs.lstatSync(current);
                if (missing || !entry.isDirectory() || entry.isSymbolicLink() || comparable(fs.realpathSync(current)) !== comparable(current)) throw unavailable();
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; missing = true;
            }
        }
        if (missing) { if (this.#rootIdentity !== undefined) throw unavailable(); return false; }
        const root = fs.lstatSync(this.#root), identity = [root.dev, root.ino].join(":");
        if (this.#rootIdentity !== undefined && identity !== this.#rootIdentity) throw unavailable(); this.#rootIdentity = identity; return true;
    }
    #readFile(file: string, cap: number, owned?: { dev: number; ino: number }): Buffer | undefined {
        if (!this.#guard()) return undefined;
        let first: Stats;
        try { first = fs.lstatSync(file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; this.#guard(); return undefined; }
        if (!first.isFile() || first.isSymbolicLink() || first.nlink !== 1 || first.size > cap || owned && (first.dev !== owned.dev || first.ino !== owned.ino)) throw unavailable();
        const fd = fs.openSync(file, "r");
        try {
            const before = fs.fstatSync(fd); if (!before.isFile() || stamp(before) !== stamp(first)) throw unavailable(); this.#guard();
            const bytes = Buffer.alloc(first.size + 1); let length = 0;
            while (length < bytes.length) { const count = fs.readSync(fd, bytes, length, bytes.length - length, length); if (!count) break; length += count; }
            const after = fs.lstatSync(file), end = fs.fstatSync(fd); this.#guard();
            if (length !== first.size || !after.isFile() || after.isSymbolicLink() || after.dev !== first.dev || stamp(after) !== stamp(first) || stamp(end) !== stamp(before)) throw unavailable();
            return Buffer.from(bytes.subarray(0, length));
        } finally { fs.closeSync(fd); }
    }
    read(): HistoryProfileReceipt | undefined {
        try {
            const raw = this.#readFile(this.#file, 8192);
            const value = raw === undefined ? undefined : parseHistoryProfileReceipt(JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw)));
            if (raw !== undefined && (!value || !encode(value).equals(raw))) throw unavailable();
            this.#expected = raw; this.#observed = true; return value;
        } catch { this.#observed = false; throw unavailable(); }
    }
    async write(value: HistoryProfileReceipt | undefined, lease: () => boolean): Promise<void> {
        if (this.#busy || !this.#observed || !allowed(lease)) throw unavailable();
        const next = value === undefined ? undefined : encode(value), expected = this.#expected;
        this.#busy = true;
        let stage: string | undefined, owned: { dev: number; ino: number } | undefined, committed = false;
        const fresh = () => { if (!allowed(lease) || !same(this.#readFile(this.#file, 8192), expected)) throw unavailable(); };
        try {
            fresh();
            if (next === undefined) {
                if (expected !== undefined) { fresh(); await unlink(this.#file); }
                committed = true; this.#expected = undefined; return;
            }
            if (!this.#guard()) { if (!allowed(lease)) throw unavailable(); await mkdir(this.#root, { recursive: true, mode: 0o700 }); }
            fresh();
            stage = path.join(this.#root, ".soterai-history-state-" + randomUUID() + ".tmp");
            if (comparable(await verifyOutputPath(this.#root, stage)) !== comparable(stage)) throw unavailable(); fresh();
            const handle = await open(stage, "wx", 0o600);
            try {
                const fd = await handle.stat(), named = fs.lstatSync(stage);
                if (!named.isFile() || named.isSymbolicLink() || named.nlink !== 1 || fd.ino !== named.ino) throw unavailable();
                owned = { dev: named.dev, ino: named.ino }; fresh(); await handle.writeFile(next); await handle.sync();
            } finally { await handle.close(); }
            if (!this.#readFile(stage, next.length, owned)?.equals(next)) throw unavailable();
            fresh(); if (comparable(await verifyOutputPath(this.#root, this.#file)) !== comparable(this.#file)) throw unavailable();
            fresh(); if (!this.#readFile(stage, next.length, owned)?.equals(next)) throw unavailable();
            await rename(stage, this.#file); committed = true;
            if (!this.#readFile(this.#file, 8192)?.equals(next)) throw unavailable(); this.#expected = next;
        } catch { this.#observed = false; throw unavailable(); }
        finally {
            if (!committed && stage && owned && next) {
                try {
                    const partial = this.#readFile(stage, next.length, owned);
                    if (partial && partial.equals(next.subarray(0, partial.length))) await unlink(stage);
                } catch { /* Uncertain ownership retains foreign/tampered bytes. */ }
            }
            this.#busy = false;
        }
    }
}
