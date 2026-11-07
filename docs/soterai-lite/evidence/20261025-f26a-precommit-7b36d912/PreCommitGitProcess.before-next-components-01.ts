import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import { types } from "node:util";
import { safeGitArguments } from "../security/SafeGit";
import { isCheckedHookIndex, type CheckedHookIndex } from "./CheckedHookIndex";
import { PRE_COMMIT_LIMITS } from "./PreCommitProtocol";

export type PreCommitGitOutcome = Readonly<{ status: "COMPLETE"; bytes: Buffer } | { status: "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
interface Options { index: CheckedHookIndex; operation: unknown; valid: () => boolean; deadline: number; now?: () => number; spawn?: typeof spawn }
interface Request { args: string[]; stdin?: string; cap: number; version: boolean }
const denied = (): PreCommitGitOutcome => Object.freeze({ status: "UNAVAILABLE" });
const oid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
    if (!value || typeof value !== "object" || types.isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    const own = Reflect.ownKeys(value);
    return own.every(key => typeof key === "string") && (own as string[]).sort().join(",") === keys.slice().sort().join(",")
        && Object.values(Object.getOwnPropertyDescriptors(value)).every(field => !field.get && !field.set);
}
function array(value: unknown): value is unknown[] {
    if (!value || typeof value !== "object" || types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
    const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(value), count = fields.length.value;
    return Number.isSafeInteger(count) && count > 0 && count <= PRE_COMMIT_LIMITS.entries
        && Reflect.ownKeys(value).length === count + 1 && Object.values(fields).every(field => !field.get && !field.set)
        && Array.from({ length: count }, (_, index) => Object.hasOwn(fields, String(index))).every(Boolean);
}
function request(value: unknown): Request | undefined {
    if (exact(value, ["kind"])) {
        if (value.kind === "version") return { args: ["--version"], cap: 4096, version: true };
        if (value.kind === "entries") return { args: ["ls-files", "--stage", "-z"], cap: PRE_COMMIT_LIMITS.listingBytes, version: false };
    }
    if (exact(value, ["kind", "oids"]) && value.kind === "sizes" && array(value.oids)) {
        if (!value.oids.every(oid) || new Set(value.oids).size !== value.oids.length) return undefined;
        return { args: ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], stdin: value.oids.join("\n") + "\n", cap: 12288, version: false };
    }
    if (!exact(value, ["kind", "objects"]) || value.kind !== "batch" || !array(value.objects)) return undefined;
    let total = 0; const objects: string[] = [], seen = new Set<string>();
    for (const object of value.objects) {
        if (!exact(object, ["oid", "size"]) || !oid(object.oid) || seen.has(object.oid) || !Number.isSafeInteger(object.size)
            || (object.size as number) < 0 || (object.size as number) > PRE_COMMIT_LIMITS.blobBytes) return undefined;
        total += object.size as number; if (total > PRE_COMMIT_LIMITS.totalBytes) return undefined;
        objects.push(object.oid); seen.add(object.oid);
    }
    return { args: ["cat-file", "--batch"], stdin: objects.join("\n") + "\n", cap: total + objects.length * 96, version: false };
}

/** One finite private scanner child. This disables hooks and must never be used
 * as the owner commit invocation. No signal/forced pipe closure on withdrawal. */
export class PreCommitGitProcess {
    readonly closed: Promise<void>;
    #close!: () => void; #resolve!: (value: PreCommitGitOutcome) => void;
    #outcome: Promise<PreCommitGitOutcome>; #settled = false; #started = false; #revoked = false; #busy = false;
    #child?: ChildProcess; #stdout: Buffer[] = []; #stdoutBytes = 0; #stderrBytes = 0;
    #stdoutEOF = false; #stderrEOF = false; #observedClose = false; #exit: number | null = null; #signal: unknown;
    #timer?: ReturnType<typeof setTimeout>; #poll?: ReturnType<typeof setInterval>;
    #start = 0; #last = 0; #deadline = 0; #cap = 0;
    constructor(private readonly options: Options) {
        this.closed = new Promise(resolve => this.#close = resolve);
        this.#outcome = new Promise(resolve => this.#resolve = resolve);
    }
    get busy(): boolean { return this.#busy; }
    #clock(): number { return (this.options.now ?? (() => performance.now()))(); }
    #valid(): boolean {
        try {
            const now = this.#clock();
            if (!Number.isFinite(now) || now < this.#start || now < this.#last || now >= this.#deadline
                || this.options.valid() !== true || !this.options.index.available()) return false;
            this.#last = now; return true;
        } catch { return false; }
    }
    #release(value: PreCommitGitOutcome): void { if (!this.#settled) { this.#settled = true; this.#resolve(value); } }
    #clear(): void { this.#stdout.forEach(chunk => chunk.fill(0)); this.#stdout = []; }
    #withoutChild(): Promise<PreCommitGitOutcome> { this.#busy = false; this.#revoked = true; this.#release(denied()); this.#close(); return this.#outcome; }
    withdraw(): void { this.#revoked = true; this.#clear(); if (this.#busy) this.#release(Object.freeze({ status: "STOP_UNCONFIRMED" })); }
    #joined(): void {
        if (!this.#observedClose || !this.#stdoutEOF || !this.#stderrEOF) return;
        clearTimeout(this.#timer); clearInterval(this.#poll); this.#busy = false;
        const complete = !this.#revoked && this.#exit === 0 && !this.#signal && this.#stderrBytes === 0 && this.#valid();
        if (complete) this.#release(Object.freeze({ status: "COMPLETE", bytes: Buffer.concat(this.#stdout, this.#stdoutBytes) }));
        else this.#release(denied());
        this.#clear(); this.#close();
    }
    start(): Promise<PreCommitGitOutcome> {
        if (this.#started) return Promise.resolve(denied()); this.#started = true;
        try {
            this.#start = this.#last = this.#clock();
            if (this.#revoked || !Number.isFinite(this.#start) || !Number.isFinite(this.options.deadline) || this.options.deadline <= this.#start
                || !isCheckedHookIndex(this.options.index) || !this.options.index.available()) return this.#withoutChild();
            this.#deadline = Math.min(this.options.deadline, this.#start + PRE_COMMIT_LIMITS.milliseconds);
            const selected = request(this.options.operation); if (!selected || !this.#valid()) return this.#withoutChild(); this.#cap = selected.cap;
            const index = this.options.index, args = safeGitArguments(index.metadata.job, ["--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks",
                "-c", "protocol.allow=never", "-c", "core.pager=", "-c", "color.ui=false", "-c", "core.attributesFile=" + path.join(index.metadata.job, "empty.gitconfig"),
                "-c", "gc.auto=0", "-c", "maintenance.auto=false", ...selected.args]);
            const child = (this.options.spawn ?? spawn)(index.metadata.executable, args, { cwd: selected.version ? index.metadata.job : index.root,
                env: index.environment, shell: false, windowsHide: true, stdio: [selected.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
            this.#child = child; this.#busy = true;
            child.once("error", () => { if (child.pid === undefined) { clearTimeout(this.#timer); clearInterval(this.#poll); this.#withoutChild(); } else this.withdraw(); });
            child.once("close", (code, signal) => { this.#exit = code; this.#signal = signal; this.#observedClose = true; this.#joined(); });
            for (const channel of ["stdout", "stderr"] as const) {
                const stream = child[channel]; if (!stream) { this.withdraw(); continue; }
                stream.on("data", (value: Buffer) => {
                    if (!types.isUint8Array(value) || !Buffer.isBuffer(value)) { this.withdraw(); return; }
                    if (channel === "stderr") this.#stderrBytes += value.byteLength; else this.#stdoutBytes += value.byteLength;
                    if (this.#stdoutBytes > this.#cap || this.#stderrBytes > PRE_COMMIT_LIMITS.stderrBytes || !this.#valid()) this.withdraw();
                    if (!this.#revoked && channel === "stdout") this.#stdout.push(Buffer.from(value));
                });
                stream.once("end", () => { if (channel === "stdout") this.#stdoutEOF = true; else this.#stderrEOF = true; this.#joined(); });
                stream.once("error", () => this.withdraw());
            }
            this.#timer = setTimeout(() => this.withdraw(), Math.max(1, this.#deadline - this.#clock()));
            this.#poll = setInterval(() => { if (!this.#valid()) this.withdraw(); }, 20); this.#poll.unref?.();
            if (selected.stdin !== undefined) { if (!child.stdin) this.withdraw(); else { child.stdin.once("error", () => this.withdraw()); child.stdin.end(selected.stdin, "ascii"); } }
            return this.#outcome;
        } catch { if (this.#child && this.#busy) { this.withdraw(); return this.#outcome; } return this.#withoutChild(); }
    }
}
