import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";

// Frozen F10 design05 PTY contract. Native EventEmitter plumbing comes from the
// real phase2 VS Code stub; sessions below are finite deferred test doubles.
// No process, file, profile, command history or real credentials are accessed.
const PRIVATE = "SYNTHETIC_F10_HIDDEN_INPUT_NEVER_ECHOED_qZ7";
const MASK = "[REDACTED_SECRET_OUTPUT]";
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
const flush = async () => { await tick(); await tick(); };
const complete = (stdout = "public output\n", stderr = "", exitCode = 0): OutputResult => Object.freeze({ status: "COMPLETE", stdout, stderr, redacted: false, exitCode });
const withheld = (): OutputResult => Object.freeze({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: "synthetic_withheld" });
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function safe(value: unknown): void { assert.ok(!JSON.stringify(value).includes(PRIVATE), "Terminal events/results must never echo a hidden command or exception."); }
async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(label)), 600); })]); }
    finally { if (timer) clearTimeout(timer); }
}
async function fixture(mode: "immediate" | "held" | "throw" = "immediate") {
    const module = await import("../terminal/PowerShell51Terminal"), calls: unknown[] = [], pending = deferred<OutputResult>();
    let state: "IDLE" | "BUSY" | "CLOSED" = "IDLE", workerState = "RUNNING", cancellations = 0, disposals = 0, active = false;
    const currentState = (): "IDLE" | "BUSY" | "CLOSED" => state;
    const session = {
        async execute(input: unknown) {
            calls.push(input); state = "BUSY"; active = true;
            try { if (mode === "throw") throw new Error(PRIVATE); return mode === "held" ? await pending.promise : complete(); }
            finally { active = false; if (currentState() !== "CLOSED") state = "IDLE"; }
        },
        snapshot() { return Object.freeze({ state, ...(active ? { worker: Object.freeze({ id: "a32e1594-e5c7-44d6-b0b2-2f0856adb92c", state: workerState, pid: 46123 }) } : {}) }); },
        cancel() { cancellations++; }, dispose() { disposals++; state = "CLOSED"; },
    };
    const terminal = new module.PowerShell51Terminal(session as unknown as ConstructorParameters<typeof module.PowerShell51Terminal>[0]);
    const writes: string[] = [], closes: (number | void)[] = [];
    const a = terminal.onDidWrite(text => writes.push(text)), b = terminal.onDidClose!(code => closes.push(code)); terminal.open();
    const baseline = writes.length;
    return { module, terminal, session, calls, pending, writes, closes, baseline, get cancellations() { return cancellations; }, get disposals() { return disposals; },
        unconfirmed() { workerState = "STOP_UNCONFIRMED"; },
        async cleanup() { pending.resolve(withheld()); await flush(); terminal.close(); await flush(); a.dispose(); b.dispose(); } };
}

test("F10-T01 exported local help explains declared checks and bypass limits without invoking the session", async t => {
    const f = await fixture(); t.after(() => f.cleanup());
    const help = Object.values(f.module).find(value => typeof value === "string" && /Managed checks/i.test(value));
    assert.equal(typeof help, "string"); assert.match(help as string, /declared commands/i); assert.match(help as string, /bypass|unmanaged|independent|outside/i);
    f.terminal.handleInput("help\r"); await flush(); assert.equal(f.calls.length, 0); assert.ok(f.writes.join("").includes("Managed checks")); safe(f.writes);
});

test("F10-T02 input stays hidden before submission and only the completed sanitized result is emitted", async t => {
    const f = await fixture("held"); t.after(() => f.cleanup()); const command = "Write-Output '" + PRIVATE + "'";
    f.terminal.handleInput(command); await flush(); assert.equal(f.calls.length, 0); assert.equal(f.writes.length, f.baseline); safe(f.writes);
    f.terminal.handleInput("\r"); await flush(); assert.deepEqual(f.calls, [command]); assert.equal(f.writes.length, f.baseline); assert.equal(f.closes.length, 0);
    f.pending.resolve(Object.freeze({ ...complete(MASK), redacted: true })); await flush(); assert.ok(f.writes.slice(f.baseline).join("").includes(MASK)); safe(f.writes);
});

