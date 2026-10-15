import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess, spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";
import type { VaultAppDescriptor } from "../../../core/src/VaultAppDescriptor";

// Frozen F09 owned-job contract. In-memory subprocesses are fixtures, not OS
// confinement proof. The three real fixtures are finite, synthetic Node apps;
// none calls kill/process.exit or reads a real project, profile or credential.
const SECRET = "synthetic-f09-private-db-value-qZ9/with spaces";
const OTHER = "synthetic-f09-private-token-jK7";
const MASK = "[REDACTED_SECRET_OUTPUT]";
const ID = "83f22fe1-79cb-427f-ae84-f710df2a5090";
const PLACEHOLDER = "[SOTERAI_PROTECTED_0123456789ABCDEF0123456789ABCDEF_0]";
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
type Snapshot = Readonly<{ id: string; state: string; pid?: number; exitCode?: number }>;
type Completion = { snapshot: Snapshot; output: OutputResult };
type Job = { start(): Promise<Snapshot>; snapshot(): Snapshot; requestStop(): void; cancel(): void; dispose(): void; readonly completion: Promise<Completion> };
type Timer = { callback: () => void; ms: number; active: boolean };
type Options = { descriptor: VaultAppDescriptor; values: Readonly<Record<string, string>>; runtime: { executable: string; electron: boolean }; parentEnvironment: NodeJS.ProcessEnv; enabled?: () => boolean };
type Deps = { spawn?: typeof spawn; setTimer?: (callback: () => void, ms: number) => unknown; clearTimer?: (handle: unknown) => void };
type Constructor = new (options: Options, deps?: Deps) => Job;

