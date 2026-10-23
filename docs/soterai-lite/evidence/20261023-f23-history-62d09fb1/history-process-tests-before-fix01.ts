import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import type { ChildProcess, spawn } from "node:child_process";
import type { CheckedGitMetadata } from "../terminal/CheckedGitMetadata";

// F23 test-first private transport controls. Only manually constructed synthetic
// metadata is inspected; every child is fake. All temporary fixtures are retained.
const PRIVATE = "TEST_ONLY_F23_PROCESS_PRIVATE_92e71b4c";
const GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
const VERSION = Buffer.from("git version 2.53.0.windows.1\n");
const OBJECT = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "abcdef0123456789abcdef0123456789abcdef01";
const CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n";
type Result = { status: "COMPLETE"; bytes: Buffer } | { status: "UNAVAILABLE" | "STOP_UNCONFIRMED" };
interface Options { root: string; descriptor: CheckedGitMetadata; operation: unknown; valid: () => boolean;
    deadline: number; now?: () => number; spawn?: typeof spawn }
interface Process { start(): Promise<Result>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void }
type Factory = new (options: Options) => Process;
type Call = { file: string; args: readonly string[]; options: Record<string, any> };
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };

class Child extends EventEmitter {
    readonly stdin = new PassThrough({ autoDestroy: false });
    readonly stdout = new PassThrough({ autoDestroy: false });
    readonly stderr = new PassThrough({ autoDestroy: false });
    readonly input: Buffer[] = [];
    killCalls = 0; destroyCalls = 0;
    constructor(readonly pid: number | undefined = 45231) {
        super(); this.stdin.on("data", bytes => this.input.push(Buffer.from(bytes)));
        for (const stream of [this.stdin, this.stdout, this.stderr]) {
            stream.destroy = (() => { this.destroyCalls++; throw Error("Destroy is not authorized."); }) as typeof stream.destroy;
        }
    }
    kill(): never { this.killCalls++; throw Error("Process signals are not authorized."); }
    async eof(channel: "stdout" | "stderr"): Promise<void> { this[channel].end(); await tick(); }
    async close(code: number | null = 0, signal: NodeJS.Signals | null = null): Promise<void> {
        this.emit("close", code, signal); await tick();
    }
    async finish(code: number | null = 0, signal: NodeJS.Signals | null = null): Promise<void> {
        await this.eof("stdout"); await this.eof("stderr"); await this.close(code, signal);
    }
}

