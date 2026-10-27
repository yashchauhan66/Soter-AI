import { createHash } from "node:crypto";
import { types } from "node:util";
import { supportsCheckedGitVersion } from "../terminal/CheckedGitMetadata";
import { isCheckedOwnerHookContext, type CheckedOwnerHookContext } from "./CheckedOwnerHookContext";
import { OwnerHookGitProcess, type OwnerHookGitOutcome } from "./OwnerHookGitProcess";
import { parseOwnerHookConfig } from "./OwnerHookProtocol";

export type OwnerHookDiscoveryResult = Readonly<{ status: "COMPLETE"; hooksRelative: string; fingerprint: string }
    | { status: "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
interface ProcessOptions { context: CheckedOwnerHookContext; operation: "version" | "config"; valid: () => boolean; deadline: number; now?: () => number }
interface Worker { start(): Promise<OwnerHookGitOutcome>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void }
interface Options { context: CheckedOwnerHookContext; valid: () => boolean; deadline: number; now?: () => number; createProcess?: (options: ProcessOptions) => Worker }
const denied = (): OwnerHookDiscoveryResult => Object.freeze({ status: "UNAVAILABLE" });

/** Private current-owner projection, not installation authority. Installer must
 * requery after review and around mutation. A later external commit override
 * can skip a cooperative hook altogether; a local capability cannot veto it. */
export class OwnerHookDiscovery {
    readonly closed: Promise<void>;
    #close!: () => void; #resolve!: (value: OwnerHookDiscoveryResult) => void;
    #outcome: Promise<OwnerHookDiscoveryResult>; #held?: OwnerHookDiscoveryResult;
    #started = false; #finished = false; #settled = false; #revoked = false; #busy = false;
    #start = 0; #last = 0; #deadline = 0; #active?: Worker; #buffers: Buffer[] = [];
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
                || this.options.valid() !== true || !this.options.context.available()) { this.#revoked = true; return false; }
            const after = this.#clock();
            if (this.#revoked || !Number.isFinite(after) || after < now || after >= this.#deadline) { this.#revoked = true; return false; }
            this.#last = after; return true;
        } catch { this.#revoked = true; return false; }
    }
    #release(value: OwnerHookDiscoveryResult): void { if (!this.#settled) { this.#held = value; this.#settled = true; this.#resolve(value); } }
    withdraw(): void {
        this.#revoked = true; try { this.#active?.withdraw(); } catch { /* Still wait for actual closure. */ }
        if (this.#busy) this.#release(Object.freeze({ status: "STOP_UNCONFIRMED" }));
    }
    canRelease(value: OwnerHookDiscoveryResult): boolean {
        return !!value && value === this.#held && value.status === "COMPLETE" && this.#finished && !this.#busy && this.#valid();
    }
    async #step(operation: "version" | "config", cap: number): Promise<Buffer | undefined> {
        if (!this.#valid()) return undefined;
        const request = { context: this.options.context, operation, valid: () => this.#valid(), deadline: this.#deadline, now: this.options.now };
        const worker = (this.options.createProcess ?? (input => new OwnerHookGitProcess(input)))(request); this.#active = worker;
        try {
            const outcome = await worker.start();
            if (outcome.status === "STOP_UNCONFIRMED") this.withdraw();
            await worker.closed;
            if (worker.busy || !this.#valid() || outcome.status !== "COMPLETE" || !types.isUint8Array(outcome.bytes)
                || !Buffer.isBuffer(outcome.bytes) || outcome.bytes.byteLength > cap) return undefined;
            const bytes = Buffer.from(outcome.bytes); this.#buffers.push(bytes); return bytes;
        } catch { try { worker.withdraw(); } catch { /* Retain owned closure. */ } await worker.closed; return undefined; }
        finally { this.#active = undefined; }
    }
    async #run(): Promise<void> {
        let result = denied();
        try {
            const version = await this.#step("version", 4096);
            if (!version || !supportsCheckedGitVersion(version.toString("utf8"))) return;
            const bytes = await this.#step("config", 65536); if (!bytes) return;
            const parsed = parseOwnerHookConfig(bytes, this.options.context.root); if (!parsed || !this.#valid()) return;
            const fingerprint = createHash("sha256").update("SoterAI-OwnerHook-Projection-v1\0").update(this.options.context.root).update("\0").update(bytes).digest("hex");
            if (this.#valid()) result = Object.freeze({ status: "COMPLETE", hooksRelative: parsed.hooksRelative, fingerprint });
        } catch { /* No partial projection or raw error reaches a caller. */ }
        finally {
            clearTimeout(this.#timer); clearInterval(this.#poll); this.#buffers.forEach(bytes => bytes.fill(0)); this.#buffers = [];
            this.#busy = false; this.#finished = true; this.#release(result); this.#close();
        }
    }
    start(): Promise<OwnerHookDiscoveryResult> {
        if (this.#started) return Promise.resolve(denied()); this.#started = true;
        try {
            if (this.#revoked || !isCheckedOwnerHookContext(this.options.context)) throw Error();
            this.#start = this.#last = this.#clock();
            if (!Number.isFinite(this.#start) || !Number.isFinite(this.options.deadline) || this.options.deadline <= this.#start) throw Error();
            this.#deadline = Math.min(this.options.deadline, this.#start + 60000);
            if (!this.#valid()) throw Error(); this.#busy = true;
            this.#timer = setTimeout(() => this.withdraw(), Math.max(1, this.#deadline - this.#clock()));
            this.#poll = setInterval(() => { if (!this.#valid()) this.withdraw(); }, 20); this.#poll.unref?.(); void this.#run();
        } catch { this.#revoked = true; this.#finished = true; this.#release(denied()); this.#close(); }
        return this.#outcome;
    }
}
