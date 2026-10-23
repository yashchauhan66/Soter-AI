import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PowerShell51Terminal } from "../terminal/PowerShell51Terminal";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";

// Review fixtures use a trusted finite session double to isolate the PTY's
// own admission and pre-execution cancellation. No process, file or profile.
const PRIVATE = "synthetic-f10-pty-review-command-value-Qk38";
function complete(): OutputResult { return Object.freeze({ status: "COMPLETE", stdout: "public completed output\n", stderr: "", redacted: false, exitCode: 0 }); }
function fixture() {
    const calls: unknown[] = [], writes: string[] = [], closes: unknown[] = [];
    let cancellations = 0, disposals = 0;
    const pty = new PowerShell51Terminal({ execute: async input => { calls.push(input); return complete(); },
        cancel: () => { cancellations++; }, dispose: () => { disposals++; }, snapshot: () => ({ state: "IDLE" }) });
    const a = pty.onDidWrite(value => writes.push(value)), b = pty.onDidClose(value => closes.push(value));
    return { pty, calls, writes, closes, get cancellations() { return cancellations; }, get disposals() { return disposals; },
        dispose() { pty.close(); a.dispose(); b.dispose(); } };
}
function withheld(result: OutputResult): void {
    assert.equal(result.status, "WITHHELD"); assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
    assert.ok(!JSON.stringify(result).includes(PRIVATE));
}

test("F10-TR01 same-turn Ctrl+C withdraws the reserved run before deferred session execution", async t => {
    const f = fixture(); t.after(() => f.dispose());
    const run = f.pty.run("Write-Output '" + PRIVATE + "'"); f.pty.handleInput("\x03");
    const result = await run;
    assert.equal(f.calls.length, 0, "A command canceled before execution must not enter the session as a fresh generation.");
    assert.equal(f.cancellations, 1); withheld(result); assert.ok(!f.writes.join("").includes(PRIVATE));
    assert.equal((await f.pty.run("Get-Date")).status, "COMPLETE", "Cancellation must leave later deliberate submissions available.");
    assert.deepEqual(f.calls, ["Get-Date"]);
});

test("F10-TR02 same-turn close withdraws the reserved run before deferred session execution", async t => {
    const f = fixture(); t.after(() => f.dispose());
    const run = f.pty.run("Write-Output '" + PRIVATE + "'"); f.pty.close();
    const result = await run;
    assert.equal(f.calls.length, 0, "A closed terminal must not invoke a reserved command in a later microtask.");
    assert.equal(f.disposals, 1); withheld(result); assert.equal(f.closes.length, 1);
    assert.ok(!f.writes.join("").includes("public completed output")); assert.ok(!f.writes.join("").includes(PRIVATE));
});

for (const [name, input] of [["ascii", "x".repeat(4097)], ["utf8", "\u00e9".repeat(2049)]] as const) {
    test(`F10-TR03-${name} programmatic run refuses over-4096-byte input before the trusted session`, async t => {
        const f = fixture(); t.after(() => f.dispose());
        withheld(await f.pty.run(input)); assert.equal(f.calls.length, 0); assert.ok(!f.writes.join("").includes(input));
    });
}

for (const [name, control] of [["NUL", "\x00"], ["TAB", "\t"], ["ESC", "\x1b"], ["CR", "\r"], ["LF", "\n"], ["LS", "\u2028"]] as const) {
    test(`F10-TR04-${name} programmatic run rejects the whole control-bearing line without repairing it`, async t => {
        const f = fixture(); t.after(() => f.dispose()); const input = "Get-Date" + control + PRIVATE;
        withheld(await f.pty.run(input)); assert.equal(f.calls.length, 0); assert.ok(!f.writes.join("").includes(PRIVATE));
    });
}

for (const [name, invalid] of [["high", "\ud800"], ["low", "\udc00"]] as const) {
    test(`F10-TR05-${name} programmatic run refuses malformed UTF16 before lossy UTF8 conversion`, async t => {
        const f = fixture(); t.after(() => f.dispose());
        withheld(await f.pty.run("Write-Output '" + invalid + PRIVATE + "'")); assert.equal(f.calls.length, 0); assert.ok(!f.writes.join("").includes(PRIVATE));
    });
}

for (const input of [null, { toString() { throw new Error(PRIVATE); } }]) {
    test(`F10-TR06-${input === null ? "null" : "object"} programmatic run refuses nonstrings without coercion or session execution`, async t => {
        const f = fixture(); t.after(() => f.dispose());
        withheld(await f.pty.run(input)); assert.equal(f.calls.length, 0); assert.ok(!f.writes.join("").includes(PRIVATE));
    });
}

for (const [name, input] of [["ascii", "x".repeat(4096)], ["utf8", "\u00e9".repeat(2048)]] as const) {
    test(`F10-TR07-${name} programmatic admission preserves inclusive valid 4096-byte strings for the parser`, async t => {
        const f = fixture(); t.after(() => f.dispose());
        const result = await f.pty.run(input); assert.equal(result.status, "COMPLETE"); assert.deepEqual(f.calls, [input]);
        assert.equal(f.writes.join(""), "public completed output\r\n");
    });
}
