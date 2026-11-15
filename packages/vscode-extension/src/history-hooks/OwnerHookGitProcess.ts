import { spawn, type ChildProcess } from "node:child_process";
import { types } from "node:util";
import { isCheckedOwnerHookContext, type CheckedOwnerHookContext } from "./CheckedOwnerHookContext";

export type OwnerHookGitOutcome = Readonly<{ status: "COMPLETE"; bytes: Buffer } | { status: "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
interface Options { context: CheckedOwnerHookContext; operation: unknown; valid: () => boolean; deadline: number; now?: () => number; spawn?: typeof spawn }
const denied = (): OwnerHookGitOutcome => Object.freeze({ status: "UNAVAILABLE" });
const CONFIG_ARGS = Object.freeze(["--no-pager", "--no-optional-locks", "-c", "protocol.allow=never", "-c", "credential.helper=", "-c", "credential.interactive=false",
    "config", "--null", "--show-origin", "--show-scope", "--no-includes", "--get-regexp", "^(core[.]hookspath|include[.]path|includeif[.].*[.]path|extensions[.]worktreeconfig)$"]);

/** Finite private OWNER projection, deliberately not safeGitArguments: that
 * scanner helper changes global/system configuration and forces empty hooks.
 * No commit, arbitrary arguments, include execution claim or process signal. */
export class OwnerHookGitProcess {
    readonly closed: Promise<void>;
    #close!: () => void; #resolve!: (value: OwnerHookGitOutcome) => void;
    #outcome: Promise<OwnerHookGitOutcome>; #settled = false; #started = false; #revoked = false; #busy = false;
    #child?: ChildProcess; #stdout: Buffer[] = []; #stdoutBytes = 0; #stderrBytes = 0;
    #stdoutEOF = false; #stderrEOF = false; #observedClose = false; #exit: number | null = null; #signal: unknown;
    #timer?: ReturnType<typeof setTimeout>; #poll?: ReturnType<typeof setInterval>;
    #start = 0; #last = 0; #deadline = 0; #cap = 0; #config = false;
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
                || this.options.valid() !== true || !this.options.context.available()) { this.#revoked = true; return false; }
            const after = this.#clock();
            if (this.#revoked || !Number.isFinite(after) || after < now || after >= this.#deadline) { this.#revoked = true; return false; }
            this.#last = after; return true;
        } catch { this.#revoked = true; return false; }
    }
    #release(value: OwnerHookGitOutcome): void { if (!this.#settled) { this.#settled = true; this.#resolve(value); } }
    #clear(): void { this.#stdout.forEach(chunk => chunk.fill(0)); this.#stdout = []; }
    #withoutChild(): Promise<OwnerHookGitOutcome> { this.#busy = false; this.#revoked = true; this.#release(denied()); this.#close(); return this.#outcome; }
    withdraw(): void { this.#revoked = true; this.#clear(); if (this.#busy) this.#release(Object.freeze({ status: "STOP_UNCONFIRMED" })); }
    #joined(): void {
        if (!this.#observedClose || !this.#stdoutEOF || !this.#stderrEOF) return;
        clearTimeout(this.#timer); clearInterval(this.#poll); this.#busy = false;
        const acceptedExit = this.#exit === 0 || this.#config && this.#exit === 1 && this.#stdoutBytes === 0;
        const complete = !this.#revoked && acceptedExit && !this.#signal && this.#stderrBytes === 0 && this.#valid();
        if (complete) this.#release(Object.freeze({ status: "COMPLETE", bytes: Buffer.concat(this.#stdout, this.#stdoutBytes) }));
        else this.#release(denied()); this.#clear(); this.#close();
    }
    start(): Promise<OwnerHookGitOutcome> {
        if (this.#started) return Promise.resolve(denied()); this.#started = true;
        try {
            if (this.#revoked || !isCheckedOwnerHookContext(this.options.context)
                || this.options.operation !== "version" && this.options.operation !== "config") return this.#withoutChild();
            this.#start = this.#last = this.#clock();
            if (!Number.isFinite(this.#start) || !Number.isFinite(this.options.deadline) || this.options.deadline <= this.#start) return this.#withoutChild();
            this.#deadline = Math.min(this.options.deadline, this.#start + 60000);
            this.#config = this.options.operation === "config"; this.#cap = this.#config ? 65536 : 4096;
            if (!this.#valid()) return this.#withoutChild();
            const context = this.options.context;
            const child = (this.options.spawn ?? spawn)(context.metadata.executable, this.#config ? [...CONFIG_ARGS] : ["--version"], {
                cwd: this.#config ? context.root : context.metadata.job, env: context.environment, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
            this.#child = child; this.#busy = true;
            child.once("error", () => { if (child.pid === undefined) { clearTimeout(this.#timer); clearInterval(this.#poll); this.#withoutChild(); } else this.withdraw(); });
            child.once("close", (code, signal) => { this.#exit = code; this.#signal = signal; this.#observedClose = true; this.#joined(); });
            for (const channel of ["stdout", "stderr"] as const) {
                const stream = child[channel]; if (!stream) { this.withdraw(); continue; }
                stream.on("data", (value: Buffer) => {
                    if (!types.isUint8Array(value) || !Buffer.isBuffer(value)) { this.withdraw(); return; }
                    if (channel === "stderr") this.#stderrBytes += value.byteLength; else this.#stdoutBytes += value.byteLength;
                    if (this.#stdoutBytes > this.#cap || this.#stderrBytes > 8192 || !this.#valid()) this.withdraw();
                    if (!this.#revoked && channel === "stdout") this.#stdout.push(Buffer.from(value));
                });
                stream.once("end", () => { if (channel === "stdout") this.#stdoutEOF = true; else this.#stderrEOF = true; this.#joined(); });
                stream.once("error", () => this.withdraw());
            }
            this.#timer = setTimeout(() => this.withdraw(), Math.max(1, this.#deadline - this.#clock()));
            this.#poll = setInterval(() => { if (!this.#valid()) this.withdraw(); }, 20); this.#poll.unref?.();
            return this.#outcome;
        } catch { if (this.#child && this.#busy) { this.withdraw(); return this.#outcome; } return this.#withoutChild(); }
    }
}