async function fixture(operation: unknown = { kind: "version" }, overrides: Partial<Options> = {}, duration = 60000, child = new Child()) {
    const module = await import("../history/HistoryGitProcess");
    assert.equal(typeof module.HistoryGitProcess, "function");
    const root = await mkdtemp(join(tmpdir(), "soter-f23-process-fixture-"));
    await mkdir(join(root, ".git", "objects", "info"), { recursive: true });
    await mkdir(join(root, ".git", "objects", "pack"), { recursive: true });
    await mkdir(join(root, ".git", "refs", "heads"), { recursive: true });
    await writeFile(join(root, ".git", "config"), CONFIG, { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    const { prepareCheckedGitMetadata } = await import("../terminal/CheckedGitMetadata");
    const descriptor = await prepareCheckedGitMetadata(root, { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
        COMSPEC: process.env.COMSPEC, PATH: PRIVATE, OPENAI_API_KEY: PRIVATE, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: PRIVATE,
        GIT_CONFIG_VALUE_0: PRIVATE, GIT_OBJECT_DIRECTORY: PRIVATE, GIT_ALTERNATE_OBJECT_DIRECTORIES: PRIVATE, NODE_OPTIONS: PRIVATE }, () => true);
    assert.ok(descriptor);
    const calls: Call[] = [];
    const fakeSpawn = ((file: string, args: readonly string[], options: Record<string, any>) => {
        calls.push({ file, args: [...args], options });
        if (child.pid !== undefined) queueMicrotask(() => child.emit("spawn"));
        return child as unknown as ChildProcess;
    }) as typeof spawn;
    const now = overrides.now ?? (() => performance.now());
    const worker = new (module.HistoryGitProcess as unknown as Factory)({ root, descriptor, operation, valid: () => true,
        now, deadline: now() + duration, spawn: fakeSpawn, ...overrides });
    let settled = false, closed = false;
    void worker.closed.then(() => { closed = true; });
    return { root, descriptor, child, calls, worker, get settled() { return settled; }, get closed() { return closed; },
        start() { return worker.start().then(result => { settled = true; return result; }); },
        async begin() { const result = this.start(); await tick(); assert.equal(calls.length, 1); return { result }; },
        checkNoActions() { assert.equal(child.killCalls, 0); assert.equal(child.destroyCalls, 0); for (const call of calls) assert.equal(call.options.signal, undefined); } };
}
function unavailable(result: Result, status?: "UNAVAILABLE" | "STOP_UNCONFIRMED"): void {
    assert.notEqual(result.status, "COMPLETE"); if (status) assert.equal(result.status, status);
    assert.deepEqual(Object.keys(result), ["status"]); assert(!JSON.stringify(result).includes(PRIVATE));
}
function fixedPrefix(call: Call, descriptor: CheckedGitMetadata): void {
    assert.equal(call.file, GIT); assert.equal(call.options.shell, false); assert.equal(call.options.windowsHide, true);
    assert.deepEqual(call.options.env, descriptor.environment); assert(!JSON.stringify(call.options.env).includes(PRIVATE));
    for (const name of ["--no-pager", "--literal-pathspecs", "--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks"])
        assert(call.args.includes(name), name);
    for (const value of ["core.hooksPath=" + join(descriptor.job, "empty-hooks"), "core.fsmonitor=false", "credential.helper=",
        "protocol.allow=never", "core.pager=", "color.ui=false", "core.attributesFile=" + join(descriptor.job, "empty.gitconfig")])
        assert(call.args.some((arg, index) => arg === "-c" && call.args[index + 1] === value), value);
    for (const key of ["PATH", "OPENAI_API_KEY", "GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "NODE_OPTIONS"])
        assert.equal(call.options.env[key], undefined, key);
    assert.equal(call.options.signal, undefined);
}

test("F23 process uses pinned Git, fixed safe options and the descriptor environment for version", { timeout: 1000 }, async () => {
    const f = await fixture(), { result } = await f.begin();
    fixedPrefix(f.calls[0], f.descriptor); assert.equal(f.calls[0].options.cwd, f.descriptor.job);
    assert.deepEqual(f.calls[0].args.slice(-1), ["--version"]);
    f.child.stdout.write(VERSION); await f.child.finish();
    assert.deepEqual(await result, { status: "COMPLETE", bytes: VERSION }); await f.worker.closed;
    assert.equal(f.worker.busy, false); f.checkNoActions();
});

test("F23 process has literal all-ref commits and exact-object tree operation arguments", { timeout: 1000 }, async () => {
    for (const [operation, suffix] of [[{ kind: "commits" }, ["rev-list", "--max-count=33", "--all", "--"]],
        [{ kind: "tree", oid: OBJECT }, ["ls-tree", "-r", "-z", "--full-tree", "--long", OBJECT, "--"]]] as const) {
        const f = await fixture(operation), { result } = await f.begin(); fixedPrefix(f.calls[0], f.descriptor);
        assert.equal(f.calls[0].options.cwd, f.root); assert.deepEqual(f.calls[0].args.slice(-suffix.length), [...suffix]);
        await f.child.finish(); assert.deepEqual(await result, { status: "COMPLETE", bytes: Buffer.alloc(0) }); f.checkNoActions();
    }
});

test("F23 batch passes validated object IDs only through private stdin", { timeout: 1000 }, async () => {
    const f = await fixture({ kind: "batch", objects: [{ oid: OBJECT, size: 5 }, { oid: OTHER, size: 7 }] }), { result } = await f.begin();
    fixedPrefix(f.calls[0], f.descriptor); assert.equal(f.calls[0].options.cwd, f.root);
    assert.deepEqual(f.calls[0].args.slice(-2), ["cat-file", "--batch"]);
    assert.equal(Buffer.concat(f.child.input).toString(), OBJECT + "\n" + OTHER + "\n");
    assert(f.child.stdin.writableEnded); await f.child.finish(); await result; f.checkNoActions();
});

test("F23 process requires close even after both stdout and stderr EOFs", { timeout: 1000 }, async () => {
    const f = await fixture(), { result } = await f.begin(); f.child.stdout.write(VERSION);
    await f.child.eof("stdout"); await f.child.eof("stderr");
    assert.equal(f.settled, false); assert.equal(f.closed, false); assert.equal(f.worker.busy, true);
    await f.child.close(); assert.equal((await result).status, "COMPLETE"); await f.worker.closed; f.checkNoActions();
});

test("F23 process requires both real EOFs even when close0 was observed first", { timeout: 1000 }, async () => {
    const f = await fixture(), { result } = await f.begin(); f.child.stdout.write(VERSION); await f.child.close();
    assert.equal(f.settled, false); assert.equal(f.closed, false); assert.equal(f.worker.busy, true);
    await f.child.eof("stdout"); assert.equal(f.settled, false); assert.equal(f.worker.busy, true);
    await f.child.eof("stderr"); assert.equal((await result).status, "COMPLETE"); await f.worker.closed; f.checkNoActions();
});

test("F23 process withholds valid-looking stdout when the actual child exit is nonzero", { timeout: 1000 }, async () => {
    const f = await fixture(), { result } = await f.begin(); f.child.stdout.write(VERSION); await f.child.finish(1);
    unavailable(await result, "UNAVAILABLE"); await f.worker.closed; assert.equal(f.worker.busy, false); f.checkNoActions();
});

test("F23 process does not treat a signal closure or missing exit code as successful exit0", { timeout: 1000 }, async () => {
    for (const [code, signal] of [[0, "SIGTERM"], [null, null]] as const) {
        const f = await fixture(), { result } = await f.begin(); f.child.stdout.write(VERSION);
        await f.child.finish(code, signal); unavailable(await result); await f.worker.closed; f.checkNoActions();
    }
});

test("F23 process consumes private stderr without returning or logging its bytes", { timeout: 1000 }, async () => {
    const f = await fixture(), { result } = await f.begin(); f.child.stdout.write(VERSION); f.child.stderr.write(PRIVATE);
    await f.child.finish(); unavailable(await result); await f.worker.closed; f.checkNoActions();
});

test("F23 process rejects stderr beyond8192 bytes without destroying or signalling the child", { timeout: 1000 }, async () => {
    const f = await fixture(), { result } = await f.begin(); f.child.stderr.write(Buffer.alloc(8193, 0x61));
    await tick(); assert.equal(f.worker.busy, true); f.checkNoActions(); await f.child.finish(); unavailable(await result); await f.worker.closed;
});

test("F23 process separately caps version, commit, tree and batch stdout streams", { timeout: 1000 }, async () => {
    for (const [operation, overflow] of [[{ kind: "version" }, 4097], [{ kind: "commits" }, 4097], [{ kind: "tree", oid: OBJECT }, 262145],
        [{ kind: "batch", objects: [{ oid: OBJECT, size: 3 }, { oid: OTHER, size: 5 }] }, 8 + 96 * 2 + 1]] as const) {
        const f = await fixture(operation), { result } = await f.begin(); f.child.stdout.write(Buffer.alloc(overflow, 0x61));
        await tick(); assert.equal(f.worker.busy, true); f.checkNoActions(); await f.child.finish(); unavailable(await result); await f.worker.closed;
    }
});

test("F23 process pre-start withdrawal is sticky and never schedules a child", { timeout: 1000 }, async () => {
    const f = await fixture(); f.worker.withdraw(); unavailable(await f.start(), "UNAVAILABLE");
    unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 0); assert.equal(f.worker.busy, false); await f.worker.closed; f.checkNoActions();
});

test("F23 active withdrawal returns STOP_UNCONFIRMED and retains busy until close plus bothEOF", { timeout: 1000 }, async () => {
    const f = await fixture(), { result } = await f.begin(); f.child.stdout.write(PRIVATE); f.worker.withdraw();
    unavailable(await result, "STOP_UNCONFIRMED"); assert.equal(f.worker.busy, true); assert.equal(f.closed, false);
    f.child.stdout.write(PRIVATE + "-late"); await f.child.close(); await f.child.eof("stdout");
    assert.equal(f.worker.busy, true); assert.equal(f.closed, false); await f.child.eof("stderr"); await f.worker.closed;
    assert.equal(f.worker.busy, false); unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 1); f.checkNoActions();
});

test("F23 expired or nonfinite deadlines refuse before process creation", { timeout: 1000 }, async () => {
    for (const deadline of [999, 1000, Number.NaN, Number.POSITIVE_INFINITY]) {
        const f = await fixture({ kind: "version" }, { now: () => 1000, deadline });
        unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 0); await f.worker.closed; f.checkNoActions();
    }
});

test("F23 elapsed deadline withdraws without signals while an owned child is still open", { timeout: 1000 }, async () => {
    const f = await fixture({ kind: "version" }, {}, 30), { result } = await f.begin();
    unavailable(await result, "STOP_UNCONFIRMED"); assert.equal(f.worker.busy, true); assert.equal(f.closed, false); f.checkNoActions();
    f.child.stdout.write(PRIVATE); await f.child.finish(); await f.worker.closed; assert.equal(f.worker.busy, false); f.checkNoActions();
});

test("F23 validity withdrawal or guard exceptions cannot release buffered history bytes", { timeout: 1000 }, async () => {
    let enabled = true;
    const f = await fixture({ kind: "version" }, { valid: () => { if (!enabled) throw Error(PRIVATE); return true; } }), { result } = await f.begin();
    f.child.stdout.write(VERSION); enabled = false; await f.child.finish(); unavailable(await result); await f.worker.closed; f.checkNoActions();
    const disabled = await fixture({ kind: "version" }, { valid: () => false });
    unavailable(await disabled.start(), "UNAVAILABLE"); assert.equal(disabled.calls.length, 0); await disabled.worker.closed;
});

test("F23 monotonic clock reversal and nonfinite clock values withhold successful-looking completion", { timeout: 1000 }, async () => {
    for (const invalid of [999, Number.NaN, Number.POSITIVE_INFINITY]) {
        let clock = 1000; const f = await fixture({ kind: "version" }, { now: () => clock }), { result } = await f.begin();
        f.child.stdout.write(VERSION); clock = invalid; await f.child.finish(); unavailable(await result); await f.worker.closed; f.checkNoActions();
    }
});

test("F23 lookalike descriptors cannot authorize history process execution", { timeout: 1000 }, async () => {
    const fake = { executable: GIT, job: "C:\\synthetic-" + PRIVATE, environment: {}, available: () => true };
    const f = await fixture({ kind: "version" }, { descriptor: fake });
    unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 0); await f.worker.closed; f.checkNoActions();
});

