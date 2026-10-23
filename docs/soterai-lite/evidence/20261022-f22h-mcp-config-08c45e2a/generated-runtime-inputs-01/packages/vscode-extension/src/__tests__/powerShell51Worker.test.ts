import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { StreamingOutputRedactor, type OutputResult } from "../../../core/src/StreamingOutputRedactor";

// Frozen F10 worker fixtures. Mock children have actual pipes and controlled
// clocks; three finite Windows-only cases use only the existing pinned PS5.1.
// No tests run while authoring; no workspace scripts, kill or process.exit.
const EXECUTABLE = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const ID = "19a8a330-8e8b-4f85-8ec5-486ab6682e77";
const PRIVATE = "synthetic-f10-private-output-value-qZ9/with spaces";
const MASK = "[REDACTED_SECRET_OUTPUT]";
type PublicOperation = { kind: "PUBLIC"; action: "location" | "version" | "date" | "write" | "list" | "sleep"; args: readonly string[] };
type Snapshot = Readonly<{ id: string; state: string; pid?: number; exitCode?: number }>;
type Completion = { snapshot: Snapshot; output: OutputResult };
type Output = { push(channel: "stdout" | "stderr", bytes: Uint8Array): Readonly<{ status: "BUFFERED" | "WITHHELD" }>; finish(code: number): OutputResult; cancel(): void; dispose(): void };
type Options = { id: string; executable: string; root: string; operation: PublicOperation; parentEnvironment: NodeJS.ProcessEnv; output: Output; enabled?: () => boolean };
type Worker = { start(): Promise<Snapshot>; snapshot(): Snapshot; cancel(): void; dispose(): void; readonly completion: Promise<Completion> };
type Timer = { callback: () => void; ms: number; active: boolean };
type Constructor = new (options: Options, deps?: { spawn?: typeof spawn; setTimer?: (callback: () => void, ms: number) => unknown; clearTimer?: (handle: unknown) => void }) => Worker;
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
async function bounded<T>(promise: Promise<T>, label: string, ms = 400): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })]); }
    finally { if (timer) clearTimeout(timer); }
}
async function implementation(): Promise<Constructor> { const module = await import("../terminal/PowerShell51Worker"); assert.equal(typeof module.PowerShell51Worker, "function"); return module.PowerShell51Worker; }
async function operation(command: string): Promise<PublicOperation> {
    const module = await import("../../../core/src/PowerShell51Command"), value = module.parsePowerShell51Command(command);
    assert.ok(value && value.kind === "PUBLIC", "The frozen parser must supply a valid PUBLIC operation."); return value;
}
function safe(value: unknown): void { assert.ok(!JSON.stringify(value).includes(PRIVATE), "Worker snapshots/completions must not disclose original synthetic values or exceptions."); }
function withheld(value: Completion): void { assert.equal(value.output.status, "WITHHELD"); assert.equal(value.output.stdout, ""); assert.equal(value.output.stderr, ""); assert.equal(value.output.redacted, false); safe(value); }
function safeSnapshot(worker: Worker): Snapshot {
    const value = worker.snapshot(); assert.ok(Object.isFrozen(value)); assert.ok(Object.keys(value).every(key => ["id", "state", "pid", "exitCode"].includes(key))); safe(value); safe(worker); return value;
}
class Child extends EventEmitter {
    readonly stdin: PassThrough | null; readonly stdout: PassThrough | null; readonly stderr: PassThrough | null;
    readonly input: Buffer[] = []; readonly pid = 44123; killCalls = 0;
    constructor(missing?: "stdin" | "stdout" | "stderr") { super(); this.stdin = missing === "stdin" ? null : new PassThrough(); this.stdout = missing === "stdout" ? null : new PassThrough(); this.stderr = missing === "stderr" ? null : new PassThrough(); this.stdin?.on("data", chunk => this.input.push(Buffer.from(chunk))); }
    kill(): never { this.killCalls++; throw new Error("No process termination is authorized."); }
    async close(code = 0): Promise<void> { this.stdout?.end(); this.stderr?.end(); await tick(); this.emit("exit", code, null); this.emit("close", code, null); await tick(); }
}
async function fixture(overrides: Partial<Options> = {}, mode: "normal" | "throw" | "stdin" | "stdout" | "stderr" = "normal") {
    const Factory = await implementation(), child = new Child(mode === "stdin" || mode === "stdout" || mode === "stderr" ? mode : undefined), calls: { executable: string; args: readonly string[]; options: Record<string, unknown> }[] = [], timers: Timer[] = [];
    const options: Options = { id: ID, executable: EXECUTABLE, root: resolve(tmpdir(), "synthetic-f10-worker-not-created"), operation: await operation("Write-Output 'public note'"),
        parentEnvironment: Object.freeze({ SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", TEMP: "D:\\SoterAI-Lite-test-profiles\\f10-temp", TMP: "D:\\SoterAI-Lite-test-profiles\\f10-temp", LANG: "en_US.UTF-8", LC_ALL: "C", TZ: "UTC", PATH: "untrusted-search", HOME: "untrusted-home", USERPROFILE: "untrusted-home", OPENAI_API_KEY: PRIVATE, NODE_OPTIONS: "--require untrusted", HTTP_PROXY: PRIVATE, SOTERAI_CONTROL: PRIVATE }),
        output: new StreamingOutputRedactor([PRIVATE]), ...overrides };
    const worker = new Factory(options, {
        spawn: ((executable: string, args: readonly string[], spawnOptions: Record<string, unknown>) => { calls.push({ executable, args, options: spawnOptions }); if (mode === "throw") throw new Error(PRIVATE); queueMicrotask(() => child.emit("spawn")); return child as unknown as ChildProcess; }) as unknown as typeof spawn,
        setTimer(callback, ms) { const timer: Timer = { callback, ms, active: true }; timers.push(timer); return timer; }, clearTimer(handle) { (handle as Timer).active = false; },
    });
    let settled = false; void worker.completion.then(() => { settled = true; });
    return { worker, child, calls, options, timers, get settled() { return settled; },
        fire(ms: number) { const timer = timers.find(item => item.active && item.ms === ms); assert.ok(timer, "Frozen lifecycle timer must be present."); timer.active = false; timer.callback(); },
        async running() { const result = await bounded(worker.start(), "Spawn did not settle."); await tick(); assert.equal(result.state, "RUNNING"); assert.equal(calls.length, 1); safeSnapshot(worker); },
        async finish(code = 0) { await child.close(code); const result = await bounded(worker.completion, "Actual close and EOF did not finish the worker."); assert.equal(child.killCalls, 0); safeSnapshot(worker); return result; },
    };
}

test("F10-W01 fixed encoded script and literal JSON stdin never interpolate public arguments into argv", async () => {
    const literal = "public $(Get-Location); & punctuation", first = await fixture({ operation: { kind: "PUBLIC", action: "write", args: [literal, "caf\u00e9 \u96ea"] } }); await first.running();
    const call = first.calls[0]; assert.equal(call.executable, EXECUTABLE); assert.equal(call.options.shell, false); assert.equal(call.options.windowsHide, true); assert.equal(call.options.cwd, first.options.root);
    assert.deepEqual(call.args.slice(0, 4), ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand"]); assert.equal(call.args.length, 5);
    const encoded = call.args[4]; assert.equal(Buffer.from(encoded, "base64").toString("base64"), encoded); const script = Buffer.from(encoded, "base64").toString("utf16le");
    assert.ok(script.length > 0); assert.ok(!script.includes(literal)); safe(call.args); assert.equal(first.child.stdin?.writableEnded, true);
    const text = Buffer.concat(first.child.input).toString("utf8").trim(), request = JSON.parse(text), payload = request.operation ?? request;
    assert.equal(payload.action, "write"); assert.deepEqual(payload.args, [literal, "caf\u00e9 \u96ea"]); assert.ok(Buffer.byteLength(text) <= 16384);
    const second = await fixture({ operation: await operation("Get-Date") }); await second.running(); assert.equal(second.calls[0].args[4], encoded, "All operations use byte-identical trusted source.");
    await first.finish(); await second.finish();
});

test("F10-W02 fresh validated child environment excludes credentials, search paths, home, preload and proxy values", async () => {
    const f = await fixture(), before = JSON.stringify(f.options.parentEnvironment); await f.running(); const env = f.calls[0].options.env as NodeJS.ProcessEnv;
    assert.notEqual(env, f.options.parentEnvironment); assert.equal(JSON.stringify(f.options.parentEnvironment), before); assert.equal(env.SystemRoot, "C:\\Windows"); assert.equal(env.LANG, "en_US.UTF-8");
    for (const name of ["PATH", "HOME", "USERPROFILE", "OPENAI_API_KEY", "NODE_OPTIONS", "HTTP_PROXY", "SOTERAI_CONTROL"]) assert.equal(env[name], undefined, name);
    safe(env); await f.finish();
});

test("F10-W03 malformed inherited temp and locale values are omitted instead of forwarded", async () => {
    const f = await fixture({ parentEnvironment: { SystemRoot: "C:\\Windows", TEMP: "relative-path", TMP: "D:\\safe\0invalid", LANG: "C\nunsafe", LC_ALL: "C", TZ: "UTC\0invalid" } }); await f.running();
    const env = f.calls[0].options.env as NodeJS.ProcessEnv; assert.equal(env.SystemRoot, "C:\\Windows"); assert.equal(env.LC_ALL, "C"); for (const name of ["TEMP", "TMP", "LANG", "TZ"]) assert.equal(env[name], undefined); await f.finish();
});

for (const kind of ["read", "unknown-action", "extra-property", "non-array", "non-string", "control", "long-arg", "many-args", "large-request", "absolute-list", "parent-list", "sleep-bound", "location-args"] as const) {
    test(`F10-W04-${kind} invalid operation blocks before any process or protocol write`, async () => {
        let value: unknown = { kind: "PUBLIC", action: "write", args: ["public"] };
        if (kind === "read") value = { kind: "READ", path: ".env" };
        if (kind === "unknown-action") value = { kind: "PUBLIC", action: "Invoke-Expression", args: [PRIVATE] };
        if (kind === "extra-property") value = { kind: "PUBLIC", action: "write", args: ["public"], env: { TOKEN: PRIVATE } };
        if (kind === "non-array") value = { kind: "PUBLIC", action: "write", args: PRIVATE };
        if (kind === "non-string") value = { kind: "PUBLIC", action: "write", args: [17] };
        if (kind === "control") value = { kind: "PUBLIC", action: "write", args: ["public\0" + PRIVATE] };
        if (kind === "long-arg") value = { kind: "PUBLIC", action: "write", args: ["p".repeat(1025)] };
        if (kind === "many-args") value = { kind: "PUBLIC", action: "write", args: Array(33).fill("p") };
        if (kind === "large-request") value = { kind: "PUBLIC", action: "write", args: Array(17).fill("p".repeat(1024)) };
        if (kind === "absolute-list") value = { kind: "PUBLIC", action: "list", args: ["C:\\Windows"] };
        if (kind === "parent-list") value = { kind: "PUBLIC", action: "list", args: ["../outside"] };
        if (kind === "sleep-bound") { const valid = await operation("sleep -Milliseconds 10"); value = { ...valid, args: valid.args.map(arg => arg === "10" ? "2001" : arg) }; }
        if (kind === "location-args") value = { kind: "PUBLIC", action: "location", args: [PRIVATE] };
        const f = await fixture({ operation: value as PublicOperation }); assert.equal((await bounded(f.worker.start(), "Invalid operation start hung.")).state, "BLOCKED");
        assert.equal(f.calls.length, 0); assert.equal(f.child.input.length, 0); withheld(await bounded(f.worker.completion, "Invalid operation completion hung."));
    });
}

test("F10-W05 an invalid id is not copied into safe snapshots or completion metadata", async () => {
    const f = await fixture({ id: PRIVATE }); assert.equal(safeSnapshot(f.worker).state, "BLOCKED"); await f.worker.start(); assert.equal(f.calls.length, 0); withheld(await bounded(f.worker.completion, "Invalid id completion hung."));
});

test("F10-W06 disabled or throwing guard and cancellation before start prevent spawn", async () => {
    for (const mode of ["off", "throw", "cancel", "dispose"] as const) {
        const f = await fixture({ enabled: () => { if (mode === "throw") throw new Error(PRIVATE); return mode !== "off"; } });
        if (mode === "cancel") f.worker.cancel(); if (mode === "dispose") f.worker.dispose();
        assert.ok(["BLOCKED", "CANCELLED"].includes((await bounded(f.worker.start(), "Pre-start stop hung.")).state)); assert.equal(f.calls.length, 0); withheld(await bounded(f.worker.completion, "Pre-start completion hung."));
    }
});

test("F10-W07 start is single-use and no buffered raw chunk appears in snapshots or completion early", async () => {
    const f = await fixture(); await f.running(); f.child.stdout!.write(PRIVATE); await tick(); assert.equal(f.settled, false); safeSnapshot(f.worker); await f.worker.start(); assert.equal(f.calls.length, 1);
    const result = await f.finish(); assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, MASK); safe(result);
});

test("F10-W08 exit and both drained EOFs cannot release output before actual close", async () => {
    const f = await fixture(); await f.running(); f.child.stdout!.write("public output\r\n"); f.child.stderr!.write("public warning\n"); f.child.emit("exit", 7, null); await tick(); assert.equal(f.settled, false);
    f.child.stdout!.end(); await tick(); assert.equal(f.settled, false); f.child.stderr!.end(); await tick(); assert.equal(f.settled, false); f.child.emit("close", 7, null);
    const result = await bounded(f.worker.completion, "Drained close did not complete."); assert.deepEqual(result.output, { status: "COMPLETE", stdout: "public output\n", stderr: "public warning\n", redacted: false, exitCode: 7 }); assert.equal(result.snapshot.exitCode, 7);
});

test("F10-W09 real F08 output filtering masks ANSI and encoded values across byte chunks", async () => {
    for (const text of [PRIVATE.slice(0, 9) + "\x1b[31m" + PRIVATE.slice(9) + "\x1b[0m", Buffer.from(PRIVATE).toString("base64")]) {
        const f = await fixture(); await f.running(); for (const byte of Buffer.from(text)) f.child.stdout!.write(Buffer.from([byte])); f.child.stderr!.write("public warning");
        const result = await f.finish(3); assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, MASK); assert.equal(result.output.stderr, MASK); assert.equal(result.output.exitCode, 3); safe(result);
    }
});

test("F10-W10 invalid final UTF8 and terminal rewriting withhold previously buffered public output", async () => {
    for (const invalid of [Buffer.from([0xf0, 0x9f]), Buffer.from("\x1b[2J")]) {
        const f = await fixture(); await f.running(); f.child.stdout!.write("public prefix\n"); f.child.stderr!.write(invalid); withheld(await f.finish());
    }
});

test("F10-W11 overflow drains discarded stdout and stderr without releasing an undecided prefix", async () => {
    const f = await fixture(); await f.running(); f.child.stdout!.write(Buffer.alloc(131073, 0x70)); await tick(); assert.equal(f.settled, false); assert.equal(safeSnapshot(f.worker).state, "CANCEL_PENDING");
    for (let index = 0; index < 32; index++) { f.child.stdout!.write(PRIVATE); f.child.stderr!.write(PRIVATE); } await tick();
    assert.equal(f.child.stdout!.readableLength, 0); assert.equal(f.child.stderr!.readableLength, 0); withheld(await f.finish());
});

test("F10-W12 chunk budget overflow abandons output even under the byte limit", async () => {
    const f = await fixture(); await f.running(); for (let index = 0; index < 4097; index++) f.child.stdout!.write("p"); await tick(); assert.equal(f.settled, false); withheld(await f.finish());
});

test("F10-W13 cancellation after spawn retains the child until natural close and never calls kill", async () => {
    const f = await fixture(); await f.running(); f.child.stdout!.write(PRIVATE); f.worker.cancel(); await tick(); assert.equal(f.settled, false); assert.equal(safeSnapshot(f.worker).state, "CANCEL_PENDING");
    f.fire(1000); assert.equal(safeSnapshot(f.worker).state, "STOP_UNCONFIRMED"); assert.equal(f.settled, false); const result = await f.finish(); assert.equal(result.snapshot.state, "CANCELLED"); withheld(result);
});

test("F10-W14 thirty-second timeout waits for close and withholds output through the stop grace", async () => {
    const f = await fixture(); await f.running(); f.child.stdout!.write("public prefix\n"); f.fire(30000); assert.equal(safeSnapshot(f.worker).state, "CANCEL_PENDING");
    f.fire(1000); assert.equal(safeSnapshot(f.worker).state, "STOP_UNCONFIRMED"); assert.equal(f.settled, false); withheld(await f.finish());
});

test("F10-W15 withdrawal is sticky after reenable and later discarded bytes are still drained", async () => {
    let enabled = true; const f = await fixture({ enabled: () => enabled }); await f.running(); f.child.stdout!.write("public prefix\n"); enabled = false; f.child.stderr!.write(PRIVATE); await tick();
    assert.equal(safeSnapshot(f.worker).state, "CANCEL_PENDING"); enabled = true; f.child.stdout!.write("public later\n"); await tick(); assert.equal(f.child.stdout!.readableLength, 0); withheld(await f.finish());
});

test("F10-W16 spawn failure is BLOCKED while a post-spawn error is never treated as child exit", async () => {
    const failed = await fixture({}, "throw"); assert.equal((await bounded(failed.worker.start(), "Thrown spawn hung.")).state, "BLOCKED"); withheld(await bounded(failed.worker.completion, "Thrown spawn completion hung."));
    const running = await fixture(); await running.running(); running.child.emit("error", new Error(PRIVATE)); await tick(); assert.equal(running.settled, false); withheld(await running.finish());
});

for (const missing of ["stdin", "stdout", "stderr"] as const) {
    test(`F10-W17-${missing} missing pipe retains actual-close ownership and drains every available output pipe`, async () => {
        const f = await fixture({}, missing); await bounded(f.worker.start(), "Malformed child start hung.");
        f.child.stdout?.write(PRIVATE); f.child.stderr?.write(PRIVATE); await tick(); assert.equal(f.settled, false);
        if (f.child.stdout) assert.equal(f.child.stdout.readableLength, 0); if (f.child.stderr) assert.equal(f.child.stderr.readableLength, 0);
        withheld(await f.finish()); assert.ok(f.timers.every(timer => !timer.active));
    });
}

test("F10-W18 stdin and output stream errors are withheld and do not imply that a live child exited", async () => {
    for (const channel of ["stdin", "stdout", "stderr"] as const) {
        const f = await fixture(); await f.running(); assert.ok(f.child[channel]!.listenerCount("error") > 0); f.child[channel]!.emit("error", new Error(PRIVATE)); await tick(); assert.equal(f.settled, false); withheld(await f.finish());
    }
});

test("F10-W19 premature stream/child close without EOF cannot release a later public suffix", async () => {
    const f = await fixture(); await f.running(); f.child.stdout!.write("public prefix\n"); f.child.stdout!.emit("close"); f.child.emit("close", 0, null); await tick();
    f.child.stdout!.end("public suffix\n"); f.child.stderr!.end(); await tick(); withheld(await bounded(f.worker.completion, "Premature close lost completion ownership."));
});

test("F10-W20 structural output failures never fall back to raw buffered text", async () => {
    const output: Output = { push() { throw new Error(PRIVATE); }, finish() { throw new Error(PRIVATE); }, cancel() {}, dispose() {} };
    const f = await fixture({ output }); await f.running(); f.child.stdout!.write(PRIVATE); await tick(); assert.equal(f.settled, false); withheld(await f.finish());
});

async function actual(command: string) {
    const Factory = await implementation(); return new Factory({ id: ID, executable: EXECUTABLE, root: tmpdir(), operation: await operation(command),
        parentEnvironment: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: tmpdir(), TMP: tmpdir(), LANG: "C", OPENAI_API_KEY: PRIVATE, PATH: "untrusted-search", NODE_OPTIONS: "--require untrusted" }, output: new StreamingOutputRedactor([PRIVATE]) });
}
test("F10-W21 actual pinned finite PowerShell reports version 5.1 through completed UTF8 output", { skip: process.platform !== "win32", timeout: 8000 }, async () => {
    const worker = await actual("version"); assert.equal((await worker.start()).state, "RUNNING"); const result = await bounded(worker.completion, "Finite installed version operation did not close.", 7000);
    assert.equal(result.output.status, "COMPLETE"); assert.match(result.output.stdout.trim(), /^5\.1(?:\.|$)/); assert.equal(result.snapshot.exitCode, 0); safe(result);
});
test("F10-W22 actual pinned finite PowerShell preserves quoted public Unicode without script or argument interpolation", { skip: process.platform !== "win32", timeout: 8000 }, async () => {
    const text = "public caf\u00e9 \u96ea $(Get-Date)", worker = await actual("Write-Output '" + text + "'"); await worker.start(); const result = await bounded(worker.completion, "Finite installed write operation did not close.", 7000);
    assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, text + "\n"); safe(result);
});
test("F10-W23 cancellation of a finite real sleep waits for its own natural close and withholds output", { skip: process.platform !== "win32", timeout: 8000 }, async () => {
    const worker = await actual("sleep -Milliseconds 200"); await worker.start(); worker.cancel(); const result = await bounded(worker.completion, "Finite cancelled sleep did not naturally close.", 7000);
    assert.equal(result.snapshot.state, "CANCELLED"); withheld(result);
});
