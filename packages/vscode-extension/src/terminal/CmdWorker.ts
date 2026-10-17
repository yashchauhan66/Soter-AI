import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import { CMD_LIMITS, cmdAsciiLiteral, cmdRelativePath } from "../../../core/src/CmdCommand";
import type { OutputChannel, OutputResult } from "../../../core/src/StreamingOutputRedactor";
import { powerShell51Environment, type PowerShell51Snapshot, type PowerShell51Completion, type PowerShell51Output } from "./PowerShell51Worker";
export const CMD_EXECUTABLE = "C:\\Windows\\System32\\cmd.exe";
type Options = { id: string; executable: string; root: string; operation: unknown; parentEnvironment: NodeJS.ProcessEnv; output: PowerShell51Output; enabled?: () => boolean };
type Dependencies = { spawn?: typeof spawn; setTimer?: (callback: () => void, ms: number) => unknown; clearTimer?: (handle: unknown) => void };
type Request = { command: string; cwd: string; input: string; literal: boolean; directory: boolean; delay?: number; expectedLiteral?: string };
const withheld = (): OutputResult => Object.freeze({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: "checked_command_withheld" });
function request(root: string, operation: unknown): Request {
    if (!operation || typeof operation !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(operation))) throw Error();
    const fields = Object.getOwnPropertyDescriptors(operation);
    if (Reflect.ownKeys(fields).length !== 3 || Reflect.ownKeys(fields).some(key => typeof key !== "string" || !["kind", "action", "args"].includes(key) || !Object.hasOwn(fields[key], "value") || !fields[key].enumerable)) throw Error();
    const { kind, action, args: raw } = operation as { kind: unknown; action: unknown; args: unknown };
    if (kind !== "PUBLIC" || !Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype || raw.length > 1) throw Error();
    const array = Object.getOwnPropertyDescriptors(raw); if (Reflect.ownKeys(array).length !== raw.length + 1) throw Error();
    const args: string[] = [];
    for (let index = 0; index < raw.length; index++) { const field = array[String(index)]; if (!field || !Object.hasOwn(field, "value") || !field.enumerable || typeof field.value !== "string") throw Error(); args.push(field.value); }
    const base = { cwd: root, input: "", literal: false, directory: false };
    if ((action === "version" || action === "location") && !args.length) return { ...base, command: action === "version" ? "ver" : "cd" };
    if (action === "list" && args.length === 1 && cmdRelativePath(args[0], true)) return { ...base, cwd: path.resolve(root, args[0]), directory: true, command: "dir /b /a" };
    if (action === "write" && args.length === 1 && cmdAsciiLiteral(args[0])) return args[0] ? { ...base, command: "set /p SOTERAI_LITERAL=&set SOTERAI_LITERAL", input: args[0] + "\r\n", literal: true, expectedLiteral: args[0] } : { ...base, command: "echo(" };
    if (action === "sleep" && args.length === 1 && /^(?:0|[1-9]\d{0,3})$/.test(args[0]) && Number(args[0]) <= CMD_LIMITS.maxSleepMs) return { ...base, command: "pause >nul", input: "\r\n", delay: Number(args[0]) };
    throw Error();
}
/** One fixed finite cmd operation. No user code/paths/values enter argv. */
export class CmdWorker {
    #id = "unavailable"; #state: PowerShell51Snapshot["state"] = "READY"; #pid?: number; #exitCode?: number;
    #request?: Request; #environment: NodeJS.ProcessEnv = {}; #output?: PowerShell51Output; #enabled: () => boolean;
    #spawn: typeof spawn; #setTimer: NonNullable<Dependencies["setTimer"]>; #clearTimer: NonNullable<Dependencies["clearTimer"]>; #timers = new Set<unknown>();
    #child?: ChildProcess; #started = false; #spawned = false; #failed = false; #cancelled = false; #closed = false; #finished = false;
    #ends = { stdout: false, stderr: false }; #drained = { stdout: false, stderr: false }; #buffers: Record<OutputChannel, Buffer[]> = { stdout: [], stderr: [] }; #bytes = 0; #chunks = 0;
    #resolve!: (value: PowerShell51Completion) => void; #completion: Promise<PowerShell51Completion>; #startResolve?: () => void;
    constructor(options: Options, deps: Dependencies = {}) {
        this.#completion = new Promise(done => { this.#resolve = done; }); this.#enabled = options?.enabled ?? (() => true);
        this.#spawn = deps.spawn ?? spawn; this.#setTimer = deps.setTimer ?? ((callback, ms) => { const timer = setTimeout(callback, ms); timer.unref(); return timer; }); this.#clearTimer = deps.clearTimer ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>));
        try {
            this.#output = options.output;
            if (typeof options.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options.id)) throw Error(); this.#id = options.id;
            if (options.executable !== CMD_EXECUTABLE || typeof options.root !== "string" || !path.isAbsolute(options.root) || /[\x00-\x1f\x7f-\x9f]/u.test(options.root)) throw Error();
            this.#request = request(options.root, options.operation); this.#environment = powerShell51Environment(options.parentEnvironment);
        } catch { this.#failed = true; this.#state = "BLOCKED"; this.#request = undefined; }
    }
    get completion(): Promise<PowerShell51Completion> { return this.#completion; }
    snapshot(): Readonly<PowerShell51Snapshot> { return Object.freeze({ id: this.#id, state: this.#state, ...(this.#pid === undefined ? {} : { pid: this.#pid }), ...(this.#exitCode === undefined ? {} : { exitCode: this.#exitCode }) }); }
    async start(): Promise<PowerShell51Snapshot> {
        if (this.#started || this.#finished) return this.snapshot(); this.#started = true;
        if (!this.#available() || !this.#request) { this.#withoutChild(); return this.snapshot(); }
        const started = new Promise<void>(done => { this.#startResolve = done; });
        try {
            const child = this.#spawn(CMD_EXECUTABLE, ["/d", "/q", "/u", "/e:on", "/v:off", "/s", "/c", this.#request.command], { cwd: this.#request.cwd, env: this.#environment, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
            this.#child = child; this.#environment = {}; if (Number.isInteger(child.pid) && child.pid! > 0) this.#pid = child.pid;
            child.once("spawn", () => {
                this.#spawned = true;
                if (!this.#cancelled && this.#available()) {
                    this.#state = "RUNNING";
                    const send = () => { try { child.stdin?.end(this.#request?.input ?? "", "ascii"); if (this.#request) this.#request.input = ""; } catch { this.cancel(); } };
                    if (this.#request?.delay !== undefined) this.#timer(send, this.#request.delay); else send();
                } else { this.cancel(); try { child.stdin?.end(); } catch { /* Retain actual close. */ } }
                this.#settleStart();
            });
            child.on("error", () => { this.#failed = true; if (!this.#spawned && this.#pid === undefined) this.#withoutChild(); else this.cancel(); this.#settleStart(); });
            child.once("close", code => { this.#closed = true; if (Number.isInteger(code) && code! >= -2147483648 && code! <= 2147483647) this.#exitCode = code!; if (!this.#ends.stdout || !this.#ends.stderr || this.#exitCode === undefined) this.cancel(); this.#settleStart(); this.#tryFinish(); });
            for (const channel of ["stdout", "stderr"] as const) {
                const stream = child[channel]; if (!stream) { this.#drained[channel] = true; this.cancel(); continue; }
                stream.on("data", bytes => this.#data(channel, bytes)); stream.once("end", () => { this.#ends[channel] = true; this.#drained[channel] = true; this.#tryFinish(); }); stream.on("error", () => this.cancel()); stream.once("close", () => { this.#drained[channel] = true; if (!this.#ends[channel]) this.cancel(); this.#tryFinish(); });
            }
            if (!child.stdin) this.cancel(); else child.stdin.on("error", () => this.cancel()); this.#timer(() => this.cancel(), CMD_LIMITS.maxRuntimeMs); this.#poll();
        } catch { this.#failed = true; if (!this.#child) this.#withoutChild(); else this.cancel(); this.#settleStart(); }
        await started; return this.snapshot();
    }
    cancel(): void {
        if (this.#finished || this.#cancelled) return; this.#cancelled = true; this.#buffers = { stdout: [], stderr: [] };
        if (this.#request) { this.#request.input = this.#request.delay === undefined ? "" : "\r\n"; this.#request.expectedLiteral = undefined; }
        try { this.#output?.cancel(); } catch { /* Never fallback. */ }
        if (!this.#child) { this.#withoutChild(); return; } this.#state = "CANCEL_PENDING";
        this.#timer(() => { if (!this.#closed && !this.#finished) this.#state = "STOP_UNCONFIRMED"; }, CMD_LIMITS.stopGraceMs);
    }
    dispose(): void { this.cancel(); }
    #available(): boolean { if (this.#cancelled || this.#finished || this.#failed) return false; try { return this.#enabled() === true && !this.#cancelled && !this.#finished && !this.#failed; } catch { return false; } }
    #data(channel: OutputChannel, bytes: unknown): void {
        if (this.#finished || this.#cancelled) return;
        if (!this.#available() || !(bytes instanceof Uint8Array) || ++this.#chunks > CMD_LIMITS.maxRawChunks || (this.#bytes += bytes.byteLength) > CMD_LIMITS.maxRawOutputBytes) { this.cancel(); return; }
        this.#buffers[channel].push(Buffer.from(bytes));
    }
    #timer(callback: () => void, ms: number): void { let handle: unknown; handle = this.#setTimer(() => { this.#timers.delete(handle); callback(); }, ms); this.#timers.add(handle); }
    #poll(): void { this.#timer(() => { if (this.#closed || this.#finished || this.#cancelled) return; if (!this.#available()) this.cancel(); else this.#poll(); }, 250); }
    #settleStart(): void { this.#startResolve?.(); this.#startResolve = undefined; }
    #withoutChild(): void { this.#state = this.#failed || !this.#cancelled ? "BLOCKED" : "CANCELLED"; this.#complete(withheld()); }
    #tryFinish(): void {
        if (!this.#closed || !this.#drained.stdout || !this.#drained.stderr || this.#finished) return; let output = withheld();
        try {
            if (this.#available() && this.#exitCode === 0) {
                const texts = { stdout: new TextDecoder("utf-16le", { fatal: true }).decode(Buffer.concat(this.#buffers.stdout)), stderr: new TextDecoder("utf-16le", { fatal: true }).decode(Buffer.concat(this.#buffers.stderr)) };
                if (this.#request?.literal) { const prefix = "SOTERAI_LITERAL="; if (texts.stdout !== prefix + this.#request.expectedLiteral + "\r\n" || texts.stderr) throw Error(); texts.stdout = texts.stdout.slice(prefix.length); }
                if (this.#request?.directory && texts.stdout.split(/\r?\n/).filter(Boolean).length > CMD_LIMITS.maxListEntries) throw Error();
                for (const channel of ["stdout", "stderr"] as const) if (texts[channel] && this.#output?.push(channel, Buffer.from(texts[channel], "utf8")).status !== "BUFFERED") throw Error();
                if (this.#available()) output = this.#output?.finish(0) ?? withheld();
            }
        } catch { output = withheld(); }
        if (!this.#available()) output = withheld(); this.#state = this.#failed ? "BLOCKED" : this.#cancelled ? "CANCELLED" : "EXITED"; this.#complete(output);
    }
    #complete(output: OutputResult): void {
        if (this.#finished) return; this.#finished = true; this.#request = undefined; this.#environment = {}; this.#buffers = { stdout: [], stderr: [] }; this.#child = undefined;
        try { this.#output?.dispose(); } catch { /* No original retained. */ } this.#output = undefined; for (const timer of this.#timers) this.#clearTimer(timer); this.#timers.clear(); this.#settleStart(); this.#resolve(Object.freeze({ snapshot: this.snapshot(), output }));
    }
}