test("F23 descriptor drift before start refuses and later repository drift withholds completion", { timeout: 1000 }, async () => {
    const before = await fixture(); await writeFile(join(before.root, ".git", "config"), CONFIG + "[core]\n fsmonitor = " + PRIVATE + "\n");
    unavailable(await before.start(), "UNAVAILABLE"); assert.equal(before.calls.length, 0); await before.worker.closed;
    const during = await fixture(), { result } = await during.begin(); during.child.stdout.write(VERSION);
    await writeFile(join(during.root, ".git", "HEAD"), OBJECT + "\n");
    await during.child.finish(); unavailable(await result); await during.worker.closed; during.checkNoActions();
});

test("F23 unsafe operation selectors and object identities never become Git arguments or stdin", { timeout: 1000 }, async () => {
    for (const operation of [{ kind: "show", oid: OBJECT }, { kind: "tree", oid: "HEAD:.env" }, { kind: "tree", oid: "--all" },
        { kind: "tree", oid: OBJECT.toUpperCase() }, { kind: "tree", oid: PRIVATE }, { kind: "commits", refs: [PRIVATE] },
        { kind: "batch", objects: [{ oid: OBJECT + "\n" + PRIVATE, size: 1 }] },
        { kind: "batch", objects: [{ oid: OBJECT, size: -1 }] }, { kind: "batch", objects: [{ oid: OBJECT, size: 65537 }] },
        { kind: "batch", objects: [{ oid: OBJECT, size: 1 }, { oid: OBJECT, size: 1 }] }]) {
        const f = await fixture(operation); unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 0);
        assert.equal(f.child.input.length, 0); await f.worker.closed; f.checkNoActions();
    }
});

