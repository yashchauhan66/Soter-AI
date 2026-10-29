import { types } from "node:util";
import { parseHistoryBatch, parseHistoryCommitList, parseHistoryTree } from "../history/GitHistoryProtocol";
import { supportsCheckedGitVersion } from "../terminal/CheckedGitMetadata";
import { isCheckedPushRefs, type CheckedPushRefs } from "./CheckedPushRefs";
import { PrePushGitProcess, type PrePushGitOutcome } from "./PrePushGitProcess";
import { PRE_PUSH_LIMITS } from "./PrePushProtocol";
import { inspectStagedBlob } from "./StagedContent";

export type PrePushScanResult = Readonly<{ status: "ALLOW" | "BLOCK" | "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
export type PrePushScanOperation = Readonly<{ kind: "version" | "commits" } | { kind: "tree"; oid: string }
    | { kind: "batch"; objects: readonly Readonly<{ oid: string; size: number }>[] }>;
type Operation = PrePushScanOperation;
interface ProcessOptions { refs: CheckedPushRefs; operation: Operation; valid: () => boolean; deadline: number; now?: () => number }
interface Process { start(): Promise<PrePushGitOutcome>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void }
interface Options {
    refs: CheckedPushRefs; valid: () => boolean; deadline: number; now?: () => number;
    createProcess?: (options: ProcessOptions) => Process;
}
const result = (status: PrePushScanResult["status"]): PrePushScanResult => Object.freeze({ status });

/** Private complete pushed-history scan. A result never contains a path, value or finding.
 * Scanner children disable hooks; they cannot be reused as owner push calls. */
export class PrePushScan {
    readonly closed: Promise<void>;
    #close!: () => void; #resolve!: (value: PrePushScanResult) => void;
    #outcome: Promise<PrePushScanResult>; #held?: PrePushScanResult;
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
                || this.options.valid() !== true || !this.options.refs.available()) { this.#revoked = true; return false; }
            // Callbacks and synchronous index recapture may withdraw or consume
            // the remaining budget. Sample again before granting authority.
            const after = this.#clock();
            if (this.#revoked || !Number.isFinite(after) || after < now || after >= this.#deadline) { this.#revoked = true; return false; }
            this.#last = after; return true;
        } catch { this.#revoked = true; return false; }
    }
    #release(value: PrePushScanResult): void {
        if (!this.#settled) { this.#held = value; this.#settled = true; this.#resolve(value); }
    }
    withdraw(): void {
        this.#revoked = true;
        if (this.#active) { try { this.#active.withdraw(); } catch { /* Retain ownership until closed. */ } }
        if (this.#busy) this.#release(result("STOP_UNCONFIRMED"));
    }
    canRelease(value: PrePushScanResult): boolean {
        return value === this.#held && value.status === "ALLOW" && this.#finished && !this.#busy && this.#valid();
    }
    async #step(operation: Operation, cap: number): Promise<Buffer | undefined> {
        if (!this.#valid()) return undefined;
        const request = { refs: this.options.refs, operation, valid: () => this.#valid(), deadline: this.#deadline, now: this.options.now };
        const child = (this.options.createProcess ?? (input => new PrePushGitProcess(input)))(request);
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
        let status: PrePushScanResult["status"] = "UNAVAILABLE";
        try {
            const version = await this.#step({ kind: "version" }, 4096);
            if (!version || !supportsCheckedGitVersion(version.toString("utf8"))) return;
            const tips = new Set(this.options.refs.updates.filter(row => !row.deletion).map(row => row.localOid));
            if (!tips.size) { if (this.#valid()) status = "ALLOW"; return; }
            const list = await this.#step({ kind: "commits" }, 4096); if (!list) return;
            const parsed = parseHistoryCommitList(list);
            if (parsed.capped || !parsed.commits.length || [...tips].some(tip => !parsed.commits.includes(tip))) return;
            const objects = new Map<string, { oid: string; size: number }>();
            const contexts = new Map<string, { oid: string; source: string }>();
            let total = 0, entries = 0, contextualBytes = 0;
            for (const commit of parsed.commits) {
                const raw = await this.#step({ kind: "tree", oid: commit }, 262144); if (!raw) return;
                const tree = parseHistoryTree(raw); entries += tree.blobs.length + tree.skipped;
                if (tree.skipped || entries > PRE_PUSH_LIMITS.entries) return;
                for (const row of tree.blobs) {
                    if (!this.#valid() || row.size > PRE_PUSH_LIMITS.blobBytes) return;
                    const before = objects.get(row.oid);
                    if (before && before.size !== row.size) return;
                    if (!before) {
                        total += row.size;
                        if (objects.size >= PRE_PUSH_LIMITS.blobs || total > PRE_PUSH_LIMITS.totalBytes) return;
                        objects.set(row.oid, { oid: row.oid, size: row.size });
                    }
                    const key = row.oid + "\0" + row.source;
                    if (!contexts.has(key)) {
                        contextualBytes += row.size; if (contextualBytes > PRE_PUSH_LIMITS.totalBytes) return;
                        contexts.set(key, { oid: row.oid, source: row.source });
                    }
                }
            }
            if (!objects.size) { if (this.#valid()) status = "ALLOW"; return; }
            const expected = [...objects.values()];
            const batch = await this.#step({ kind: "batch", objects: expected }, total + expected.length * 96); if (!batch) return;
            const checked = parseHistoryBatch(batch, expected); this.#buffers.push(...checked.map(row => row.bytes));
            const blobs = new Map(checked.map(row => [row.oid, row.bytes])); let candidate = false;
            for (const row of contexts.values()) {
                if (!this.#valid()) return;
                const bytes = blobs.get(row.oid); if (!bytes) return;
                const classified = inspectStagedBlob(row.source, bytes);
                if (classified.status === "UNAVAILABLE") return;
                candidate ||= classified.status === "CANDIDATE";
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
    start(): Promise<PrePushScanResult> {
        if (this.#started) return Promise.resolve(result("UNAVAILABLE")); this.#started = true;
        try {
            if (this.#revoked || !isCheckedPushRefs(this.options.refs)) throw Error();
            this.#start = this.#last = this.#clock();
            if (!Number.isFinite(this.#start) || !Number.isFinite(this.options.deadline) || this.options.deadline <= this.#start) throw Error();
            this.#deadline = Math.min(this.options.deadline, this.#start + PRE_PUSH_LIMITS.milliseconds);
            if (!this.#valid()) throw Error();
            this.#busy = true;
            this.#timer = setTimeout(() => this.withdraw(), Math.max(1, this.#deadline - this.#clock()));
            this.#poll = setInterval(() => { if (!this.#valid()) this.withdraw(); }, 20); this.#poll.unref?.();
            void this.#run();
        } catch { this.#revoked = true; this.#finished = true; this.#release(result("UNAVAILABLE")); this.#close(); }
        return this.#outcome;
    }
}
