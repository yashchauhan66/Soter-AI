import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PowerShell51Terminal } from "../terminal/PowerShell51Terminal";
test("F12-PTY01 shared lifecycle accepts cmd-only help without PS claim", () => {
    const session = { execute: async () => ({ status: "WITHHELD" as const, stdout: "", stderr: "", redacted: false, reason: "test" }), cancel() {}, dispose() {}, snapshot: () => ({ state: "IDLE" as const }) };
    const pty = new PowerShell51Terminal(session, "CMD finite checked help\r\n", "cls"), out: string[] = []; pty.onDidWrite(value => out.push(value)); pty.open(); assert.deepEqual(out, ["CMD finite checked help\r\n"]); pty.close();
});
test("F12-PTY02 cls remains local and input never invokes the session", async () => {
    let calls = 0; const session = { execute: async () => { calls++; return { status: "WITHHELD" as const, stdout: "", stderr: "", redacted: false, reason: "test" }; }, cancel() {}, dispose() {}, snapshot: () => ({ state: "IDLE" as const }) };
    const pty = new PowerShell51Terminal(session, "CMD help\r\n", "cls"), out: string[] = []; pty.onDidWrite(value => out.push(value)); pty.handleInput("cls\r\n"); await new Promise<void>(done => setImmediate(done)); assert.equal(calls, 0); assert.deepEqual(out, ["\x1b[2J\x1b[H"]); pty.close();
});
