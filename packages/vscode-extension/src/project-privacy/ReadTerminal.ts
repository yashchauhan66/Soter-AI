import * as vscode from "vscode";
import { terminalSafeText } from "./SafeFileView";
import type { AccessResult } from "./ProjectFileAccess";

export const READ_TERMINAL_HELP = "Project read terminal: read <relative path>, help, clear.\r\n"
    + "Each read needs a new editor approval. Environment values stay masked.\r\n"
    + "This is not an OS shell and does not intercept other terminals. Input is not echoed.\r\n";

export function parseReadCommand(line: string): string | undefined {
    const match = /^read[ \t]+(.+)$/.exec(line.trim());
    if (!match) return undefined;
    const target = match[1].trim();
    if (!target || target.length > 4096 || /[\x00-\x1f\x7f]/.test(target)) return undefined;
    return target;
}

/** A fixed reader frontend. There is deliberately no process/shell launch API here. */
export class ProjectReadTerminal implements vscode.Pseudoterminal {
    private readonly output = new vscode.EventEmitter<string>();
    readonly onDidWrite = this.output.event;
    private line = "";
    private busy = false;
    private closed = false;
    private overflow = false;
    constructor(private readonly read: (relativePath: string) => Promise<AccessResult>, private readonly revoke: () => void) {}

    open(): void { this.write(READ_TERMINAL_HELP + "project-read> "); }
    close(): void { this.closed = true; this.revoke(); this.output.dispose(); }

    handleInput(input: string): void {
        if (this.closed) return;
        for (const char of input) {
            if (char === "\x03") {
                this.line = ""; this.overflow = false; this.revoke(); this.write("\r\nPending reads revoked.\r\nproject-read> ");
            } else if (char === "\x7f" || char === "\b") this.line = this.line.slice(0, -1);
            else if (char === "\r" || char === "\n") {
                if (this.overflow) { this.overflow = false; this.line = ""; continue; }
                const line = this.line; this.line = "";
                if (line.trim()) void this.execute(line);
            } else if (!/[\x00-\x1f\x7f-\x9f]/.test(char)) {
                if (this.overflow) continue;
                if (this.line.length >= 4096) { this.line = ""; this.overflow = true; this.write("\r\nInput limit exceeded.\r\nproject-read> "); }
                else this.line += char;
            }
        }
    }

    private async execute(line: string): Promise<void> {
        if (this.busy) { this.write("\r\nA read is already awaiting review.\r\n"); return; }
        if (line.trim() === "help") { this.write("\r\n" + READ_TERMINAL_HELP + "project-read> "); return; }
        if (line.trim() === "clear") { this.write("\x1b[2J\x1b[Hproject-read> "); return; }
        const target = parseReadCommand(line);
        if (!target) { this.write("\r\nOnly read <relative path>, help and clear are supported.\r\nproject-read> "); return; }
        this.busy = true;
        this.write("\r\nReview this read in the editor. No file content has been released.\r\n");
        try {
            const result = await this.read(target);
            this.write(result.status === "ALLOWED_ONCE"
                ? terminalSafeText(result.text).replace(/\r?\n/g, "\r\n") + "\r\n"
                : `Read withheld: ${result.status}.\r\n`);
        } catch { this.write("Read withheld: UNAVAILABLE.\r\n"); }
        finally { this.busy = false; this.write("project-read> "); }
    }

    private write(text: string): void { if (!this.closed) this.output.fire(text); }
}
