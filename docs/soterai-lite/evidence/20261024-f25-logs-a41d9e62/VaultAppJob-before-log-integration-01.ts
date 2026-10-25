import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import { RegisteredSecretMatcher } from "../../../core/src/RegisteredSecretMatcher";
import { StreamingOutputRedactor, type OutputResult, type OutputChannel } from "../../../core/src/StreamingOutputRedactor";
import { parseVaultAppDescriptor, VAULT_RUNTIME_LIMITS, type VaultAppDescriptor } from "../../../core/src/VaultAppDescriptor";
import { brokerChildEnvironment } from "../security/childEnvironment";

export type VaultAppJobState = "READY" | "BLOCKED" | "RUNNING" | "STOP_REQUESTED" | "STOP_UNCONFIRMED" | "EXITED" | "STOPPED" | "CANCELLED";
export interface VaultAppJobSnapshot { readonly id: string; readonly state: VaultAppJobState; readonly pid?: number; readonly exitCode?: number }
export interface VaultAppJobCompletion { readonly snapshot: VaultAppJobSnapshot; readonly output: OutputResult }
interface Options { descriptor: VaultAppDescriptor; values: Readonly<Record<string, string>>;
    runtime: { executable: string; electron: boolean }; parentEnvironment: NodeJS.ProcessEnv; enabled?: () => boolean }
interface Dependencies { spawn?: typeof spawn; setTimer?: (callback: () => void, ms: number) => unknown; clearTimer?: (handle: unknown) => void }

// Fixed trusted source, never supplied by a command. Values enter this already
// attested child via private IPC, never argv, spawn.env or an intermediate file.
const BOOTSTRAP = String.raw`
"use strict";
const controller = new AbortController();
let accepted = false, stopped = false, moduleValue, stopCalled = false;
const waiting = setTimeout(() => stop(), 5000);
function stop() {
  clearTimeout(waiting);
  if (!stopped) { stopped = true; controller.abort(); }
  if (!stopCalled && moduleValue) {
    stopCalled = true;
    const fn = moduleValue.stop || (moduleValue.default && moduleValue.default.stop);
    if (typeof fn === "function") Promise.resolve().then(() => fn()).catch(fail);
  }
}
function fail() { process.stderr.write("Managed application failed.\n"); process.exitCode = 1; }
process.on("disconnect", stop);
process.on("message", message => {
  if (message && message.type === "STOP") { stop(); return; }
  if (stopped || accepted || !message || message.type !== "START") return;
  clearTimeout(waiting);
  accepted = true;
  const values = message.values;
  if (!values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).length > 32) { stop(); fail(); return; }
  for (const [name, value] of Object.entries(values)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name) || typeof value !== "string" || value.includes("\0")) { stop(); fail(); return; }
  }
  for (const [name, value] of Object.entries(values)) process.env[name] = value;
  const entry = process.argv[1]; process.argv = [process.execPath, entry, ...process.argv.slice(2)];
  // This short keep-alive exists only while module initialization/start awaits.
  const pending = setInterval(() => {}, 1000);
  Promise.resolve().then(async () => {
    if (stopped) return;
    try { moduleValue = require(entry); }
    catch (error) {
      if (!error || error.code !== "ERR_REQUIRE_ESM" && error.code !== "ERR_REQUIRE_ASYNC_MODULE") throw error;
      if (stopped) return;
      moduleValue = await import(require("node:url").pathToFileURL(entry).href);
    }
    if (stopped) { stop(); return; }
    const start = moduleValue.start || (moduleValue.default && moduleValue.default.start);
    if (typeof start === "function") await start(controller.signal);
  }).catch(fail).finally(() => clearInterval(pending));
});
if (process.channel) process.channel.unref();
if (typeof process.send === "function") process.send({type:"READY"});
`;

function minimalEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const candidates = brokerChildEnvironment(source), result: NodeJS.ProcessEnv = {};
    for (const [name, value] of Object.entries(candidates)) {
        if (typeof value !== "string" || !value || value.length > 4096 || /[\x00-\x1f\x7f-\x9f]/u.test(value)) continue;
        if (["LANG", "LC_ALL", "TZ"].includes(name)) {
            if (/^[A-Za-z0-9_./@+:-]{1,128}$/.test(value)) result[name] = value;
        } else if ((path.isAbsolute(value) || /^[a-z]:\\/i.test(value)) && !value.startsWith("\\\\") && !value.startsWith("//")) result[name] = value;
    }
    return result;
}
const withheld = (): OutputResult => Object.freeze({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: "managed_application_withheld" });

/** An owned finite app, not a process sandbox. Stop is cooperative; only actual
 * close and drained pipes can resolve completion. Private state never reports
 * environment values, IPC payloads, raw output or input-bearing errors. */
