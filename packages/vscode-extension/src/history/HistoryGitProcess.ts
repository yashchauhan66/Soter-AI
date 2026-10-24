import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import { isCheckedGitMetadata, type CheckedGitMetadata } from "../terminal/CheckedGitMetadata";
import { safeGitArguments } from "../security/SafeGit";
import { HISTORY_LIMITS, type HistoryBlobIdentity } from "./GitHistoryProtocol";

export type HistoryGitOperation = Readonly<{ kind: "version" } | { kind: "commits" } | { kind: "tree"; oid: string }
    | { kind: "batch"; objects: readonly HistoryBlobIdentity[] }>;
export type HistoryGitOutcome = Readonly<{ status: "COMPLETE"; bytes: Buffer } | { status: "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
interface Options {
    root: string; descriptor: CheckedGitMetadata; operation: unknown; valid: () => boolean; deadline: number;
    now?: () => number; spawn?: typeof spawn;
}
interface Request { args: string[]; stdin?: string; cap: number; version: boolean }
const denied = (): HistoryGitOutcome => Object.freeze({ status: "UNAVAILABLE" });
const oid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
    return !!value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value))
        && Object.keys(value).sort().join(",") === keys.slice().sort().join(",")
        && !Object.values(Object.getOwnPropertyDescriptors(value)).some(field => field.get || field.set);
}
function request(value: unknown): Request | undefined {
    if (exact(value, ["kind"])) {
        if (value.kind === "version") return { args: ["--version"], cap: 4096, version: true };
        if (value.kind === "commits") return { args: ["rev-list", "--max-count=33", "--all", "--"], cap: HISTORY_LIMITS.listBytes, version: false };
    }
    if (exact(value, ["kind", "oid"]) && value.kind === "tree" && oid(value.oid))
        return { args: ["ls-tree", "-r", "-z", "--full-tree", "--long", value.oid, "--"], cap: HISTORY_LIMITS.treeBytes, version: false };
    if (!exact(value, ["kind", "objects"]) || value.kind !== "batch" || !Array.isArray(value.objects)
        || value.objects.length > HISTORY_LIMITS.blobs || !value.objects.length) return undefined;
    const objects: string[] = [], seen = new Set<string>(); let total = 0;
    for (const object of value.objects) {
        if (!exact(object, ["oid", "size"]) || !oid(object.oid) || seen.has(object.oid) || !Number.isSafeInteger(object.size)
            || (object.size as number) < 0 || (object.size as number) > HISTORY_LIMITS.blobBytes) return undefined;
        seen.add(object.oid); objects.push(object.oid); total += object.size as number;
        if (total > HISTORY_LIMITS.totalBytes) return undefined;
    }
    return { args: ["cat-file", "--batch"], stdin: objects.join("\n") + "\n", cap: total + objects.length * 96, version: false };
}

/** One owned finite child. Withdrawal never sends signals or forces pipe closure.
 * The caller keeps its operation busy until closed resolves, including after a
 * STOP_UNCONFIRMED outcome. Returned bytes stay in private local analysis. */
