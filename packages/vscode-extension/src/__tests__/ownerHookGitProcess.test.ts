import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import type { ChildProcess, spawn } from "node:child_process";

// F26a TEST-FIRST owner config transport. Manual retained synthetic metadata;
// every process/stream/exit event is fake. No Git or other child actually runs.
const PRIVATE = "TEST_ONLY_F26A_OWNER_PROCESS_PRIVATE_0af931c2", CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n";
const GIT = "C:\\Program Files\\Git\\cmd\\git.exe", VERSION = Buffer.from("git version 2.53.0.windows.1\n");
const PROJECTION = Buffer.from("local\0file:.git/config\0core.hookspath\n.synthetic-hooks\0");
const CONFIG_ARGS = ["--no-pager", "--no-optional-locks", "-c", "protocol.allow=never", "-c", "credential.helper=", "-c", "credential.interactive=false",
    "config", "--null", "--show-origin", "--show-scope", "--no-includes", "--get-regexp", "^(core[.]hookspath|include[.]path|includeif[.].*[.]path|extensions[.]worktreeconfig)$"];
const options = { skip: process.platform !== "win32" };
type Context = Readonly<{ root: string; metadata: Readonly<{ executable: string; job: string; environment: NodeJS.ProcessEnv; available(): boolean }>;
    environment: Readonly<NodeJS.ProcessEnv>; available(): boolean }>;
