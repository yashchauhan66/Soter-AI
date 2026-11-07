import { types } from "node:util";
import { parseHistoryBatch } from "../history/GitHistoryProtocol";
import { supportsCheckedGitVersion } from "../terminal/CheckedGitMetadata";
import { isCheckedHookIndex, type CheckedHookIndex } from "./CheckedHookIndex";
import { PreCommitGitProcess, type PreCommitGitOutcome } from "./PreCommitGitProcess";
import { parsePreCommitSizes, parseStagedEntries, PRE_COMMIT_LIMITS } from "./PreCommitProtocol";
import { inspectStagedBlob } from "./StagedContent";

export type PreCommitScanResult = Readonly<{ status: "ALLOW" | "BLOCK" | "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
type Operation = Readonly<{ kind: "version" | "entries" } | { kind: "sizes"; oids: readonly string[] }
    | { kind: "batch"; objects: readonly Readonly<{ oid: string; size: number }>[] }>;
interface ProcessOptions { index: CheckedHookIndex; operation: Operation; valid: () => boolean; deadline: number; now?: () => number }
interface Process { start(): Promise<PreCommitGitOutcome>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void }
interface Options {
    index: CheckedHookIndex; valid: () => boolean; deadline: number; now?: () => number;
    createProcess?: (options: ProcessOptions) => Process;
}
const result = (status: PreCommitScanResult["status"]): PreCommitScanResult => Object.freeze({ status });

/** Private complete-tree scan. A result never contains a path, value or finding.
 * Scanner children disable hooks; they cannot be reused as owner commit calls. */
export class PreCommitScan {
    readonly closed: Promise<void>;
    #close!: () => void; #resolve!: (value: PreCommitScanResult) => void;
    #outcome: Promise<PreCommitScanResult>; #held?: PreCommitScanResult;
    #started = false; #finished = false; #settled = false; #revoked = false; #busy = false;
    #start = 0; #last = 0; #deadline = 0;
    #active?: Process; #buffers: Buffer[] = [];
    #timer?: ReturnType<typeof setTimeout>; #poll?: ReturnType<typeof setInterval>;
    constructor(private readonly options: Options) {
        this.closed = new Promise(resolve => this.#close = resolve);
        this.#outcome = new Promise(resolve => this.#resolve = resolve);
    }
    get busy(): boolean { return this.#busy; }
    #clock(): number { return (this.options.now ?? (() => performance.now()))(); }
    #valid(): boolean {
        if (this.#revoked) return false;
        try {
            const now = this.#clock();
            if (!Number.isFinite(now) || now < this.#start || now < this.#last || now >= this.#deadline
                || this.options.valid() !== true || !this.options.index.available()) { this.#revoked = true; return false; }
            this.#last = now; return true;
        } catch { this.#revoked = true; return false; }
    }
    #release(value: PreCommitScanResult): void {
        if (!this.#settled) { this.#held = value; this.#settled = true; this.#resolve(value); }
    }
    withdraw(): void {
        this.#revoked = true;
        if (this.#active) { try { this.#active.withdraw(); } catch { /* Retain ownership until closed. */ } }
        if (this.#busy) this.#release(result("STOP_UNCONFIRMED"));
    }
    canRelease(value: PreCommitScanResult): boolean {
        return value === this.#held && value.status === "ALLOW" && this.#finished && !this.#busy && this.#valid();
    }
    async #step(operation: Operation, cap: number): Promise<Buffer | undefined> {
        if (!this.#valid()) return undefined;
        const request = { index: this.options.index, operation, valid: () => this.#valid(), deadline: this.#deadline, now: this.options.now };
        const child = (this.options.createProcess ?? (input => new PreCommitGitProcess(input)))(request);
        this.#active = child;
        try {
            const outcome = await child.start();
            if (outcome.status === "STOP_UNCONFIRMED") this.withdraw();
            // Even a premature COMPLETE cannot substitute for actual close/EOF.
            await child.closed;
            if (child.busy || !this.#valid() || outcome.status !== "COMPLETE" || !types.isUint8Array(outcome.bytes)
                || !Buffer.isBuffer(outcome.bytes) || outcome.bytes.byteLength > cap) return undefined;
            const bytes = Buffer.from(outcome.bytes); this.#buffers.push(bytes); return bytes;
        } catch {
            try { child.withdraw(); } catch { /* Retain unfinished ownership. */ }
            await child.closed; return undefined;
        } finally { this.#active = undefined; }
    }
    async #run(): Promise<void> {
        let status: PreCommitScanResult["status"] = "UNAVAILABLE";
        try {
            const version = await this.#step({ kind: "version" }, 4096);
            if (!version || !supportsCheckedGitVersion(version.toString("utf8"))) return;
            const listing = await this.#step({ kind: "entries" }, PRE_COMMIT_LIMITS.listingBytes);
            if (!listing) return;
            const entries = parseStagedEntries(listing), expected = this.options.index.entries;
            if (!entries || entries.length !== expected.length || entries.some((row, i) => row.path !== expected[i].path
                || row.oid !== expected[i].oid || row.mode !== expected[i].mode)) return;
            if (!entries.length) { if (this.#valid()) status = "ALLOW"; return; }
            const oids = Object.freeze([...new Set(entries.map(row => row.oid))]);
            const sizeBytes = await this.#step({ kind: "sizes", oids }, 12288);
            if (!sizeBytes) return;
            const sizes = parsePreCommitSizes(sizeBytes, oids); if (!sizes) return;
            const byOid = new Map(sizes.map(row => [row.oid, row.size])); let rawTotal = 0;
            // Charge every path before dedup: format context is per path, too.
            for (const row of entries) {
                const size = byOid.get(row.oid); if (size === undefined) return;
                rawTotal += size; if (rawTotal > PRE_COMMIT_LIMITS.totalBytes) return;
            }
            const batch = await this.#step({ kind: "batch", objects: sizes }, PRE_COMMIT_LIMITS.totalBytes + 128 * 96);
            if (!batch) return;
            const objects = parseHistoryBatch(batch, sizes), blobs = new Map(objects.map(row => [row.oid, row.bytes]));
            this.#buffers.push(...objects.map(row => row.bytes)); let candidate = false;
            for (const row of entries) {
                if (!this.#valid()) return;
                const bytes = blobs.get(row.oid); if (!bytes) return;
                const checked = inspectStagedBlob(row.path, bytes);
                if (checked.status === "UNAVAILABLE") return;
                candidate ||= checked.status === "CANDIDATE";
            }
            if (this.#valid()) status = candidate ? "BLOCK" : "ALLOW";
        } catch { /* Whole-tree unavailability; never a valid-prefix decision. */ }
        finally {
            clearTimeout(this.#timer); clearInterval(this.#poll);
            this.#buffers.forEach(bytes => bytes.fill(0)); this.#buffers = [];
            this.#busy = false; this.#finished = true;
            this.#release(result(status)); this.#close();
        }
    }
    start(): Promise<PreCommitScanResult> {
        if (this.#started) return Promise.resolve(result("UNAVAILABLE")); this.#started = true;
        try {
            if (this.#revoked || !isCheckedHookIndex(this.options.index)) throw Error();
            this.#start = this.#last = this.#clock();
            if (!Number.isFinite(this.#start) || !Number.isFinite(this.options.deadline) || this.options.deadline <= this.#start) throw Error();
            this.#deadline = Math.min(this.options.deadline, this.#start + PRE_COMMIT_LIMITS.milliseconds);
            if (!this.#valid()) throw Error();
            this.#busy = true;
            this.#timer = setTimeout(() => this.withdraw(), Math.max(1, this.#deadline - this.#clock()));
            this.#poll = setInterval(() => { if (!this.#valid()) this.withdraw(); }, 20); this.#poll.unref?.();
            void this.#run();
        } catch { this.#revoked = true; this.#finished = true; this.#release(result("UNAVAILABLE")); this.#close(); }
        return this.#outcome;
    }
}