async function implementation(): Promise<Constructor> {
    // Per-case loading keeps a missing-feature baseline executable and counted.
    const module = await import("../vault-runtime/VaultAppJob");
    assert.equal(typeof module.VaultAppJob, "function", "F09 must expose the frozen owned-job API.");
    return module.VaultAppJob;
}
function descriptor(root = resolve(tmpdir(), "synthetic-f09-job-not-created")): VaultAppDescriptor {
    return Object.freeze({ schemaVersion: 1, id: ID, root, program: join(root, "public-app.cjs"), cwd: root,
        source: join(root, ".env.synthetic"), programDigest: "a".repeat(64), args: Object.freeze(["literal argument", "--public-mode"]),
        selections: Object.freeze([Object.freeze({ name: "DB_URL", placeholder: PLACEHOLDER })]) }) as VaultAppDescriptor;
}
function baseOptions(overrides: Partial<Options> = {}): Options {
    return { descriptor: descriptor(), values: Object.freeze({ DB_URL: SECRET }), runtime: { executable: process.execPath, electron: false },
        parentEnvironment: Object.freeze({ SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", TEMP: "D:\\SoterAI-Lite-test-profiles\\f09-temp", TMP: "D:\\SoterAI-Lite-test-profiles\\f09-temp", LANG: "en_US.UTF-8", LC_ALL: "C", TZ: "UTC", PATH: "untrusted-search", HOME: "untrusted-home", USERPROFILE: "untrusted-home", OPENAI_API_KEY: OTHER, HTTP_PROXY: OTHER, NODE_OPTIONS: "--require untrusted", ELECTRON_RUN_AS_NODE: "inherited" }), ...overrides };
}
function safe(value: unknown): void {
    const serialized = JSON.stringify(value);
    for (const privateValue of [SECRET, OTHER, Buffer.from(SECRET).toString("base64"), encodeURIComponent(SECRET)]) {
        assert.ok(!serialized.includes(privateValue), "Job metadata and completed output must not contain a synthetic private value.");
    }
}
function snapshot(job: Job): Snapshot {
    const value = job.snapshot();
    assert.ok(Object.isFrozen(value)); assert.equal(value.id, ID);
    assert.ok(Object.keys(value).every(key => ["id", "state", "pid", "exitCode"].includes(key)));
    safe(value); safe(job); return value;
}
function withheld(result: Completion): void {
    assert.equal(result.output.status, "WITHHELD"); assert.equal(result.output.stdout, ""); assert.equal(result.output.stderr, "");
    assert.equal(result.output.redacted, false); safe(result);
}
class Child extends EventEmitter {
    readonly stdout = new PassThrough(); readonly stderr = new PassThrough();
    readonly stdin = null; readonly pid = 42424; readonly sent: unknown[] = [];
    exitCode: number | null = null; signalCode = null; connected = true; killed = false; killCalls = 0;
    readonly channel = { unref() {} }; unref() {}
    send(message: unknown, ...tail: unknown[]): boolean {
        this.sent.push(message); const callback = tail.find(value => typeof value === "function") as ((error: null) => void) | undefined;
        callback?.(null); return true;
    }
    get stopMessages(): unknown[] { return this.sent.filter(message => message === "STOP" || (message as { type?: string } | null)?.type === "STOP"); }
    kill(): never { this.killCalls++; throw new Error("Fixture forbids process termination."); }
    disconnect(): void { this.connected = false; this.emit("disconnect"); }
    async finish(code = 0): Promise<void> {
        this.exitCode = code; this.stdout.end(); this.stderr.end(); await tick(); this.emit("exit", code, null); this.emit("close", code, null); await tick();
    }
}
async function fixture(overrides: Partial<Options> = {}, spawnFailure = false, autoReady = true) {
    const Factory = await implementation(), child = new Child(), calls: { executable: string; args: readonly string[]; options: Record<string, unknown> }[] = [], timers: Timer[] = [];
    const options = baseOptions(overrides);
    const mockSpawn = ((executable: string, args: readonly string[], options: Record<string, unknown>) => {
        calls.push({ executable, args, options });
        if (spawnFailure) throw new Error(SECRET);
        queueMicrotask(() => { child.emit("spawn"); if (autoReady) child.emit("message", { type: "READY" }); }); return child as unknown as ChildProcess;
    }) as unknown as typeof spawn;
    const deps: Deps = { spawn: mockSpawn, setTimer(callback, ms) { const timer: Timer = { callback, ms, active: true }; timers.push(timer); return timer; },
        clearTimer(handle) { (handle as Timer).active = false; } };
    const job = new Factory(options, deps);
    let settled = false; void job.completion.then(() => { settled = true; });
    return { job, child, calls, timers, options, get settled() { return settled; },
        fire(ms: number) { const timer = timers.find(item => item.active && item.ms === ms); assert.ok(timer, "Frozen lifecycle timer must be scheduled."); timer.active = false; timer.callback(); },
        async running() { const started = await job.start(); await tick(); assert.equal(started.state, "RUNNING"); assert.equal(calls.length, 1); snapshot(job); },
        async done(code = 0) { await child.finish(code); const result = await job.completion; assert.equal(child.killCalls, 0); snapshot(job); return result; } };
}

test("F09-J01 launch has a fresh minimal environment, exact injection, no credential argv and no parent mutation", async () => {
    const f = await fixture(), before = JSON.stringify(f.options.parentEnvironment); assert.equal(snapshot(f.job).state, "READY"); await f.running();
    const call = f.calls[0], env = call.options.env as NodeJS.ProcessEnv;
    assert.equal(call.executable, process.execPath); assert.equal(call.options.shell, false); assert.equal(call.options.windowsHide, true);
    assert.equal(call.options.cwd, f.options.descriptor.cwd); assert.ok(Array.isArray(call.options.stdio));
    assert.ok((call.options.stdio as unknown[]).includes("ipc")); assert.equal(env.DB_URL, undefined, "Selected values never enter spawn options before the Node READY handshake.");
    const releases = f.child.sent.filter(message => (message as { type?: string })?.type === "START") as { type: string; values: Record<string, string> }[];
    assert.equal(releases.length, 1); assert.deepEqual(releases[0].values, { DB_URL: SECRET });
    assert.notEqual(env, f.options.parentEnvironment); assert.equal(JSON.stringify(f.options.parentEnvironment), before);
    assert.equal(env.SystemRoot, "C:\\Windows"); assert.equal(env.LANG, "en_US.UTF-8");
    for (const key of ["PATH", "HOME", "USERPROFILE", "OPENAI_API_KEY", "HTTP_PROXY", "NODE_OPTIONS", "ELECTRON_RUN_AS_NODE"]) assert.equal(env[key], undefined, key);
    safe(call.args); assert.ok(call.args.includes("-e")); assert.ok(call.args.includes(f.options.descriptor.program));
    for (const arg of f.options.descriptor.args) assert.ok(call.args.includes(arg));
    const result = await f.done(); assert.equal(result.output.status, "COMPLETE"); safe(result);
});

test("F09-J02 Electron runtime gets only the launcher-owned run-as-Node flag and sibling launches stay separate", async () => {
    const a = await fixture({ runtime: { executable: process.execPath, electron: true } }); await a.running();
    assert.equal((a.calls[0].options.env as NodeJS.ProcessEnv).ELECTRON_RUN_AS_NODE, "1");
    const b = await fixture({ values: { DB_URL: OTHER } }); await b.running();
    const env = b.calls[0].options.env as NodeJS.ProcessEnv; assert.equal(env.DB_URL, undefined); assert.ok(!Object.values(env).includes(SECRET));
    const released = b.child.sent.find(message => (message as { type?: string })?.type === "START") as { values: Record<string, string> };
    assert.deepEqual(released.values, { DB_URL: OTHER }); assert.ok(!JSON.stringify(released).includes(SECRET));
    assert.notEqual(env, a.calls[0].options.env); await a.done(); await b.done();
});

test("F09-J03 unsafe inherited locale/temp values are omitted while validated public OS metadata survives", async () => {
    const f = await fixture({ parentEnvironment: { SystemRoot: "C:\\Windows", TEMP: "D:\\safe\0bad", TMP: "relative-directory", LANG: "en_US.UTF-8\nNODE_OPTIONS=oops", TZ: "UTC\0bad", LC_ALL: "C", SOTERAI_CONTROL: OTHER } });
    await f.running(); const env = f.calls[0].options.env as NodeJS.ProcessEnv;
    assert.equal(env.SystemRoot, "C:\\Windows"); assert.equal(env.LC_ALL, "C");
    for (const key of ["TEMP", "TMP", "LANG", "TZ", "SOTERAI_CONTROL"]) assert.equal(env[key], undefined, key);
    await f.done();
});

for (const kind of ["missing", "extra", "case-collision", "reserved", "non-string", "nul", "empty", "oversize"] as const) {
    test(`F09-J04-${kind} invalid exact-value registration withholds the whole launch before spawning`, async () => {
        let values: Record<string, string> = { DB_URL: SECRET }, desc = descriptor();
        if (kind === "missing") values = {};
        if (kind === "extra") values.EXTRA = OTHER;
        if (kind === "case-collision") values.db_url = OTHER;
        if (kind === "reserved") { values = { NODE_OPTIONS: SECRET }; desc = { ...desc, selections: [{ name: "NODE_OPTIONS", placeholder: PLACEHOLDER }] }; }
        if (kind === "non-string") values.DB_URL = 17 as unknown as string;
        if (kind === "nul") values.DB_URL = SECRET + "\0";
        if (kind === "empty") values.DB_URL = "";
        if (kind === "oversize") values.DB_URL = "x".repeat(4097);
        const f = await fixture({ descriptor: desc, values }); const started = await f.job.start();
        assert.equal(started.state, "BLOCKED"); assert.equal(f.calls.length, 0); withheld(await f.job.completion); assert.equal(f.child.killCalls, 0);
    });
}

test("F09-J05 excessive aggregate registration bytes block all selected values instead of partial injection", async () => {
    const names = Array.from({ length: 17 }, (_, index) => "VALUE_" + index), desc = { ...descriptor(), selections: names.map((name, index) => ({ name, placeholder: `[SOTERAI_PROTECTED_0123456789ABCDEF0123456789ABCDEF_${index}]` })) };
    const values = Object.fromEntries(names.map((name, index) => [name, String(index).padStart(4, "0") + "x".repeat(4092)]));
    const f = await fixture({ descriptor: desc, values }); assert.equal((await f.job.start()).state, "BLOCKED"); assert.equal(f.calls.length, 0); withheld(await f.job.completion);
});

test("F09-J06 disabled or throwing availability guards and pre-start cancellation never spawn", async () => {
    for (const mode of ["off", "throws", "cancel", "dispose"] as const) {
        const f = await fixture({ enabled: () => { if (mode === "throws") throw new Error(SECRET); return mode !== "off"; } });
        if (mode === "cancel") f.job.cancel(); if (mode === "dispose") f.job.dispose();
        const state = (await f.job.start()).state; assert.ok(["BLOCKED", "CANCELLED"].includes(state));
        assert.equal(f.calls.length, 0); withheld(await f.job.completion); safe(snapshot(f.job));
    }
});

test("F09-J07 start is single-use and snapshots do not disclose original values or buffered bytes", async () => {
    const f = await fixture(); await f.running();
    f.child.stdout.write(SECRET); await tick(); assert.equal(f.settled, false); snapshot(f.job);
    try { await f.job.start(); } catch { /* Single-use may reject or return its safe current snapshot. */ }
    assert.equal(f.calls.length, 1); const result = await f.done(); assert.equal(result.output.stdout, MASK); safe(result);
});

test("F09-J08 exit and drained EOFs alone cannot release output before actual child close", async () => {
    const f = await fixture(); await f.running(); f.child.stdout.write("public stdout\n"); f.child.stderr.write("ordinary warning\n");
    f.child.emit("exit", 0, null); await tick(); assert.equal(f.settled, false);
    f.child.stdout.end(); await tick(); assert.equal(f.settled, false, "stderr must also reach EOF.");
    f.child.stderr.end(); await tick(); assert.equal(f.settled, false, "EOFs are not proof that the child closed.");
    f.child.emit("close", 0, null); const result = await f.job.completion;
    assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, "public stdout\n"); assert.equal(result.output.stderr, "ordinary warning\n");
    assert.equal(result.snapshot.state, "EXITED"); assert.equal(f.child.killCalls, 0);
});

test("F09-J09 chunked ANSI and encoded secret output is masked after finite close including nonzero exit", async () => {
    for (const text of [SECRET.slice(0, 12) + "\x1b[31m" + SECRET.slice(12) + "\x1b[0m", Buffer.from(SECRET).toString("base64"), encodeURIComponent(SECRET)]) {
        const f = await fixture(); await f.running(); const buffer = Buffer.from(text);
        for (let index = 0; index < buffer.length; index += 3) f.child.stdout.write(buffer.subarray(index, index + 3));
        await tick(); assert.equal(f.settled, false); const result = await f.done(23);
        assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, MASK); assert.equal(result.output.redacted, true); assert.equal(result.output.exitCode, 23);
        assert.equal(result.snapshot.exitCode, 23); safe(result);
    }
});

test("F09-J10 public Unicode stdout and stderr survive byte boundaries and natural nonzero exit", async () => {
    const f = await fixture(); await f.running(); const text = "public caf\u00e9 \u96ea \ud83e\udded\r\n";
    for (const byte of Buffer.from(text)) f.child.stdout.write(Buffer.from([byte])); f.child.stderr.write("warning\n");
    const result = await f.done(7); assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, text.replace(/\r\n/g, "\n"));
    assert.equal(result.output.stderr, "warning\n"); assert.equal(result.snapshot.state, "EXITED"); assert.equal(result.snapshot.exitCode, 7);
});

