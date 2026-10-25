import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import type { ChildProcess, spawn } from "node:child_process";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";
import type { VaultAppDescriptor } from "../../../core/src/VaultAppDescriptor";

// F25 job integration only. Every child/pipe/timer is an in-memory event
// fixture; no subprocess, program file, vault, environment lookup or network.
const SELECTED = "TEST_ONLY_F25_SELECTED_INJECTION_24dfba81";
const REGISTERED = "TEST_ONLY_F25_UNSELECTED_OUTPUT_92bc647e";
const GUARD_ERROR = "TEST_ONLY_F25_JOB_GUARD_ERROR_7c4ea062";
const MASK = "[REDACTED_SECRET_OUTPUT]";
const PUBLIC = "Public F25 owned job result\n", WARNING = "Public F25 owned warning\n";
const ID = "23de69a8-5a65-43d9-8912-bf0000250301";
type Snapshot = Readonly<{ id: string; state: string; pid?: number; exitCode?: number }>;
type Completion = Readonly<{ snapshot: Snapshot; output: OutputResult }>;
type Job = { start(): Promise<Snapshot>; snapshot(): Snapshot; readonly completion: Promise<Completion>;
    canRelease(output: OutputResult): boolean; cancel(): void; dispose(): void };
type Options = { descriptor: VaultAppDescriptor; values: Readonly<Record<string, string>>; outputValues?: readonly string[];
    runtime: { executable: string; electron: boolean }; parentEnvironment: NodeJS.ProcessEnv; enabled?: () => boolean };
type Deps = { spawn?: typeof spawn; setTimer?: (callback: () => void, ms: number) => unknown; clearTimer?: (handle: unknown) => void };
type Constructor = new (options: Options, dependencies: Deps) => Job;
type Timer = { active: boolean };
async function flush(): Promise<void> { for (let index = 0; index < 8; index++) await Promise.resolve(); }
function descriptor(): VaultAppDescriptor {
    const root = resolve("synthetic-f25-log-job-not-created");
    return { schemaVersion: 1, id: ID, root, cwd: root, program: join(root, "public-app.cjs"), source: join(root, ".env.synthetic"),
        programDigest: "a".repeat(64), args: [], selections: [{ name: "SELECTED_VALUE", placeholder: "[SOTERAI_PROTECTED_0123456789ABCDEF0123456789ABCDEF_0]" }] };
}
class Pipe extends EventEmitter {
    ended = false;
    write(value: string | Uint8Array): void { this.emit("data", typeof value === "string" ? Buffer.from(value, "utf8") : value); }
    end(): void { if (this.ended) return; this.ended = true; this.emit("end"); this.emit("close"); }
}
class Child extends EventEmitter {
    readonly stdout = new Pipe(); readonly stderr = new Pipe(); readonly stdin = null;
    readonly pid = 45251; readonly sent: unknown[] = []; readonly channel = { unref(): void {} };
    connected = true; killCalls = 0; closed = false;
    send(message: unknown, ...tail: unknown[]): boolean {
        this.sent.push(message);
        const callback = tail.find(value => typeof value === "function") as ((error: null) => void) | undefined;
        callback?.(null); return true;
    }
    kill(): never { this.killCalls++; throw Error("Synthetic fixture forbids process termination."); }
    finish(code = 17): void {
        if (this.closed) return; this.closed = true;
        this.stdout.end(); this.stderr.end(); this.emit("exit", code, null); this.emit("close", code, null);
    }
}
function safe(value: unknown): void {
    const encoded = JSON.stringify(value) ?? "";
    assert.equal([SELECTED, REGISTERED, GUARD_ERROR, Buffer.from(REGISTERED).toString("base64")].some(secret => encoded.includes(secret)), false,
        "Job results and metadata must contain no synthetic registration or guard exception.");
}
function canRelease(job: Job, output: OutputResult): boolean {
    assert.equal(typeof job.canRelease === "function", true, "The owned job must expose exact completed-output release authority.");
    return job.canRelease(output);
}
async function fixture(t: TestContext, overrides: Partial<Options> = {}) {
    const module = await import("../vault-runtime/VaultAppJob"), Factory = module.VaultAppJob as unknown as Constructor;
    const child = new Child(), timers: Timer[] = [], calls: Array<{ args: readonly string[]; options: Record<string, unknown> }> = [];
    const options: Options = { descriptor: descriptor(), values: Object.freeze({ SELECTED_VALUE: SELECTED }),
        outputValues: Object.freeze([SELECTED, REGISTERED]), runtime: { executable: process.execPath, electron: false },
        parentEnvironment: Object.freeze({}), enabled: () => true, ...overrides };
    const job = new Factory(options, {
        spawn: ((_executable: string, args: readonly string[], spawnOptions: Record<string, unknown>) => {
            calls.push({ args, options: spawnOptions });
            queueMicrotask(() => { child.emit("spawn"); child.emit("message", { type: "READY" }); });
            return child as unknown as ChildProcess;
        }) as unknown as typeof spawn,
        setTimer() { const timer = { active: true }; timers.push(timer); return timer; },
        clearTimer(handle) { (handle as Timer).active = false; },
    });
    let settled = false; void job.completion.then(() => { settled = true; });
    t.after(async () => { child.finish(); await flush(); job.dispose(); });
    return { job, child, calls, timers, get settled() { return settled; },
        async start(): Promise<void> {
            const state = await job.start(); await flush();
            assert.equal(state.state === "RUNNING" && calls.length === 1, true, "One in-memory child must reach its ordinary running state.");
            assert.equal(settled, false, "No result may complete before the owned close and EOF evidence.");
        },
        async finish(code = 17): Promise<Completion> {
            child.finish(code); await flush(); const result = await job.completion;
            assert.equal(child.killCalls === 0 && timers.every(timer => !timer.active), true, "Completion must clear only owned timers without process signals.");
            safe(result); safe(job.snapshot()); return result;
        },
    };
}