export class VaultAppJob {
    #descriptor: VaultAppDescriptor | undefined;
    #id: string;
    #values: Readonly<Record<string, string>> | undefined;
    #environment: NodeJS.ProcessEnv = {};
    #executable = "";
    #enabled: () => boolean;
    #redactor: StreamingOutputRedactor | undefined;
    #replacementMatcher: RegisteredSecretMatcher | undefined;
    #shortOutput = false;
    #spawn: typeof spawn;
    #setTimer: NonNullable<Dependencies["setTimer"]>;
    #clearTimer: NonNullable<Dependencies["clearTimer"]>;
    #timers = new Set<unknown>();
    #child: ChildProcess | undefined;
    #state: VaultAppJobState = "READY";
    #pid: number | undefined;
    #exitCode: number | undefined;
    #started = false;
    #spawned = false;
    #released = false;
    #stopping = false;
    #cancelled = false;
    #failed = false;
    #closed = false;
    #finished = false;
    #ends = { stdout: false, stderr: false };
    #drained = { stdout: false, stderr: false };
    #resolve!: (value: VaultAppJobCompletion) => void;
    #completion: Promise<VaultAppJobCompletion>;
    #startResolve: (() => void) | undefined;
    constructor(options: Options, deps: Dependencies = {}) {
        this.#completion = new Promise(done => { this.#resolve = done; });
        this.#id = "unavailable";
        this.#enabled = options?.enabled ?? (() => true);
        this.#spawn = deps.spawn ?? spawn;
        this.#setTimer = deps.setTimer ?? ((callback, ms) => { const timer = setTimeout(callback, ms); timer.unref(); return timer; });
        this.#clearTimer = deps.clearTimer ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>));
        try {
            this.#descriptor = parseVaultAppDescriptor(options.descriptor); if (!this.#descriptor) throw new Error();
            this.#id = this.#descriptor.id;
            if (!path.isAbsolute(options.runtime.executable) || /[\x00-\x1f\x7f-\x9f]/u.test(options.runtime.executable)
                || typeof options.runtime.electron !== "boolean") throw new Error();
            this.#executable = options.runtime.executable;
            const input = options.values;
            if (!input || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error();
            const fields = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(fields), selections = this.#descriptor.selections;
            if (keys.length !== selections.length || keys.some(key => typeof key !== "string" || !selections.some(s => s.name === key)
                || !Object.hasOwn(fields[key], "value") || !fields[key].enumerable)) throw new Error();
            const values: Record<string, string> = {};
            for (const { name } of selections) {
                const value = fields[name].value;
                if (typeof value !== "string" || value.includes("\0")) throw new Error();
                Object.defineProperty(values, name, { value, enumerable: true });
            }
            const registrations = Object.values(values), matcher = new RegisteredSecretMatcher(registrations);
            if (matcher.inspectRequest([]).status !== "CLEAN") throw new Error();
            this.#replacementMatcher = matcher; this.#shortOutput = registrations.some(value => Array.from(value).length < 8);
            this.#values = Object.freeze(values); this.#environment = minimalEnvironment(options.parentEnvironment);
            if (options.runtime.electron) this.#environment.ELECTRON_RUN_AS_NODE = "1";
            this.#redactor = new StreamingOutputRedactor(Object.values(values), { enabled: () => this.#available() });
        } catch { this.#failed = true; this.#state = "BLOCKED"; this.#values = undefined; }
    }
    get completion(): Promise<VaultAppJobCompletion> { return this.#completion; }
    snapshot(): Readonly<VaultAppJobSnapshot> {
        return Object.freeze({ id: this.#id, state: this.#state, ...(this.#pid === undefined ? {} : { pid: this.#pid }),
            ...(this.#exitCode === undefined ? {} : { exitCode: this.#exitCode }) });
    }
    async start(): Promise<VaultAppJobSnapshot> {
        if (this.#started || this.#finished) return this.snapshot(); this.#started = true;
        if (this.#failed || this.#cancelled || this.#stopping || !this.#available()) { this.#finishWithoutChild(); return this.snapshot(); }
        const started = new Promise<void>(done => { this.#startResolve = done; });
        try {
            const d = this.#descriptor!;
            this.#child = this.#spawn(this.#executable, ["-e", BOOTSTRAP, "--", d.program, ...d.args], {
                cwd: d.cwd, env: this.#environment, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
            });
            this.#environment = {};
            const child = this.#child;
            if (Number.isInteger(child.pid) && child.pid! > 0) this.#pid = child.pid;
            child.once("spawn", () => { this.#spawned = true; if (!this.#stopping) this.#state = "RUNNING"; this.#startResolve?.(); this.#startResolve = undefined; });
            child.on("message", message => this.#message(message));
            child.on("error", () => {
                this.#failed = true; this.#redactor?.cancel(); this.#values = undefined;
                if (!this.#spawned && this.#pid === undefined) this.#finishWithoutChild(); else this.requestStop();
                this.#startResolve?.(); this.#startResolve = undefined;
            });
            // Register exit ownership before checking optional pipe objects.
            child.once("close", code => {
                this.#closed = true;
                if (Number.isInteger(code) && code! >= -2147483648 && code! <= 2147483647) this.#exitCode = code!;
                if (!this.#ends.stdout || !this.#ends.stderr || !this.#released || this.#exitCode === undefined) this.#redactor?.cancel();
                this.#startResolve?.(); this.#startResolve = undefined; this.#tryFinish();
            });
            for (const channel of ["stdout", "stderr"] as const) {
                const stream = child[channel];
                if (!stream) { this.#drained[channel] = true; this.#failed = true; this.requestStop(); continue; }
                stream.on("data", bytes => this.#data(channel, bytes));
                stream.once("end", () => { this.#ends[channel] = true; this.#drained[channel] = true; this.#tryFinish(); });
                stream.on("error", () => { this.#redactor?.cancel(); this.requestStop(); });
                stream.once("close", () => {
                    this.#drained[channel] = true;
                    if (!this.#ends[channel]) { this.#redactor?.cancel(); this.requestStop(); } this.#tryFinish();
                });
            }
            this.#timer(() => this.requestStop(), VAULT_RUNTIME_LIMITS.maxRuntimeMs);
            this.#poll();
        } catch { this.#failed = true; if (!this.#child) this.#finishWithoutChild(); else this.requestStop(); this.#startResolve?.(); this.#startResolve = undefined; }
        await started; return this.snapshot();
    }
    requestStop(): void {
        if (this.#finished || this.#stopping) return;
        this.#stopping = true; this.#values = undefined; this.#redactor?.cancel();
        if (!this.#child) { if (this.#started) this.#finishWithoutChild(); return; }
        this.#state = "STOP_REQUESTED";
        try { if (this.#child.connected) this.#child.send({ type: "STOP" }, () => {}); } catch { /* An IPC error is not exit proof. */ }
        this.#timer(() => { if (!this.#closed && !this.#finished) this.#state = "STOP_UNCONFIRMED"; }, VAULT_RUNTIME_LIMITS.stopGraceMs);
    }
    cancel(): void { if (this.#finished) return; this.#cancelled = true; this.requestStop(); if (!this.#started) { this.#started = true; this.#finishWithoutChild(); } }
    dispose(): void { this.cancel(); }
    #available(): boolean { if (this.#cancelled || this.#stopping || this.#finished || this.#failed) return false; try { return this.#enabled() === true && !this.#cancelled && !this.#stopping; } catch { return false; } }
    #message(message: unknown): void {
        if (this.#released || this.#finished || !message || typeof message !== "object" || Reflect.ownKeys(message).length !== 1
            || (message as { type?: unknown }).type !== "READY") return;
        if (!this.#available()) { this.requestStop(); return; }
        this.#released = true;
        const values = this.#values; this.#values = undefined;
        try { this.#child!.send({ type: "START", values }, error => { if (error) { this.#failed = true; this.requestStop(); } }); }
        catch { this.#failed = true; this.requestStop(); }
    }
    #data(channel: OutputChannel, bytes: unknown): void {
        if (this.#finished || this.#stopping) return;
        if (!this.#available() || !(bytes instanceof Uint8Array) || this.#redactor?.push(channel, bytes).status !== "BUFFERED") this.requestStop();
    }
    #timer(callback: () => void, ms: number): void {
        let handle: unknown; handle = this.#setTimer(() => { this.#timers.delete(handle); callback(); }, ms); this.#timers.add(handle);
    }
    #poll(): void { this.#timer(() => { if (this.#closed || this.#finished || this.#stopping) return; if (!this.#available()) this.requestStop(); else this.#poll(); }, 250); }
    #finishWithoutChild(): void {
        this.#state = this.#cancelled ? "CANCELLED" : this.#stopping && !this.#failed ? "STOPPED" : "BLOCKED";
        this.#complete(withheld());
    }
    #tryFinish(): void {
        if (!this.#closed || !this.#drained.stdout || !this.#drained.stderr || this.#finished) return;
        let output = this.#stopping || this.#failed || this.#exitCode === undefined ? withheld() : this.#redactor?.finish(this.#exitCode) ?? withheld();
        if (output.status === "COMPLETE" && this.#shortOutput && (output.stdout || output.stderr)) {
            const marker = "[REDACTED_SECRET_OUTPUT]", stdout = output.stdout ? marker : "", stderr = output.stderr ? marker : "";
            output = this.#replacementMatcher?.isSafeReplacement(stdout + stderr)
                ? Object.freeze({ status: "COMPLETE", stdout, stderr, redacted: true, exitCode: output.exitCode }) : withheld();
        }
        this.#state = this.#failed ? "BLOCKED" : this.#cancelled ? "CANCELLED" : this.#stopping ? "STOPPED" : "EXITED"; this.#complete(output);
    }
    #complete(output: OutputResult): void {
        if (this.#finished) return; this.#finished = true; this.#values = undefined; this.#environment = {}; this.#descriptor = undefined;
        this.#redactor?.dispose(); this.#redactor = undefined; this.#child = undefined;
        this.#replacementMatcher = undefined;
        for (const timer of this.#timers) this.#clearTimer(timer); this.#timers.clear();
        this.#resolve(Object.freeze({ snapshot: this.snapshot(), output }));
    }
}