test("F09-J11 malformed final UTF8 permanently withholds a previously buffered public prefix", async () => {
    const f = await fixture(); await f.running(); f.child.stdout.write("public before "); f.child.stdout.write(Buffer.from([0xf0, 0x9f]));
    withheld(await f.done());
});

test("F09-J12 output-byte overflow requests cooperative stop and drains both discarded channels", async () => {
    const f = await fixture(); await f.running(); f.child.stdout.write(Buffer.alloc(131073, 0x70)); await tick();
    assert.ok(f.child.stopMessages.length > 0); assert.equal(f.settled, false); safe(f.child.stopMessages);
    for (let index = 0; index < 24; index++) { f.child.stdout.write("discarded " + SECRET); f.child.stderr.write("discarded " + SECRET); }
    await tick(); assert.equal(f.child.stdout.readableLength, 0); assert.equal(f.child.stderr.readableLength, 0); withheld(await f.done());
});

test("F09-J13 chunk-count overflow withholds even when byte budget is small", async () => {
    const f = await fixture(); await f.running(); for (let index = 0; index < 4097; index++) f.child.stdout.write(Buffer.from("p"));
    await tick(); assert.ok(f.child.stopMessages.length > 0); assert.equal(f.settled, false); withheld(await f.done());
});

test("F09-J14 cancellation after spawn requests STOP but never claims exit or releases pending output", async () => {
    const f = await fixture(); await f.running(); f.child.stdout.write(SECRET); f.job.cancel(); await tick();
    assert.equal(f.settled, false); assert.ok(f.child.stopMessages.length > 0); assert.equal(snapshot(f.job).state, "STOP_REQUESTED"); safe(f.child.stopMessages);
    const result = await f.done(); withheld(result); assert.equal(result.snapshot.state, "CANCELLED");
});