test("F25-J01 exact public completion stays releasable after close with useful channels and nonzero exit", async t => {
    const f = await fixture(t); await f.start(); f.child.stdout.write(PUBLIC); f.child.stderr.write(WARNING);
    const outputBeforeClose: OutputResult = Object.freeze({ status: "COMPLETE", stdout: PUBLIC, stderr: WARNING, redacted: false, exitCode: 23 });
    assert.equal(canRelease(f.job, outputBeforeClose), false, "A caller cannot invent completion while the child remains owned.");
    f.child.stdout.end(); f.child.stderr.end(); await flush(); assert.equal(f.settled, false, "Drained pipes do not prove actual child close.");
    const result = await f.finish(23);
    assert.equal(result.output.status === "COMPLETE" && result.output.stdout === PUBLIC && result.output.stderr === WARNING && result.output.exitCode === 23, true,
        "Public success and error details must remain useful after real completion.");
    assert.equal(canRelease(f.job, result.output), true, "The exact held completion must remain releasable while its live guard is current.");
});

test("F25-J02 output clones unknown objects and another job completion cannot borrow final authority", async t => {
    const a = await fixture(t), b = await fixture(t); await Promise.all([a.start(), b.start()]);
    a.child.stdout.write(PUBLIC); b.child.stdout.write(PUBLIC);
    const [first, second] = await Promise.all([a.finish(), b.finish()]);
    assert.equal(canRelease(a.job, first.output), true, "The original completion must have current authority.");
    for (const forged of [Object.freeze({ ...first.output }), JSON.parse(JSON.stringify(first.output)) as OutputResult, second.output,
        Object.freeze({ status: "COMPLETE", stdout: "", stderr: "", redacted: false }) as OutputResult])
        assert.equal(canRelease(a.job, forged), false, "Equivalent fields or another operation are not an output capability.");
    assert.equal(canRelease(a.job, first.output), true, "Rejecting a forgery must not revoke an otherwise current completion.");
});

test("F25-J03 an observed live-guard withdrawal after completion stays revoked after reenable", async t => {
    let enabled = true; const f = await fixture(t, { enabled: () => enabled }); await f.start(); f.child.stdout.write(PUBLIC);
    const result = await f.finish(); assert.equal(canRelease(f.job, result.output), true);
    enabled = false; assert.equal(canRelease(f.job, result.output), false, "Held output must sample the live guard at native delivery.");
    enabled = true; assert.equal(canRelease(f.job, result.output), false, "Reenable must not resurrect observed stale output authority.");
});

test("F25-J04 a throwing completion guard is generic and permanently revokes held output", async t => {
    let throws = false; const f = await fixture(t, { enabled: () => { if (throws) throw Error(GUARD_ERROR); return true; } });
    await f.start(); f.child.stdout.write(PUBLIC); const result = await f.finish(); assert.equal(canRelease(f.job, result.output), true);
    throws = true; assert.equal(canRelease(f.job, result.output), false, "Guard exceptions must fail closed without reaching callers.");
    throws = false; assert.equal(canRelease(f.job, result.output), false, "A repaired callback cannot revive a withdrawn completion."); safe(result);
});

