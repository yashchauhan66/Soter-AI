import * as vscode from "vscode";
import { VAULT_RUNTIME_LIMITS } from "../../../core/src/VaultAppDescriptor";
import type { VaultAppJob } from "./VaultAppJob";

export interface VaultRunCoordinator { run(id: string, signal?: AbortSignal): Promise<VaultAppJob | undefined>; stop(id: string): void }
const WAITING = "STOP_UNCONFIRMED: waiting for the owned application to close.\r\n";
const WITHHELD = "Managed application output withheld.\r\n";
/** The native task carries only an opaque saved descriptor ID. No ambient or
 * selected env enters TaskDefinition or ProcessExecution options. */
export class VaultTaskTerminal implements vscode.Pseudoterminal {
    #writes = new vscode.EventEmitter<string>(); #closes = new vscode.EventEmitter<number>();
    readonly onDidWrite = this.#writes.event; readonly onDidClose = this.#closes.event;
    #controller = new AbortController(); #opened = false; #finished = false;
    #job: VaultAppJob | undefined; #waiting: ReturnType<typeof setTimeout> | undefined;
    constructor(private readonly runtime: VaultRunCoordinator, private readonly descriptorId: string) {}
    open(): void { if (this.#opened) return; this.#opened = true; void this.#run(); }
    close(): void {
        if (this.#finished || this.#controller.signal.aborted) return;
        this.#controller.abort(); if (this.#job) this.runtime.stop(this.#job.snapshot().id);
        this.#waiting = setTimeout(() => { if (!this.#finished && this.#job) this.#writes.fire(WAITING); }, VAULT_RUNTIME_LIMITS.stopGraceMs);
        this.#waiting.unref();
    }
    async #run(): Promise<void> {
        let code = 1;
        try {
            this.#job = await this.runtime.run(this.descriptorId, this.#controller.signal);
            if (!this.#job) return;
            if (this.#controller.signal.aborted) this.runtime.stop(this.#job.snapshot().id);
            const { snapshot, output } = await this.#job.completion; code = snapshot.exitCode ?? 1;
            if (output.status === "COMPLETE" && !this.#controller.signal.aborted) {
                if (output.stdout) this.#writes.fire(output.stdout.replace(/\n/g, "\r\n"));
                if (output.stderr) this.#writes.fire(output.stderr.replace(/\n/g, "\r\n"));
            } else this.#writes.fire(WITHHELD);
        } catch { this.#writes.fire(WITHHELD); }
        finally { this.#finished = true; if (this.#waiting) clearTimeout(this.#waiting); this.#closes.fire(code); this.#writes.dispose(); this.#closes.dispose(); }
    }
}
interface Request { seq: number; type: "request"; command: string; arguments?: Record<string, unknown> }
/** Owned lifecycle adapter only. It deliberately provides no source debugger,
 * expression evaluation or process/environment inspection requests. */
export class VaultDebugAdapter implements vscode.DebugAdapter {
    #events = new vscode.EventEmitter<vscode.DebugProtocolMessage>();
    readonly onDidSendMessage = this.#events.event;
    #seq = 0; #disposed = false; #launched = false; #configured = false; #started = false; #finished = false;
    #controller = new AbortController(); #job: VaultAppJob | undefined; #waiting: ReturnType<typeof setTimeout> | undefined;
    constructor(private readonly runtime: VaultRunCoordinator, private readonly descriptorId: string) {}
    handleMessage(message: vscode.DebugProtocolMessage): void {
        const request = message as Request;
        if (this.#disposed || !request || request.type !== "request") return;
        if (!Number.isInteger(request.seq) || request.seq < 0 || typeof request.command !== "string") return;
        switch (request.command) {
            case "initialize":
                this.#response(request, true, { supportsConfigurationDoneRequest: true, supportsTerminateRequest: true,
                    supportsEvaluateForHovers: false, supportsSetVariable: false, supportsReadMemoryRequest: false, supportsWriteMemoryRequest: false,
                    supportsFunctionBreakpoints: false, supportsDataBreakpoints: false, supportsInstructionBreakpoints: false, supportsSteppingGranularity: false });
                this.#event("initialized"); return;
            case "launch":
                if (!this.#validLaunch(request.arguments) || this.#controller.signal.aborted || this.#finished) { this.#response(request, false); return; }
                this.#launched = true; this.#response(request, true); this.#maybeRun(); return;
            case "configurationDone": this.#configured = true; this.#response(request, true); this.#maybeRun(); return;
            case "terminate": case "disconnect":
                this.#requestStop(); this.#response(request, true);
                if (!this.#started && !this.#finished) {
                    this.#finished = true; if (this.#waiting) clearTimeout(this.#waiting);
                    this.#event("exited", { exitCode: 0 }); this.#event("terminated");
                }
                return;
            default: this.#response(request, false); return;
        }
    }
    dispose(): void {
        if (this.#disposed) return; this.#disposed = true; this.#requestStop();
        if (!this.#started || this.#finished) { if (this.#waiting) clearTimeout(this.#waiting); this.#events.dispose(); }
    }
    #validLaunch(value: unknown): boolean {
        if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
        const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
        if (keys.length > 8 || keys.some(key => typeof key !== "string" || !["descriptorId", "type", "name", "request", "noDebug", "__sessionId", "internalConsoleOptions", "__configurationTarget"].includes(key)
            || !Object.hasOwn(fields[key], "value") || !fields[key].enumerable)) return false;
        if (fields.descriptorId?.value !== this.descriptorId) return false;
        return keys.every(key => {
            const data = fields[key as string].value;
            if (key === "noDebug") return typeof data === "boolean";
            if (key === "__configurationTarget" && Number.isInteger(data)) return data >= 1 && data <= 3;
            return typeof data === "string" && data.length <= 256 && !/[\x00-\x1f\x7f-\x9f]/u.test(data);
        });
    }
    #maybeRun(): void {
        if (this.#started || !this.#launched || !this.#configured || this.#controller.signal.aborted) return;
        this.#started = true; void this.#run();
    }
    async #run(): Promise<void> {
        let code = 1;
        try {
            this.#job = await this.runtime.run(this.descriptorId, this.#controller.signal);
            if (!this.#job) return;
            if (this.#controller.signal.aborted || this.#disposed) this.runtime.stop(this.#job.snapshot().id);
            if (!this.#disposed) this.#event("process", { name: "Vault app (lifecycle only)", systemProcessId: this.#job.snapshot().pid, isLocalProcess: true, startMethod: "launch" });
            const { snapshot, output } = await this.#job.completion; code = snapshot.exitCode ?? 1;
            if (!this.#disposed && output.status === "COMPLETE" && !this.#controller.signal.aborted) {
                if (output.stdout) this.#event("output", { category: "stdout", output: output.stdout });
                if (output.stderr) this.#event("output", { category: "stderr", output: output.stderr });
            }
        } catch { /* No raw exception, environment or app output fallback. */ }
        finally {
            this.#finished = true; if (this.#waiting) clearTimeout(this.#waiting);
            if (!this.#disposed) { this.#event("exited", { exitCode: code }); this.#event("terminated"); }
            if (this.#disposed) this.#events.dispose();
        }
    }
    #requestStop(): void {
        if (this.#finished || this.#controller.signal.aborted) return;
        this.#controller.abort(); if (this.#job) this.runtime.stop(this.#job.snapshot().id);
        this.#waiting = setTimeout(() => { if (!this.#finished && !this.#disposed && this.#job) this.#event("output", { category: "console", output: WAITING }); }, VAULT_RUNTIME_LIMITS.stopGraceMs);
        this.#waiting.unref();
    }
    #response(request: Request, success: boolean, body?: Record<string, unknown>): void {
        // Bound even a malicious unsupported request name; do not echo arguments.
        const command = /^[A-Za-z]{1,40}$/.test(request.command) ? request.command : "unsupported";
        this.#send({ type: "response", request_seq: request.seq, command, success,
            ...(body ? { body } : {}), ...(!success ? { message: "Request unavailable in the vault app lifecycle adapter." } : {}) });
    }
    #event(event: string, body?: Record<string, unknown>): void { this.#send({ type: "event", event, ...(body ? { body } : {}) }); }
    #send(message: Record<string, unknown>): void { if (!this.#disposed) this.#events.fire({ ...message, seq: ++this.#seq } as vscode.DebugProtocolMessage); }
}