test("F09-J15 STOP acknowledgement without close remains STOP_UNCONFIRMED until actual natural exit", async () => {
    const f = await fixture(); await f.running(); f.job.requestStop();
    f.child.emit("message", { type: "ACK" }); f.child.emit("message", { type: "STOP_ACK" }); await tick();
    assert.equal(f.settled, false); f.fire(1000); assert.equal(snapshot(f.job).state, "STOP_UNCONFIRMED"); assert.equal(f.settled, false);
    assert.equal(f.child.killCalls, 0); const result = await f.done(); assert.equal(result.snapshot.state, "STOPPED"); withheld(result);
});

test("F09-J16 runtime timeout permanently withholds and uses cooperative stop, never forced termination", async () => {
    const f = await fixture(); await f.running(); f.child.stdout.write("public undecided\n"); f.fire(300000); await tick();
    assert.equal(snapshot(f.job).state, "STOP_REQUESTED"); assert.ok(f.child.stopMessages.length > 0); assert.equal(f.settled, false);
    f.fire(1000); assert.equal(snapshot(f.job).state, "STOP_UNCONFIRMED"); withheld(await f.done());
});

test("F09-J17 guard withdrawal is sticky even after reenable and never releases earlier buffered output", async () => {
    let enabled = true; const f = await fixture({ enabled: () => enabled }); await f.running(); f.child.stdout.write("public earlier\n");
    enabled = false; f.child.stderr.write(SECRET); await tick(); assert.ok(f.child.stopMessages.length > 0); assert.equal(f.settled, false);
    enabled = true; f.child.stdout.write("public later\n"); withheld(await f.done());
});