test("F25-J05 post-completion disposal revokes exact output without signalling the closed child", async t => {
    const f = await fixture(t); await f.start(); f.child.stdout.write(PUBLIC); const result = await f.finish();
    assert.equal(canRelease(f.job, result.output), true); f.job.dispose(); f.job.dispose();
    assert.equal(canRelease(f.job, result.output), false, "Disposal must clear completed as well as pending collector authority.");
    assert.equal(f.child.killCalls === 0 && f.child.sent.every(message => (message as { type?: string })?.type !== "STOP"), true,
        "Closed-job authority cleanup must not signal or request a stop of an already completed child.");
});

test("F25-J06 a legacy completion without an explicit live guard grants no final output authority", async t => {
    const f = await fixture(t, { enabled: undefined }); await f.start(); f.child.stdout.write(PUBLIC); const result = await f.finish();
    assert.equal(canRelease(f.job, result.output), false, "Utility completion alone cannot supply a live native release guard.");
});

test("F25-J07 complete registry output filtering does not inject an unselected registration", async t => {
    const f = await fixture(t); await f.start();
    const starts = f.child.sent.filter(message => (message as { type?: string })?.type === "START") as Array<{ values?: Record<string, string> }>;
    assert.equal(starts.length === 1 && Object.keys(starts[0].values ?? {}).join(",") === "SELECTED_VALUE" && starts[0].values?.SELECTED_VALUE === SELECTED, true,
        "Only descriptor selections may enter the private READY injection.");
    assert.equal(JSON.stringify(starts).includes(REGISTERED) || JSON.stringify(f.calls).includes(REGISTERED), false,
        "Output-only registry values must not enter IPC injection, arguments or environment options.");
    f.child.stdout.write(REGISTERED); f.child.stderr.write(WARNING); const result = await f.finish(29);
    assert.equal(result.output.status === "COMPLETE" && result.output.redacted && result.output.stdout === MASK && result.output.stderr === MASK && result.output.exitCode === 29, true,
        "An unselected current-window registration must still mask completed output on both channels.");
    assert.equal(canRelease(f.job, result.output), true);
});

test("F25-J08 structured escaped leaves compose an unselected registration before output release", async t => {
    const f = await fixture(t); await f.start(); const middle = Math.floor(REGISTERED.length / 2);
    const body = JSON.stringify({ actual: REGISTERED.slice(0, middle), nested: { expected: REGISTERED.slice(middle) } }).replace("TEST", "\\u0054EST");
    assert.equal(body.includes(REGISTERED), false, "The fixture must require decoded structured composition.");
    f.child.stdout.write(body); f.child.stderr.write(WARNING); const result = await f.finish();
    assert.equal(result.output.status === "COMPLETE" && result.output.redacted && result.output.stdout === MASK && result.output.stderr === MASK, true,
        "Decoded semantic leaves must reach the complete registry collector before native release.");
    assert.equal(canRelease(f.job, result.output), true);
});

test("F25-J09 interleaved escaped registration fragments retain arrival framing through actual job integration", async t => {
    const f = await fixture(t); await f.start();
    const body = [...REGISTERED].map(character => "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0")).join("");
    const first = 6 * 10, second = 6 * 25;
    f.child.stdout.write(body.slice(0, first)); f.child.stderr.write(body.slice(first, second)); f.child.stdout.write(body.slice(second) + "\n");
    const result = await f.finish(31);
    assert.equal(result.output.status === "COMPLETE" && result.output.redacted && result.output.stdout === MASK && result.output.stderr === MASK && result.output.exitCode === 31, true,
        "Arrival-order one-layer JSON-body output must be filtered despite channel splits and its trailing newline.");
    assert.equal(canRelease(f.job, result.output), true);
});

test("F25-J10 an additional output registry cannot remove selected-value output protection", async t => {
    const f = await fixture(t, { outputValues: Object.freeze([REGISTERED]) }); await f.start();
    f.child.stdout.write(SELECTED); f.child.stderr.write(WARNING); const result = await f.finish();
    assert.equal(result.output.status === "COMPLETE" && result.output.redacted && result.output.stdout === MASK && result.output.stderr === MASK, true,
        "Additional registry registrations must extend the selected-value filter without replacing it.");
    assert.equal(canRelease(f.job, result.output), true);
});