type Result = Readonly<{ status: "COMPLETE"; bytes: Buffer } | { status: "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
interface Options { context: Context; operation: unknown; valid: () => boolean; deadline: number; now?: () => number; spawn?: typeof spawn }
interface Worker { start(): Promise<Result>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void }
type Factory = new (options: Options) => Worker;
type Call = { file: string; args: readonly string[]; options: Record<string, any> };
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
async function context(): Promise<Context> {
    const root = await mkdtemp(join(tmpdir(), "soter-f26a-owner-process-"));
    for (const name of ["objects/info", "objects/pack", "refs/heads"]) await mkdir(join(root, ".git", ...name.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), CONFIG, { flag: "wx" }); await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    const header = Buffer.alloc(12); header.write("DIRC"); header.writeUInt32BE(2, 4);
    await writeFile(join(root, ".git", "index"), Buffer.concat([header, createHash("sha1").update(header).digest()]), { flag: "wx" });
    const source = "../history-hooks/CheckedOwnerHookContext", api = await import(source) as {
        prepareCheckedOwnerHookContext(root: string, ambient: NodeJS.ProcessEnv, enabled: () => boolean): Promise<Context | undefined> };
    const value = await api.prepareCheckedOwnerHookContext(root, { HOME: join(root, "synthetic-profile"), GIT_CONFIG_GLOBAL: join(root, "synthetic-global"),
        GIT_CONFIG_SYSTEM: join(root, "synthetic-system"), GIT_CONFIG_NOSYSTEM: "1", SystemRoot: "C:\\Windows", PATH: PRIVATE, NODE_OPTIONS: PRIVATE, OPENAI_API_KEY: PRIVATE }, () => true);
    assert.ok(value); return value;
}
class Child extends EventEmitter {
    readonly stdin = new PassThrough({ autoDestroy: false }); readonly stdout = new PassThrough({ autoDestroy: false }); readonly stderr = new PassThrough({ autoDestroy: false });
    readonly input: Buffer[] = []; killCalls = 0; destroyCalls = 0;
    constructor(readonly pid: number | undefined) {
        super(); this.stdin.on("data", bytes => this.input.push(Buffer.from(bytes)));
        for (const stream of [this.stdin, this.stdout, this.stderr]) stream.destroy = (() => { this.destroyCalls++; throw Error("Pipe destruction forbidden."); }) as typeof stream.destroy;
    }
    kill(): never { this.killCalls++; throw Error("Process signals forbidden."); }
    async eof(channel: "stdout" | "stderr"): Promise<void> { this[channel].end(); await tick(); }
    async close(code: number | null = 0, signal: NodeJS.Signals | null = null): Promise<void> { this.emit("close", code, signal); await tick(); }
    async finish(code: number | null = 0, signal: NodeJS.Signals | null = null): Promise<void> { await this.eof("stdout"); await this.eof("stderr"); await this.close(code, signal); }
}
async function fixture(operation: unknown = "version", overrides: Partial<Options> = {}, reusable?: Context, child = new Child(46521)) {
    const source = "../history-hooks/OwnerHookGitProcess", module = await import(source) as { OwnerHookGitProcess?: Factory };
    assert.equal(typeof module.OwnerHookGitProcess, "function"); const owner = reusable ?? await context(), calls: Call[] = [];
    const fakeSpawn = ((file: string, args: readonly string[], settings: Record<string, any>) => {
        calls.push({ file, args: [...args], options: settings }); if (child.pid !== undefined) queueMicrotask(() => child.emit("spawn")); return child as unknown as ChildProcess;
    }) as typeof spawn;
    const Constructor = module.OwnerHookGitProcess as Factory;
    const worker = new Constructor({ context: owner, operation, valid: () => true, deadline: 61000, now: () => 1000, spawn: fakeSpawn, ...overrides });
    let settled = false, closed = false; void worker.closed.then(() => { closed = true; });
    return { context: owner, calls, child, worker, get settled() { return settled; }, get closed() { return closed; },
        start() { return worker.start().then(value => { settled = true; return value; }); },
        async begin() { const result = this.start(); await tick(); assert.equal(calls.length, 1); return { result }; },
        noActions() { assert.equal(child.killCalls, 0); assert.equal(child.destroyCalls, 0); assert.equal(child.input.length, 0);
            for (const call of calls) for (const key of ["signal", "timeout", "killSignal"]) assert.equal(call.options[key], undefined); } };
}
function unavailable(value: Result, status?: "UNAVAILABLE" | "STOP_UNCONFIRMED"): void {
    assert.notEqual(value.status, "COMPLETE"); if (status) assert.equal(value.status, status); assert.ok(Object.isFrozen(value));
    assert.deepEqual(Object.keys(value), ["status"]); assert.ok(!JSON.stringify(value).includes(PRIVATE));
}
function fixed(call: Call, owner: Context): void {
    assert.equal(call.file, GIT); assert.equal(call.file, owner.metadata.executable); assert.equal(call.options.shell, false); assert.equal(call.options.windowsHide, true);
    assert.deepEqual(call.options.stdio, ["ignore", "pipe", "pipe"]); assert.deepEqual(call.options.env, owner.environment); assert.notDeepEqual(call.options.env, owner.metadata.environment);
    assert.equal(call.options.env.HOME, owner.environment.HOME); assert.equal(call.options.env.GIT_CONFIG_GLOBAL, owner.environment.GIT_CONFIG_GLOBAL);
    for (const name of ["PATH", "NODE_OPTIONS", "OPENAI_API_KEY", "GIT_CONFIG_COUNT", "GIT_INDEX_FILE"]) assert.equal(call.options.env[name], undefined);
    assert.ok(!Object.values(call.options.env).includes(PRIVATE)); assert.ok(!call.args.some(arg => /core\.hookspath=/i.test(arg)));
}

test("F26a owner transport version uses pinned executable exact args owner env and private-job cwd", options, async () => {
    const f = await fixture(), { result } = await f.begin(); fixed(f.calls[0], f.context); assert.deepEqual(f.calls[0].args, ["--version"]); assert.equal(f.calls[0].options.cwd, f.context.metadata.job);
    f.child.stdout.write(VERSION); await f.child.finish(); const value = await result; assert.deepEqual(value, { status: "COMPLETE", bytes: VERSION }); assert.ok(Object.isFrozen(value)); await f.worker.closed; f.noActions();
});

test("F26a owner transport config preserves exact selected projection args without empty-hook override", options, async () => {
    const f = await fixture("config"), { result } = await f.begin(); fixed(f.calls[0], f.context); assert.deepEqual(f.calls[0].args, CONFIG_ARGS); assert.equal(f.calls[0].options.cwd, f.context.root);
    f.child.stdout.write(PROJECTION); await f.child.finish(); assert.deepEqual(await result, { status: "COMPLETE", bytes: PROJECTION }); f.noActions();
});

test("F26a owner transport permits config exit1 only for empty stdout and stderr", options, async () => {
    const owner = await context();
    for (const [operation, output, complete] of [["config", Buffer.alloc(0), true], ["config", PROJECTION, false], ["version", Buffer.alloc(0), false]] as const) {
        const f = await fixture(operation, {}, owner), { result } = await f.begin(); if (output.length) f.child.stdout.write(output); await f.child.finish(1);
        const value = await result; if (complete) assert.deepEqual(value, { status: "COMPLETE", bytes: Buffer.alloc(0) }); else unavailable(value); f.noActions();
    }
});

test("F26a owner transport requires close and both actual EOFs regardless of observation order", options, async () => {
    const owner = await context();
    for (const closeFirst of [false, true]) {
        const f = await fixture("config", {}, owner), { result } = await f.begin(); f.child.stdout.write(PROJECTION);
        if (closeFirst) { await f.child.close(); await f.child.eof("stdout"); } else { await f.child.eof("stdout"); await f.child.eof("stderr"); }
        assert.equal(f.settled, false); assert.equal(f.closed, false); assert.equal(f.worker.busy, true);
        if (closeFirst) await f.child.eof("stderr"); else await f.child.close(); assert.equal((await result).status, "COMPLETE"); await f.worker.closed; f.noActions();
    }
});

test("F26a owner transport rejects nonzero missing-exit and signalled closures", options, async () => {
    const owner = await context(); for (const [code, signal] of [[2, null], [null, null], [0, "SIGTERM"]] as const) {
        const f = await fixture("config", {}, owner), { result } = await f.begin(); f.child.stdout.write(PROJECTION); await f.child.finish(code, signal); unavailable(await result); await f.worker.closed; f.noActions();
    }
});

test("F26a owner transport any stderr withholds and overflow retains ownership without signals", options, async () => {
    const owner = await context(); for (const size of [1, 8192, 8193]) {
        const f = await fixture("config", {}, owner), { result } = await f.begin(); f.child.stderr.write(Buffer.alloc(size, 0x61));
        if (size > 8192) { unavailable(await result, "STOP_UNCONFIRMED"); assert.equal(f.worker.busy, true); assert.equal(f.closed, false); }
        await f.child.finish(1); unavailable(await result); await f.worker.closed; f.noActions();
    }
});

test("F26a owner transport exact4096 and65536 stdout caps pass while one extra byte withdraws", options, async () => {
    const owner = await context(); for (const [operation, cap] of [["version", 4096], ["config", 65536]] as const) for (const extra of [0, 1]) {
        const f = await fixture(operation, {}, owner), { result } = await f.begin(); f.child.stdout.write(Buffer.alloc(cap + extra, 0x61));
        if (extra) { unavailable(await result, "STOP_UNCONFIRMED"); assert.equal(f.worker.busy, true); assert.equal(f.closed, false); }
        await f.child.finish(); const value = await result; if (extra) unavailable(value); else { assert.equal(value.status, "COMPLETE"); if (value.status === "COMPLETE") assert.equal(value.bytes.length, cap); } f.noActions();
    }
});

test("F26a owner transport privately copies chunks before caller buffers can change", options, async () => {
    const f = await fixture("config"), { result } = await f.begin(), chunk = Buffer.from(PRIVATE), expected = Buffer.from(chunk);
    f.child.stdout.write(chunk); chunk.fill(0); await f.child.finish(); const value = await result; assert.equal(value.status, "COMPLETE"); if (value.status === "COMPLETE") assert.ok(value.bytes.equals(expected)); f.noActions();
});

test("F26a owner transport only exact operation strings are accepted without coercion", options, async () => {
    const owner = await context(); let traps = 0; const proxy = new Proxy({}, { get() { traps++; throw Error(PRIVATE); }, getPrototypeOf() { traps++; throw Error(PRIVATE); } });
    for (const operation of [undefined, null, "", "CONFIG", "show", { kind: "version" }, new String("config"), proxy]) {
        const f = await fixture("config", { operation }, owner); unavailable(await f.start()); assert.equal(f.calls.length, 0); await f.worker.closed; f.noActions();
    } assert.equal(traps, 0);
});

test("F26a owner transport refuses forged contexts without invoking available accessors", options, async () => {
    const owner = await context(); let traps = 0;
    const proxy = new Proxy(owner, { get() { traps++; throw Error(PRIVATE); } }), accessor = { get available() { traps++; throw Error(PRIVATE); } };
    for (const invalid of [{ ...owner }, owner.metadata, proxy, accessor, {}]) {
        const f = await fixture("config", { context: invalid as Context }, owner); unavailable(await f.start()); assert.equal(f.calls.length, 0); await f.worker.closed; f.noActions();
    } assert.equal(traps, 0);
});

test("F26a owner transport is one shot and pre-start withdrawal never schedules a child", options, async () => {
    const owner = await context(), before = await fixture("config", {}, owner); before.worker.withdraw(); unavailable(await before.start()); unavailable(await before.start()); assert.equal(before.calls.length, 0); await before.worker.closed; before.noActions();
    const f = await fixture("config", {}, owner), { result } = await f.begin(); unavailable(await f.worker.start()); assert.equal(f.calls.length, 1); await f.child.finish(); await result; unavailable(await f.worker.start()); f.noActions();
});

test("F26a owner transport active withdrawal retains busy until close plus both EOFs", options, async () => {
    const f = await fixture("config"), { result } = await f.begin(); f.child.stdout.write(Buffer.from(PRIVATE)); f.worker.withdraw(); unavailable(await result, "STOP_UNCONFIRMED");
    assert.equal(f.worker.busy, true); assert.equal(f.closed, false); f.child.stdout.write(Buffer.from(PRIVATE + "-late")); await f.child.close(); await f.child.eof("stdout");
    assert.equal(f.worker.busy, true); assert.equal(f.closed, false); await f.child.eof("stderr"); await f.worker.closed; assert.equal(f.worker.busy, false); f.noActions();
});

test("F26a owner transport refuses expired nonfinite deadlines and disabled guards before spawn", options, async () => {
    const owner = await context(); for (const overrides of [{ deadline: 1000 }, { deadline: 999 }, { deadline: Number.NaN }, { deadline: Number.POSITIVE_INFINITY }, { valid: () => false }, { valid: () => { throw Error(PRIVATE); } }]) {
        const f = await fixture("config", overrides, owner); unavailable(await f.start()); assert.equal(f.calls.length, 0); await f.worker.closed; f.noActions();
    }
});

test("F26a owner transport elapsed bad and reversed clocks cannot renew its60second bound", options, async () => {
    const owner = await context(); for (const after of [1031, 61001, 999, Number.NaN, Number.POSITIVE_INFINITY]) {
        let clock = 1000; const f = await fixture("config", { now: () => clock, deadline: after === 1031 ? 1030 : 999999 }, owner), { result } = await f.begin();
        clock = after; f.child.stdout.write(PROJECTION); await f.child.finish(); unavailable(await result); await f.worker.closed; f.noActions();
    }
});

test("F26a owner transport final guard callback expiry or reentrant withdrawal cannot release bytes", options, async () => {
    const owner = await context(); for (const kind of ["elapsed", "withdraw"]) {
        let clock = 1000, armed = false, worker: Worker | undefined;
        const f = await fixture("config", { now: () => clock, valid: () => { if (armed) { if (kind === "elapsed") clock = 61000; else worker!.withdraw(); } return true; } }, owner);
        worker = f.worker; const { result } = await f.begin(); f.child.stdout.write(PROJECTION); armed = true; await f.child.finish(); unavailable(await result); await f.worker.closed; f.noActions();
    }
});

test("F26a owner transport context drift blocks admission or withholds a held completion", options, async () => {
    for (const before of [true, false]) {
        const owner = await context(), f = await fixture("config", {}, owner), config = join(owner.root, ".git", "config");
        if (before) { await writeFile(config, CONFIG + "[core]\n hooksPath = .changed\n"); unavailable(await f.start()); assert.equal(f.calls.length, 0); }
        else { const { result } = await f.begin(); f.child.stdout.write(PROJECTION); await writeFile(config, CONFIG + "[core]\n hooksPath = .changed\n"); await f.child.finish(); unavailable(await result); }
        await f.worker.closed; f.noActions();
    }
});

test("F26a owner transport thrown spawn and no-PID error do not invent live ownership", options, async () => {
    const owner = await context(), thrown = await fixture("config", { spawn: (() => { throw Error(PRIVATE); }) as typeof spawn }, owner);
    unavailable(await thrown.start()); await thrown.worker.closed; assert.equal(thrown.worker.busy, false); thrown.noActions();
    const child = new Child(undefined), f = await fixture("config", {}, owner, child), { result } = await f.begin(); child.emit("error", Error(PRIVATE)); unavailable(await result); await f.worker.closed; assert.equal(f.worker.busy, false); f.noActions();
});

test("F26a owner transport errors after PID ownership wait for natural close and both EOFs", options, async () => {
    const owner = await context(); for (const channel of ["child", "stdout", "stderr"] as const) {
        const f = await fixture("config", {}, owner), { result } = await f.begin();
        if (channel === "child") f.child.emit("error", Error(PRIVATE)); else f.child[channel].emit("error", Error(PRIVATE));
        unavailable(await result, "STOP_UNCONFIRMED"); assert.equal(f.worker.busy, true); assert.equal(f.closed, false);
        await f.child.finish(); await f.worker.closed; assert.equal(f.worker.busy, false); f.noActions();
    }
});