test("F09-J18 spawn throws/errors are safe BLOCKED completions and include no input-bearing exception", async () => {
    const throwing = await fixture({}, true); assert.equal((await throwing.job.start()).state, "BLOCKED"); withheld(await throwing.job.completion);
    const emitted = await fixture(); await emitted.running(); emitted.child.emit("error", new Error(SECRET)); await tick(); assert.equal(emitted.settled, false, "A post-spawn error is not an exit proof.");
    const result = await emitted.done(); assert.equal(result.snapshot.state, "BLOCKED"); withheld(result); safe(snapshot(emitted.job));
});

test("F09-J19 dispose requests stop of only the owned child, retains ownership and waits for close", async () => {
    const f = await fixture(); await f.running(); f.job.dispose(); f.job.dispose(); await tick();
    assert.ok(f.child.stopMessages.length > 0); assert.equal(f.settled, false); assert.equal(snapshot(f.job).pid, f.child.pid); assert.equal(f.child.killCalls, 0);
    withheld(await f.done());
});

async function realFixture(source: string, values: Record<string, string> = { DB_URL: SECRET }, extraPublicFiles: readonly string[] = []) {
    const Factory = await implementation(), parent = await realpath(tmpdir()), root = await mkdtemp(join(parent, "soterai-f09-job-"));
    assert.equal(dirname(root), parent); await writeFile(join(root, ".synthetic-lite-f09-job"), "synthetic-owned-f09\n", { flag: "wx" });
    const program = join(root, "public-app.cjs"); await writeFile(program, source, { flag: "wx" });
    const desc = { ...descriptor(root), selections: Object.keys(values).map((name, index) => ({ name, placeholder: `[SOTERAI_PROTECTED_0123456789ABCDEF0123456789ABCDEF_${index}]` })) };
    const options = baseOptions({ descriptor: desc, values, parentEnvironment: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
        TEMP: tmpdir(), TMP: tmpdir(), TMPDIR: tmpdir(), LANG: "C", TZ: "UTC", DB_URL: "unrelated-parent-value", OPENAI_API_KEY: OTHER } });
    const job = new Factory(options);
    return { job, root, options, async cleanup() {
        assert.equal(dirname(await realpath(root)), parent); assert.equal(await readFile(join(root, ".synthetic-lite-f09-job"), "utf8"), "synthetic-owned-f09\n");
        assert.deepEqual((await readdir(root)).sort(), [".synthetic-lite-f09-job", "public-app.cjs", ...extraPublicFiles].sort(), "The launcher must not create a secret file in its app workspace.");
        await rm(root, { recursive: true });
    } };
}

