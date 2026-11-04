import * as vscode from "vscode";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";
import type { CheckedPowerShellSession } from "./CheckedPowerShellSession";

export const POWERSHELL51_HELP = "Managed checks — declared commands\r\nHidden input; help and clear are local. Supported reads use one-time safe consent.\r\ngit status: staged names only; git diff --stat: staged statistics only. Unstaged/untracked files and history are not inspected.\r\nThis finite PowerShell 5.1 route cannot guard unmanaged shells, native reads or independent uploads.\r\n";
const withheld = (): OutputResult => Object.freeze({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: "checked_command_withheld" });
const crlf = (text: string): string => text.replace(/\r\n|\r|\n/g, "\r\n");

/** Hidden, bounded input for one owned finite checked session. No shell history. */
export class PowerShell51Terminal implements vscode.Pseudoterminal {
    #session: Pick<CheckedPowerShellSession, "execute" | "cancel" | "dispose" | "snapshot">;
    #write = new vscode.EventEmitter<string>();
    #close = new vscode.EventEmitter<number | void>();
    readonly onDidWrite = this.#write.event;
    readonly onDidClose = this.#close.event;
    #line = "";
    #invalid = false;
    #cr = false;
    #closed = false;
    #ended = false;
    #pending: Promise<OutputResult> | undefined;
    #generation = 0;
    #notice: ReturnType<typeof setTimeout> | undefined;
    #help: string;
    #clearCommand: string;
    constructor(session: Pick<CheckedPowerShellSession, "execute" | "cancel" | "dispose" | "snapshot">, help = POWERSHELL51_HELP, clearCommand = "clear") { this.#session = session; this.#help = help; this.#clearCommand = clearCommand; }
    open(): void { if (!this.#closed) this.#write.fire(this.#help); }
    #reset(): void { this.#line = ""; this.#invalid = false; }
    handleInput(data: string): void {
        if (this.#closed || typeof data !== "string") return;
        for (const scalar of data) {
            if (scalar === "\x03") { this.#generation++; this.#reset(); this.#cr = false; this.#session.cancel(); continue; }
            if (scalar === "\n" && this.#cr) { this.#cr = false; continue; }
            this.#cr = scalar === "\r";
            if (scalar === "\r" || scalar === "\n") {
                const line = this.#line, invalid = this.#invalid; this.#reset();
                if (this.#pending) continue;
                if (invalid || /[\ud800-\udfff]/u.test(line)) { this.#write.fire("Checked input withheld.\r\n"); continue; }
                if (!line) continue;
                if (line.toLowerCase() === "help") { this.#write.fire(this.#help); continue; }
                if (line.toLowerCase() === this.#clearCommand) { this.#write.fire("\x1b[2J\x1b[H"); continue; }
                void this.run(line); continue;
            }
            // While owned work is pending, typed input is discarded, never queued.
            if (this.#pending) continue;
            if (scalar === "\x08" || scalar === "\x7f") { this.#line = Array.from(this.#line).slice(0, -1).join(""); continue; }
            if (this.#invalid) continue;
            if (/[\x00-\x1f\x7f-\x9f]/u.test(scalar)) { this.#invalid = true; this.#line = ""; continue; }
            this.#line += scalar;
            if (Buffer.byteLength(this.#line, "utf8") > 4096) { this.#invalid = true; this.#line = ""; }
        }
    }
    run(input: unknown): Promise<OutputResult> {
        if (this.#closed || this.#pending || typeof input !== "string" || Buffer.byteLength(input, "utf8") > 4096
            || /[\x00-\x1f\x7f-\x9f\u2028\u2029\ud800-\udfff]/u.test(input)) return Promise.resolve(withheld());
        this.#reset();
        const generation = this.#generation;
        // Install the pending promise before invoking trusted code, including a
        // synchronous failure or callback, so reentrant work cannot be queued.
        const pending = Promise.resolve().then(() => this.#closed || generation !== this.#generation ? withheld() : this.#session.execute(input)).then(result => {
            if (result.status !== "COMPLETE") { this.#write.fire("Checked command withheld; no output released.\r\n"); return withheld(); }
            for (const text of [result.stdout, result.stderr]) if (text) this.#write.fire(crlf(text));
            return result;
        }, () => { this.#write.fire("Checked command unavailable; no output released.\r\n"); return withheld(); }).finally(() => {
            this.#pending = undefined;
            if (this.#closed) this.#finishClose();
        });
        this.#pending = pending;
        return pending;
    }
    close(): void {
        if (this.#closed) return;
        this.#closed = true; this.#generation++; this.#reset();
        this.#session.dispose();
        if (!this.#pending) this.#finishClose();
        else {
            this.#notice = setTimeout(() => { if (this.#pending) this.#write.fire("STOP_UNCONFIRMED: waiting for owned command completion.\r\n"); }, 1000);
            this.#notice.unref();
        }
    }
    #finishClose(): void {
        if (this.#ended) return;
        this.#ended = true;
        if (this.#notice) clearTimeout(this.#notice);
        this.#close.fire();
    }
}