test("F23 synchronously thrown spawn errors are generic and close without inventing a live process", { timeout: 1000 }, async () => {
    const f = await fixture({ kind: "version" }, { spawn: (() => { throw Error(PRIVATE); }) as typeof spawn });
    unavailable(await f.start(), "UNAVAILABLE"); await f.worker.closed; assert.equal(f.worker.busy, false); f.checkNoActions();
});

test("F23 spawn error without a PID settles unavailable without waiting for nonexistent EOFs", { timeout: 1000 }, async () => {
    const child = new Child(undefined);
    // An explicit undefined argument uses the default parameter; remove the PID
    // property to model the no-process error case faithfully.
    Object.defineProperty(child, "pid", { value: undefined });
    const f = await fixture({ kind: "version" }, {}, 60000, child), { result } = await f.begin(); child.emit("error", Error(PRIVATE));
    unavailable(await result, "UNAVAILABLE"); await f.worker.closed; assert.equal(f.worker.busy, false); f.checkNoActions();
});

test("F23 repeated starts cannot schedule a second child or replay withdrawn output", { timeout: 1000 }, async () => {
    const f = await fixture(), { result } = await f.begin(); const again = f.worker.start(); await tick();
    assert.equal(f.calls.length, 1); f.child.stdout.write(VERSION); await f.child.finish(); assert.equal((await result).status, "COMPLETE");
    await again; await f.worker.closed; f.worker.withdraw(); unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 1); f.checkNoActions();
});