test("F09-J20 real finite Node app receives only selected env while raw stdout and parent env remain private", { timeout: 6000 }, async () => {
    const parentBefore = process.env.DB_URL;
    const f = await realFixture('process.stdout.write(process.env.DB_URL || "missing"); process.stderr.write(process.env.OPENAI_API_KEY ? "ambient-leak" : "public-clean");');
    await f.job.start(); const result = await f.job.completion; assert.equal(result.snapshot.state, "EXITED");
    assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, MASK); assert.equal(result.output.stderr, MASK); safe(result);
    assert.ok(process.env.DB_URL === parentBefore, "Launching an app must not mutate the parent DB_URL."); await f.cleanup();
});

test("F09-J21 a fresh real sibling app receives none of an earlier job's selected DB value", { timeout: 6000 }, async () => {
    const f = await realFixture('process.stdout.write(process.env.DB_URL === undefined ? "public-no-db" : "unexpected-db"); process.stdout.write(process.env.PUBLIC_TOKEN ? " public-selected" : " missing-selection");', { PUBLIC_TOKEN: OTHER });
    await f.job.start(); const result = await f.job.completion;
    assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, "public-no-db public-selected"); safe(result); await f.cleanup();
});

test("F09-J22 real app ignoring STOP remains visibly unconfirmed and then self-exits without external termination", { timeout: 7000 }, async () => {
    const f = await realFixture('require("node:fs").writeFileSync(".synthetic-app-started", "public-ready"); setTimeout(() => process.stdout.write("public finite app finished"), 1600);', { DB_URL: SECRET }, [".synthetic-app-started"]);
    await f.job.start(); let ready = false; const until = Date.now() + 2000;
    while (!ready && Date.now() < until) { try { ready = await readFile(join(f.root, ".synthetic-app-started"), "utf8") === "public-ready"; } catch { /* Wait only for this synthetic marker. */ } if (!ready) await new Promise<void>(done => setTimeout(done, 10)); }
    assert.equal(ready, true, "Wait for the finite app to start before testing its ignored STOP."); f.job.requestStop();
    await new Promise<void>(done => setTimeout(done, 1150)); assert.equal(snapshot(f.job).state, "STOP_UNCONFIRMED");
    const result = await f.job.completion; assert.equal(result.snapshot.state, "STOPPED"); withheld(result); await f.cleanup();
});

test("F09-J23 stream errors or premature close without EOF permanently withhold and drain the remaining channel", async () => {
    for (const mode of ["error", "premature-close"] as const) {
        const f = await fixture(); await f.running(); f.child.stdout.write("public prefix\n");
        if (mode === "error") f.child.stdout.emit("error", new Error(SECRET)); else f.child.stdout.emit("close");
        f.child.stderr.write(SECRET); await tick(); assert.equal(f.settled, false); assert.equal(f.child.stderr.readableLength, 0);
        withheld(await f.done());
    }
});

test("F09-J24 no selected value reaches a non-READY runtime and duplicate READY cannot release twice", async () => {
    const f = await fixture({}, false, false); await f.running(); assert.deepEqual(f.child.sent, []); safe(f.calls[0]);
    f.child.emit("message", { type: "OTHER", values: "not-a-command" }); await tick(); assert.deepEqual(f.child.sent, []);
    f.child.emit("message", { type: "READY" }); f.child.emit("message", { type: "READY" }); await tick();
    const starts = f.child.sent.filter(message => (message as { type?: string })?.type === "START") as { values: Record<string, string> }[];
    assert.equal(starts.length, 1); assert.deepEqual(starts[0].values, { DB_URL: SECRET }); await f.done();
});

test("F09-J25 withdrawal or cancellation before READY cannot release values even after later reenable", async () => {
    for (const mode of ["withdraw", "cancel"] as const) {
        let enabled = true; const f = await fixture({ enabled: () => enabled }, false, false); await f.running();
        if (mode === "withdraw") enabled = false; else f.job.cancel();
        f.child.emit("message", { type: "READY" }); await tick(); enabled = true; f.child.emit("message", { type: "READY" }); await tick();
        assert.ok(!f.child.sent.some(message => (message as { type?: string })?.type === "START")); safe(f.child.sent); withheld(await f.done());
    }
});

test("F09-J26 a child close before either stream EOF cannot turn a later public suffix into complete output", async () => {
    const f = await fixture(); await f.running(); f.child.stdout.write("public prefix\n");
    f.child.emit("close", 0, null); await tick(); f.child.stdout.end("public suffix\n"); f.child.stderr.end();
    await tick(); withheld(await f.job.completion); assert.equal(f.child.killCalls, 0);
});