test("F10-T03 a CRLF pair submits a whole line once whether delivered together or in split callbacks", async t => {
    const a = await fixture(); t.after(() => a.cleanup()); a.terminal.handleInput("Get-Date\r\n"); await flush(); assert.deepEqual(a.calls, ["Get-Date"]);
    const b = await fixture(); t.after(() => b.cleanup()); b.terminal.handleInput("Get-Location\r"); await flush(); b.terminal.handleInput("\n"); await flush(); assert.deepEqual(b.calls, ["Get-Location"]);
});

for (const key of ["\x08", "\x7f"] as const) {
    test(`F10-T04-${key === "\x08" ? "BS" : "DEL"} backspace removes exactly one Unicode scalar without exposing surrogate fragments`, async t => {
        const f = await fixture(); t.after(() => f.cleanup()); f.terminal.handleInput('Write-Output "public \ud83e\uddedX'); f.terminal.handleInput(key + key); f.terminal.handleInput('Z"\r'); await flush();
        assert.deepEqual(f.calls, ['Write-Output "public Z"']); safe(f.writes);
    });
}

test("F10-T05 the inclusive 4096-byte input limit is measured in UTF8 rather than UTF16 units", async t => {
    const f = await fixture(); t.after(() => f.cleanup()); const text = "\u00e9".repeat(2048); assert.equal(Buffer.byteLength(text), 4096);
    f.terminal.handleInput(text + "\r"); await flush(); assert.deepEqual(f.calls, [text]);
});

test("F10-T06 a UTF8 overflow invalidates the whole line through enter and the next line starts cleanly", async t => {
    const f = await fixture(); t.after(() => f.cleanup()); f.terminal.handleInput("\u00e9".repeat(2049)); f.terminal.handleInput("Get-Date\r"); await flush(); assert.equal(f.calls.length, 0);
    f.terminal.handleInput("Get-Location\r"); await flush(); assert.deepEqual(f.calls, ["Get-Location"]); safe(f.writes);
});

for (const control of ["\x00", "\x01", "\x1a", "\t", "\x1b[A"] as const) {
    test(`F10-T07-${Buffer.from(control).toString("hex")} unsupported controls invalidate the whole current line instead of dropping a dangerous fragment`, async t => {
        const f = await fixture(); t.after(() => f.cleanup()); f.terminal.handleInput("Write-Output public" + control + PRIVATE); f.terminal.handleInput("\x08\r"); await flush();
        assert.equal(f.calls.length, 0); safe(f.writes); f.terminal.handleInput("Get-Date\r"); await flush(); assert.deepEqual(f.calls, ["Get-Date"]);
    });
}

test("F10-T08 malformed UTF16 input is rejected as a whole rather than lossy UTF8 replacement", async t => {
    const f = await fixture(); t.after(() => f.cleanup()); f.terminal.handleInput("Write-Output public\ud800suffix\r"); await flush(); assert.equal(f.calls.length, 0); safe(f.writes);
});

test("F10-T09 local clear/help operate without session execution or raw command history", async t => {
    const f = await fixture(); t.after(() => f.cleanup()); f.terminal.handleInput("clear\r"); await flush(); f.terminal.handleInput("help\r"); await flush(); assert.equal(f.calls.length, 0);
    f.terminal.handleInput("Write-Output '" + PRIVATE + "'"); f.terminal.handleInput("\x03"); f.terminal.handleInput("\r"); await flush(); assert.equal(f.calls.length, 0); assert.ok(f.cancellations > 0); safe(f.writes);
});

test("F10-T10 Ctrl+C clears partial hidden input and revokes the session without executing its remainder", async t => {
    const f = await fixture(); t.after(() => f.cleanup()); f.terminal.handleInput("Write-Output '" + PRIVATE); f.terminal.handleInput("\x03"); f.terminal.handleInput("Get-Date\r"); await flush();
    assert.ok(f.cancellations > 0); assert.deepEqual(f.calls, ["Get-Date"]); safe(f.writes);
});

test("F10-T11 one held command blocks programmatic and typed submissions without queuing them", async t => {
    const f = await fixture("held"); t.after(() => f.cleanup()); const first = f.terminal.run("Get-Date"); await flush();
    const second = await bounded(f.terminal.run("Write-Output '" + PRIVATE + "'"), "A busy run must decline without waiting for the first command."); assert.equal(second.status, "WITHHELD");
    f.terminal.handleInput("Get-Location\r"); await flush(); assert.deepEqual(f.calls, ["Get-Date"]); f.pending.resolve(complete()); await bounded(first, "Owned held run did not finish.");
    f.terminal.handleInput("\r"); await flush(); assert.deepEqual(f.calls, ["Get-Date"]); safe(f.writes); safe(second);
});