export class HistoryGitProcess {
    readonly closed: Promise<void>;
    #close!: () => void; #resolve!: (value: HistoryGitOutcome) => void;
    #outcome: Promise<HistoryGitOutcome>; #settled = false; #started = false; #revoked = false; #busy = false;
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
            if (!Number.isFinite(now) || now < this.#start || now < this.#last || now >= this.#deadline || this.options.valid() !== true) return false;
            this.#last = now; return true;
        } catch { return false; }
    }
    #release(value: HistoryGitOutcome): void { if (!this.#settled) { this.#settled = true; this.#resolve(value); } }
    #clear(): void { this.#stdout.forEach(chunk => chunk.fill(0)); this.#stdout = []; }
    #withoutChild(): Promise<HistoryGitOutcome> { this.#busy = false; this.#revoked = true; this.#release(denied()); this.#close(); return this.#outcome; }
    withdraw(): void {
        this.#revoked = true; this.#clear();
        if (this.#busy) this.#release(Object.freeze({ status: "STOP_UNCONFIRMED" }));
    }
    #joined(): void {
        if (!this.#observedClose || !this.#stdoutEOF || !this.#stderrEOF) return;
        clearTimeout(this.#timer); clearInterval(this.#poll); this.#busy = false;
        let complete = false;
        try { complete = !this.#revoked && this.#exit === 0 && !this.#signal && this.#stderrBytes === 0
            && this.#valid() && this.options.descriptor.available(); } catch { /* Never emit a child/config error. */ }
        if (complete) this.#release(Object.freeze({ status: "COMPLETE", bytes: Buffer.concat(this.#stdout, this.#stdoutBytes) }));
        else this.#release(denied());
        this.#clear(); this.#close();
    }
    start(): Promise<HistoryGitOutcome> {
        if (this.#started) return Promise.resolve(denied()); this.#started = true;
        try {
            this.#start = this.#last = this.#clock();
            if (this.#revoked || !Number.isFinite(this.#start) || !Number.isFinite(this.options.deadline) || this.options.deadline <= this.#start
                || !isCheckedGitMetadata(this.options.descriptor) || !this.options.descriptor.available()
                || typeof this.options.root !== "string" || !path.isAbsolute(this.options.root) || /^[\\/]{2}|[\x00-\x1f\x7f]/.test(this.options.root)) return this.#withoutChild();
            this.#deadline = Math.min(this.options.deadline, this.#start + HISTORY_LIMITS.milliseconds);
            const selected = request(this.options.operation); if (!selected || !this.#valid()) return this.#withoutChild();
            this.#cap = selected.cap;
            const descriptor = this.options.descriptor;
            const args = safeGitArguments(descriptor.job, ["--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks",
                "-c", "protocol.allow=never", "-c", "core.pager=", "-c", "color.ui=false",
                "-c", "core.attributesFile=" + path.join(descriptor.job, "empty.gitconfig"), "-c", "gc.auto=0", "-c", "maintenance.auto=false", ...selected.args]);
            const child = (this.options.spawn ?? spawn)(descriptor.executable, args, {
                cwd: selected.version ? descriptor.job : this.options.root, env: descriptor.environment, shell: false, windowsHide: true,
                stdio: [selected.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
            });
            this.#child = child; this.#busy = true;
            child.once("error", () => {
                if (child.pid === undefined) { clearTimeout(this.#timer); clearInterval(this.#poll); this.#withoutChild(); }
                else this.withdraw();
            });
            child.once("close", (code, signal) => { this.#exit = code; this.#signal = signal; this.#observedClose = true; this.#joined(); });
            for (const channel of ["stdout", "stderr"] as const) {
                const stream = child[channel];
                if (!stream) { this.withdraw(); continue; }
                stream.on("data", (value: Buffer) => {
                    if (!(value instanceof Uint8Array)) { this.withdraw(); return; }
                    if (channel === "stderr") this.#stderrBytes += value.byteLength; else this.#stdoutBytes += value.byteLength;
                    if (this.#stdoutBytes > this.#cap || this.#stderrBytes > HISTORY_LIMITS.stderrBytes || !this.#valid()) this.withdraw();
                    if (!this.#revoked && channel === "stdout") this.#stdout.push(Buffer.from(value));
                });
                stream.once("end", () => { if (channel === "stdout") this.#stdoutEOF = true; else this.#stderrEOF = true; this.#joined(); });
                stream.once("error", () => this.withdraw());
            }
            this.#timer = setTimeout(() => this.withdraw(), Math.max(1, this.#deadline - this.#clock()));
            this.#poll = setInterval(() => { if (!this.#valid()) this.withdraw(); }, 20); this.#poll.unref?.();
            if (selected.stdin !== undefined) {
                if (!child.stdin) this.withdraw();
                else { child.stdin.once("error", () => this.withdraw()); child.stdin.end(selected.stdin, "ascii"); }
            }
            return this.#outcome;
        } catch {
            if (this.#child && this.#busy) { this.withdraw(); return this.#outcome; }
            return this.#withoutChild();
        }
    }
}