test("F10-T12 Ctrl+C requests cancellation while BUSY and retains the pending operation until actual completion", async t => {
    const f = await fixture("held"); t.after(() => f.cleanup()); const pending = f.terminal.run("sleep -Milliseconds 2000"); await flush(); f.terminal.handleInput("\x03"); await flush();
    assert.ok(f.cancellations > 0); assert.equal(f.closes.length, 0); const busy = await bounded(f.terminal.run("Get-Date"), "Cancelled owned work must stay busy until completion."); assert.equal(busy.status, "WITHHELD"); assert.equal(f.calls.length, 1);
    f.pending.resolve(withheld()); const result = await bounded(pending, "Cancelled command did not settle after actual completion."); assert.equal(result.status, "WITHHELD"); safe(result); safe(f.writes);
});

test("F10-T13 completed normalized stdout/stderr use CRLF and retain nonzero status without raw input echo", async t => {
    const f = await fixture("held"); t.after(() => f.cleanup()); const pending = f.terminal.run("Write-Output '" + PRIVATE + "'"); await flush();
    f.pending.resolve(complete("public caf\u00e9 \u96ea\nnext line\n", "public warning\n", 7)); const result = await bounded(pending, "Completed output did not settle."); await flush();
    assert.equal(result.exitCode, 7); const text = f.writes.slice(f.baseline).join(""); assert.ok(text.includes("public caf\u00e9 \u96ea\r\nnext line\r\n")); assert.ok(text.includes("public warning\r\n")); assert.ok(!text.includes("\r\r\n")); safe(result); safe(f.writes);
});

test("F10-T14 WITHHELD results and thrown input-bearing errors emit only fixed explanations", async t => {
    const a = await fixture("held"); t.after(() => a.cleanup()); const pending = a.terminal.run("Get-Date"); await flush();
    a.pending.resolve({ status: "WITHHELD", stdout: PRIVATE, stderr: PRIVATE, redacted: false, reason: PRIVATE }); await bounded(pending, "Withheld result did not settle."); await flush(); safe(a.writes);
    const b = await fixture("throw"); t.after(() => b.cleanup()); const result = await bounded(b.terminal.run(PRIVATE), "Thrown session error did not become a fixed withheld result."); assert.equal(result.status, "WITHHELD"); assert.equal(result.stdout, ""); assert.equal(result.stderr, ""); safe(result); safe(b.writes);
});

test("F10-T15 close disposes the owned session but onDidClose waits for a held command's actual completion", async t => {
    const f = await fixture("held"); t.after(() => f.cleanup()); const pending = f.terminal.run("Get-Date"); await flush(); f.terminal.close(); f.terminal.close(); await flush();
    assert.ok(f.disposals > 0); assert.equal(f.closes.length, 0); assert.equal(f.calls.length, 1); f.pending.resolve(withheld()); await bounded(pending, "Closed pending command did not settle."); await flush();
    assert.equal(f.closes.length, 1); assert.equal((await bounded(f.terminal.run("Get-Location"), "A closed terminal must decline immediately.")).status, "WITHHELD"); assert.equal(f.calls.length, 1); safe(f.writes);
});

test("F10-T16 an unresolved close remains visibly STOP_UNCONFIRMED rather than claiming a child exit", { timeout: 2500 }, async t => {
    const f = await fixture("held"); t.after(() => f.cleanup()); const pending = f.terminal.run("sleep -Milliseconds 2000"); await flush(); f.terminal.close(); f.unconfirmed();
    await new Promise<void>(done => setTimeout(done, 1125)); assert.equal(f.closes.length, 0); assert.match(f.writes.slice(f.baseline).join(""), /STOP_UNCONFIRMED|waiting|still running/i); safe(f.writes);
    f.pending.resolve(withheld()); await bounded(pending, "Unconfirmed close did not settle after actual completion."); await flush(); assert.equal(f.closes.length, 1);
});

test("F10-T17 close without owned work emits one close and never invokes a session command", async t => {
    const f = await fixture(); t.after(() => f.cleanup()); f.terminal.close(); f.terminal.close(); await flush(); assert.equal(f.calls.length, 0); assert.equal(f.closes.length, 1); assert.ok(f.disposals > 0); safe(f.writes);
});
