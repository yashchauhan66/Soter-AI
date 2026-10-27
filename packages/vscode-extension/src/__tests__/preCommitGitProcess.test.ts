import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import type { ChildProcess, spawn } from "node:child_process";

// F26a TEST-FIRST private transport. Manual retained synthetic indexes and
// genuine checked capabilities; ALL children/events are fake. No Git executes.
const PRIVATE = "TEST_ONLY_F26A_PROCESS_PRIVATE_d7309b41";
const GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
const OBJECT = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "abcdef0123456789abcdef0123456789abcdef01";
const VERSION = Buffer.from("git version 2.53.0.windows.1\n");
const CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n";
const options = { skip: process.platform !== "win32" };
type Index = Readonly<{ root: string; indexFile: string; metadata: Readonly<{ executable: string; job: string;
    environment: NodeJS.ProcessEnv; available(): boolean }>; environment: NodeJS.ProcessEnv; available(): boolean }>;
type Result = Readonly<{ status: "COMPLETE"; bytes: Buffer } | { status: "UNAVAILABLE" | "STOP_UNCONFIRMED" }>;
interface Options { index: Index; operation: unknown; valid: () => boolean; deadline: number; now?: () => number; spawn?: typeof spawn }
interface Worker { start(): Promise<Result>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void }
type Factory = new (options: Options) => Worker;
type Call = { file: string; args: readonly string[]; options: Record<string, any> };
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
const oid = (ordinal: number) => ordinal.toString(16).padStart(40, "0");
function manualIndex(): Buffer {
    const header = Buffer.alloc(12); header.write("DIRC", 0, "ascii"); header.writeUInt32BE(2, 4); header.writeUInt32BE(1, 8);
    const name = Buffer.from("public.txt"), row = Buffer.alloc(Math.ceil((62 + name.length + 1) / 8) * 8);
    row.writeUInt32BE(0o100644, 24); Buffer.from(OBJECT, "hex").copy(row, 40); row.writeUInt16BE(name.length, 60); name.copy(row, 62);
    const body = Buffer.concat([header, row]); return Buffer.concat([body, createHash("sha1").update(body).digest()]);
}
async function syntheticIndex(): Promise<Index> {
    const root = await mkdtemp(join(tmpdir(), "soter-f26a-process-"));
    for (const directory of ["objects/info", "objects/pack", "refs/heads"])
        await mkdir(join(root, ".git", ...directory.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), CONFIG, { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    await writeFile(join(root, ".git", "index"), manualIndex(), { flag: "wx" });
    const { prepareCheckedHookIndex } = await import("../history-hooks/CheckedHookIndex");
    const value = await prepareCheckedHookIndex(root, undefined, { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
        COMSPEC: process.env.COMSPEC, PATH: PRIVATE, NODE_OPTIONS: PRIVATE, OPENAI_API_KEY: PRIVATE, GIT_INDEX_FILE: PRIVATE,
        GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: PRIVATE, GIT_CONFIG_VALUE_0: PRIVATE, GIT_OBJECT_DIRECTORY: PRIVATE }, () => true);
    assert.ok(value, "manual synthetic index must acquire a genuine checked capability"); return value;
}
class Child extends EventEmitter {
    readonly stdin = new PassThrough({ autoDestroy: false });
    readonly stdout = new PassThrough({ autoDestroy: false });
    readonly stderr = new PassThrough({ autoDestroy: false });
    readonly input: Buffer[] = []; killCalls = 0; destroyCalls = 0;
    constructor(readonly pid: number | undefined) {
        super(); this.stdin.on("data", bytes => this.input.push(Buffer.from(bytes)));
        for (const stream of [this.stdin, this.stdout, this.stderr])
            stream.destroy = (() => { this.destroyCalls++; throw Error("Pipe destruction is not authorized."); }) as typeof stream.destroy;
    }
    kill(): never { this.killCalls++; throw Error("No process signals are authorized."); }
    async eof(channel: "stdout" | "stderr"): Promise<void> { this[channel].end(); await tick(); }
    async close(code: number | null = 0, signal: NodeJS.Signals | null = null): Promise<void> { this.emit("close", code, signal); await tick(); }
    async finish(code: number | null = 0, signal: NodeJS.Signals | null = null): Promise<void> {
        await this.eof("stdout"); await this.eof("stderr"); await this.close(code, signal);
    }
}
async function fixture(operation: unknown = { kind: "version" }, overrides: Partial<Options> = {}, reusable?: Index, child = new Child(46231)) {
    const module = await import("../history-hooks/PreCommitGitProcess"); assert.equal(typeof module.PreCommitGitProcess, "function");
    const index = reusable ?? await syntheticIndex(), calls: Call[] = [];
    const fakeSpawn = ((file: string, args: readonly string[], settings: Record<string, any>) => {
        calls.push({ file, args: [...args], options: settings });
        if (child.pid !== undefined) queueMicrotask(() => child.emit("spawn")); return child as unknown as ChildProcess;
    }) as typeof spawn;
    const worker = new (module.PreCommitGitProcess as unknown as Factory)({ index, operation, valid: () => true,
        deadline: 61000, now: () => 1000, spawn: fakeSpawn, ...overrides });
    let settled = false, closed = false; void worker.closed.then(() => { closed = true; });
    return { index, calls, child, worker, get settled() { return settled; }, get closed() { return closed; },
        start() { return worker.start().then(value => { settled = true; return value; }); },
        async begin() { const result = this.start(); await tick(); assert.equal(calls.length, 1); return { result }; },
        noActions() {
            assert.equal(child.killCalls, 0); assert.equal(child.destroyCalls, 0);
            for (const call of calls) for (const name of ["signal", "timeout", "killSignal"]) assert.equal(call.options[name], undefined);
        } };
}
function unavailable(value: Result, status?: "UNAVAILABLE" | "STOP_UNCONFIRMED"): void {
    assert.notEqual(value.status, "COMPLETE"); if (status) assert.equal(value.status, status);
    assert.deepEqual(Object.keys(value), ["status"]); assert.ok(!JSON.stringify(value).includes(PRIVATE));
}
function fixed(call: Call, index: Index): void {
    assert.equal(call.file, GIT); assert.equal(call.file, index.metadata.executable);
    assert.equal(call.options.shell, false); assert.equal(call.options.windowsHide, true);
    assert.deepEqual(call.options.env, index.environment); assert.equal(call.options.env.GIT_INDEX_FILE, index.indexFile);
    assert.ok(!Object.values(call.options.env).includes(PRIVATE));
    for (const key of ["PATH", "NODE_OPTIONS", "OPENAI_API_KEY", "GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_OBJECT_DIRECTORY"])
        assert.equal(call.options.env[key], undefined);
    for (const argument of ["--no-pager", "--literal-pathspecs", "--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks"])
        assert.ok(call.args.includes(argument));
    for (const argument of ["core.hooksPath=" + join(index.metadata.job, "empty-hooks"), "core.fsmonitor=false", "credential.helper=",
        "commit.gpgSign=false", "protocol.allow=never", "core.pager=", "color.ui=false", "gc.auto=0", "maintenance.auto=false",
        "core.attributesFile=" + join(index.metadata.job, "empty.gitconfig")])
        assert.ok(call.args.some((value, at) => value === "-c" && call.args[at + 1] === argument));
}

test("F26a process pins version executable safe prefix environment and metadata-job cwd", options, async () => {
    const f = await fixture(), { result } = await f.begin(); fixed(f.calls[0], f.index);
    assert.equal(f.calls[0].options.cwd, f.index.metadata.job); assert.deepEqual(f.calls[0].args.slice(-1), ["--version"]);
    assert.deepEqual(f.calls[0].options.stdio, ["ignore", "pipe", "pipe"]);
    f.child.stdout.write(VERSION); await f.child.finish(); assert.deepEqual(await result, { status: "COMPLETE", bytes: VERSION });
    await f.worker.closed; assert.equal(f.worker.busy, false); f.noActions();
});

test("F26a entries process uses the actual checked root and literal stage-NUL suffix", options, async () => {
    const f = await fixture({ kind: "entries" }), { result } = await f.begin(); fixed(f.calls[0], f.index);
    assert.equal(f.calls[0].options.cwd, f.index.root); assert.deepEqual(f.calls[0].args.slice(-3), ["ls-files", "--stage", "-z"]);
    assert.equal(f.child.input.length, 0); await f.child.finish(); assert.equal((await result).status, "COMPLETE"); f.noActions();
});

test("F26a sizes process puts validated IDs only in private stdin with a fixed batch-check suffix", options, async () => {
    const f = await fixture({ kind: "sizes", oids: [OBJECT, OTHER] }), { result } = await f.begin(); fixed(f.calls[0], f.index);
    assert.equal(f.calls[0].options.cwd, f.index.root);
    assert.deepEqual(f.calls[0].args.slice(-2), ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"]);
    assert.equal(Buffer.concat(f.child.input).toString("ascii"), OBJECT + "\n" + OTHER + "\n");
    assert.equal(f.child.stdin.writableEnded, true); assert.ok(!f.calls[0].args.includes(OBJECT));
    await f.child.finish(); await result; f.noActions();
});

test("F26a batch process sends no sizes paths or content through argv or environment", options, async () => {
    const f = await fixture({ kind: "batch", objects: [{ oid: OBJECT, size: 0 }, { oid: OTHER, size: 7 }] }), { result } = await f.begin(); fixed(f.calls[0], f.index);
    assert.deepEqual(f.calls[0].args.slice(-2), ["cat-file", "--batch"]); assert.equal(f.calls[0].options.cwd, f.index.root);
    assert.deepEqual(f.calls[0].options.stdio, ["pipe", "pipe", "pipe"]);
    assert.equal(Buffer.concat(f.child.input).toString("ascii"), OBJECT + "\n" + OTHER + "\n");
    assert.ok(!JSON.stringify(f.calls[0].args).includes(OBJECT)); await f.child.finish(); await result; f.noActions();
});

test("F26a process waits for real close after both EOFs", options, async () => {
    const f = await fixture(), { result } = await f.begin(); f.child.stdout.write(VERSION);
    await f.child.eof("stdout"); await f.child.eof("stderr"); assert.equal(f.settled, false); assert.equal(f.closed, false); assert.equal(f.worker.busy, true);
    await f.child.close(); assert.equal((await result).status, "COMPLETE"); await f.worker.closed; f.noActions();
});

test("F26a process waits for each EOF after a close0 observation", options, async () => {
    const f = await fixture(), { result } = await f.begin(); f.child.stdout.write(VERSION); await f.child.close();
    assert.equal(f.settled, false); assert.equal(f.closed, false); await f.child.eof("stdout"); assert.equal(f.settled, false); assert.equal(f.worker.busy, true);
    await f.child.eof("stderr"); assert.equal((await result).status, "COMPLETE"); await f.worker.closed; assert.equal(f.worker.busy, false); f.noActions();
});

test("F26a process copies held private chunks instead of retaining caller-mutable buffers", options, async () => {
    const f = await fixture(), { result } = await f.begin(), chunk = Buffer.from(PRIVATE), expected = Buffer.from(chunk);
    f.child.stdout.write(chunk); chunk.fill(0); await f.child.finish();
    const value = await result; assert.equal(value.status, "COMPLETE"); if (value.status === "COMPLETE") assert.equal(Buffer.compare(value.bytes, expected), 0); f.noActions();
});

test("F26a process rejects nonzero missing-exit and signalled fake closures", options, async () => {
    const index = await syntheticIndex();
    for (const [code, signal] of [[1, null], [null, null], [0, "SIGTERM"]] as const) {
        const f = await fixture({ kind: "version" }, {}, index), { result } = await f.begin(); f.child.stdout.write(VERSION);
        await f.child.finish(code, signal); unavailable(await result, "UNAVAILABLE"); await f.worker.closed; f.noActions();
    }
});

test("F26a process consumes bounded private stderr without returning a raw diagnostic", options, async () => {
    const f = await fixture(), { result } = await f.begin(); f.child.stdout.write(VERSION); f.child.stderr.write(PRIVATE);
    await f.child.finish(); unavailable(await result, "UNAVAILABLE"); await f.worker.closed; f.noActions();
});

test("F26a process withholds stderr over8192 while preserving actual child ownership", options, async () => {
    const f = await fixture(), { result } = await f.begin(); f.child.stderr.write(Buffer.alloc(8193, 0x61));
    unavailable(await result, "STOP_UNCONFIRMED"); assert.equal(f.worker.busy, true); assert.equal(f.closed, false);
    await f.child.finish(); await f.worker.closed; assert.equal(f.worker.busy, false); f.noActions();
});

test("F26a process enforces each exact stdout cap independently", options, async () => {
    const index = await syntheticIndex();
    for (const [operation, cap] of [[{ kind: "version" }, 4096], [{ kind: "entries" }, 262144], [{ kind: "sizes", oids: [OBJECT] }, 12288],
        [{ kind: "batch", objects: [{ oid: OBJECT, size: 3 }, { oid: OTHER, size: 5 }] }, 8 + 96 * 2]] as const) {
        const f = await fixture(operation, {}, index), { result } = await f.begin(); f.child.stdout.write(Buffer.alloc(cap, 0x61));
        await f.child.finish(); const value = await result; assert.equal(value.status, "COMPLETE"); if (value.status === "COMPLETE") assert.equal(value.bytes.length, cap); f.noActions();
        const overflow = await fixture(operation, {}, index), pending = await overflow.begin(); overflow.child.stdout.write(Buffer.alloc(cap + 1, 0x61));
        unavailable(await pending.result, "STOP_UNCONFIRMED"); assert.equal(overflow.worker.busy, true); await overflow.child.finish(); await overflow.worker.closed; overflow.noActions();
    }
});

test("F26a process admits128 unique size IDs and the exact1MiB declared batch budget", options, async () => {
    const index = await syntheticIndex();
    for (const operation of [{ kind: "sizes", oids: Array.from({ length: 128 }, (_, at) => oid(at + 1)) },
        { kind: "batch", objects: Array.from({ length: 16 }, (_, at) => ({ oid: oid(at + 1), size: 65536 })) }]) {
        const f = await fixture(operation, {}, index), { result } = await f.begin(); await f.child.finish(); assert.equal((await result).status, "COMPLETE"); f.noActions();
    }
});

test("F26a process rejects unknown operations extra keys and route argv environment injection", options, async () => {
    const index = await syntheticIndex();
    for (const operation of [undefined, null, "version", [], {}, { kind: "commit" }, { kind: "version", args: [] }, { kind: "entries", root: PRIVATE },
        { kind: "entries", env: {} }, { kind: "sizes", oids: [OBJECT], executable: GIT }, { kind: "batch", objects: [{ oid: OBJECT, size: 1 }], script: PRIVATE }]) {
        const f = await fixture(operation, { operation }, index); unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 0); await f.worker.closed; f.noActions();
    }
});

test("F26a process rejects malformed duplicate empty oversized and option-looking OID arrays", options, async () => {
    const index = await syntheticIndex();
    for (const oids of [[], [OBJECT, OBJECT], [OBJECT.toUpperCase()], ["a".repeat(39)], ["a".repeat(64)], ["--batch"], ["HEAD:public.txt"],
        [PRIVATE], Array.from({ length: 129 }, (_, at) => oid(at + 1)), new Array(1), [OBJECT, 1]]) {
        const f = await fixture({ kind: "sizes", oids }, {}, index); unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 0); await f.worker.closed; f.noActions();
    }
});

test("F26a process rejects malformed batch size object and aggregate budgets before spawn", options, async () => {
    const index = await syntheticIndex();
    for (const objects of [[], [{ oid: OBJECT, size: -1 }], [{ oid: OBJECT, size: 1.5 }], [{ oid: OBJECT, size: Number.NaN }],
        [{ oid: OBJECT, size: Number.POSITIVE_INFINITY }], [{ oid: OBJECT, size: 65537 }], [{ oid: OBJECT, size: 1, path: PRIVATE }],
        [{ oid: OBJECT, size: 1 }, { oid: OBJECT, size: 1 }], [{ oid: OBJECT.toUpperCase(), size: 1 }],
        Array.from({ length: 17 }, (_, at) => ({ oid: oid(at + 1), size: 65536 })),
        Array.from({ length: 129 }, (_, at) => ({ oid: oid(at + 1), size: 0 }))]) {
        const f = await fixture({ kind: "batch", objects }, {}, index); unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 0); await f.worker.closed; f.noActions();
    }
});

test("F26a process never evaluates accessor operation array or object fields", options, async () => {
    const index = await syntheticIndex(); let reads = 0;
    const getter = () => { reads++; throw Error(PRIVATE); };
    const operation = Object.defineProperty({}, "kind", { enumerable: true, get: getter });
    const oids = Object.defineProperty([OBJECT], "0", { enumerable: true, get: getter });
    const object = Object.defineProperty({ size: 1 }, "oid", { enumerable: true, get: getter });
    for (const value of [operation, { kind: "sizes", oids }, { kind: "batch", objects: [object] }]) {
        const f = await fixture(value, {}, index); unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 0); await f.worker.closed;
    }
    assert.equal(reads, 0);
});

test("F26a process refuses checked-index lookalikes without invoking their available accessor", options, async () => {
    const index = await syntheticIndex(); let reads = 0;
    const accessor = Object.defineProperty({}, "available", { get() { reads++; throw Error(PRIVATE); } });
    for (const fake of [{ ...index }, accessor, index.metadata, undefined]) {
        const f = await fixture({ kind: "version" }, { index: fake as Index }, index);
        unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 0); await f.worker.closed; f.noActions();
    }
    assert.equal(reads, 0);
});

test("F26a process pre-start withdrawal is sticky and starts no child", options, async () => {
    const f = await fixture(); f.worker.withdraw(); unavailable(await f.start(), "UNAVAILABLE"); unavailable(await f.start(), "UNAVAILABLE");
    assert.equal(f.calls.length, 0); assert.equal(f.worker.busy, false); await f.worker.closed; f.noActions();
});

test("F26a active withdrawal clears private data and stays busy until close plus both EOFs", options, async () => {
    const f = await fixture(), { result } = await f.begin(); f.child.stdout.write(PRIVATE); f.worker.withdraw();
    unavailable(await result, "STOP_UNCONFIRMED"); assert.equal(f.worker.busy, true); assert.equal(f.closed, false);
    f.child.stdout.write(PRIVATE + "-late"); await f.child.close(); await f.child.eof("stdout"); assert.equal(f.worker.busy, true); assert.equal(f.closed, false);
    await f.child.eof("stderr"); await f.worker.closed; assert.equal(f.worker.busy, false);
    unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 1); f.noActions();
});

test("F26a process rejects expired nonfinite deadlines and unavailable guards before spawn", options, async () => {
    const index = await syntheticIndex();
    for (const overrides of [{ deadline: 1000 }, { deadline: 999 }, { deadline: Number.NaN }, { deadline: Number.POSITIVE_INFINITY },
        { valid: () => false }, { valid: () => { throw Error(PRIVATE); } }]) {
        const f = await fixture({ kind: "version" }, overrides, index); unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 0); await f.worker.closed; f.noActions();
    }
});

test("F26a elapsed deadline withdraws after fake admission with a held deterministic clock", options, async () => {
    let clock = 1000; const f = await fixture({ kind: "version" }, { now: () => clock }), { result } = await f.begin();
    assert.equal(f.worker.busy, true); assert.equal(f.settled, false); clock = 61001; f.child.stdout.write(PRIVATE);
    unavailable(await result, "STOP_UNCONFIRMED"); assert.equal(f.worker.busy, true); await f.child.finish(); await f.worker.closed; f.noActions();
});

test("F26a process never extends its60second bound to a later caller deadline", options, async () => {
    let clock = 1000; const f = await fixture({ kind: "version" }, { now: () => clock, deadline: 121000 }), { result } = await f.begin();
    clock = 61001; f.child.stdout.write(PRIVATE); unavailable(await result, "STOP_UNCONFIRMED");
    await f.child.finish(); await f.worker.closed; f.noActions();
});

test("F26a clock reversal or nonfinite values withhold apparently successful completion", options, async () => {
    const index = await syntheticIndex();
    for (const invalid of [999, Number.NaN, Number.POSITIVE_INFINITY]) {
        let clock = 1000; const f = await fixture({ kind: "version" }, { now: () => clock }, index), { result } = await f.begin();
        f.child.stdout.write(VERSION); clock = invalid; await f.child.finish(); unavailable(await result); await f.worker.closed; f.noActions();
    }
});

test("F26a valid guard withdrawal and later reenable cannot release buffered bytes", options, async () => {
    let valid = true; const f = await fixture({ kind: "version" }, { valid: () => valid }), { result } = await f.begin();
    f.child.stdout.write(PRIVATE); valid = false; f.child.stdout.write(Buffer.from("public")); unavailable(await result, "STOP_UNCONFIRMED");
    valid = true; await f.child.finish(); await f.worker.closed; unavailable(await f.start(), "UNAVAILABLE"); assert.equal(f.calls.length, 1); f.noActions();
});

test("F26a checked-index drift blocks admission and late drift withholds completion", options, async () => {
    const before = await fixture(); await writeFile(before.index.indexFile, Buffer.from(PRIVATE));
    unavailable(await before.start(), "UNAVAILABLE"); assert.equal(before.calls.length, 0); await before.worker.closed; before.noActions();
    const during = await fixture(), { result } = await during.begin(); during.child.stdout.write(VERSION);
    await writeFile(during.index.indexFile, Buffer.from(PRIVATE)); await during.child.finish(); unavailable(await result); await during.worker.closed; during.noActions();
});

test("F26a stdout stderr and stdin errors withhold without destroying owned pipes", options, async () => {
    const index = await syntheticIndex();
    for (const channel of ["stdout", "stderr", "stdin"] as const) {
        const f = await fixture({ kind: "batch", objects: [{ oid: OBJECT, size: 1 }] }, {}, index), { result } = await f.begin();
        f.child[channel].emit("error", Error(PRIVATE)); unavailable(await result, "STOP_UNCONFIRMED"); assert.equal(f.worker.busy, true);
        await f.child.finish(); await f.worker.closed; f.noActions();
    }
});

test("F26a spawn throws and a no-PID spawn error return unavailable without fabricated child closure", options, async () => {
    const throwing = await fixture({ kind: "version" }, { spawn: (() => { throw Error(PRIVATE); }) as typeof spawn });
    unavailable(await throwing.start(), "UNAVAILABLE"); assert.equal(throwing.worker.busy, false); await throwing.worker.closed; throwing.noActions();
    const missing = await fixture({ kind: "version" }, {}, undefined, new Child(undefined)), pending = missing.start(); await tick();
    missing.child.emit("error", Error(PRIVATE)); unavailable(await pending, "UNAVAILABLE"); await missing.worker.closed; assert.equal(missing.worker.busy, false); missing.noActions();
});

test("F26a an error after PID ownership retains busy until actual close and EOFs", options, async () => {
    const f = await fixture(), { result } = await f.begin(); f.child.emit("error", Error(PRIVATE));
    unavailable(await result, "STOP_UNCONFIRMED"); assert.equal(f.worker.busy, true); assert.equal(f.closed, false);
    await f.child.finish(); await f.worker.closed; assert.equal(f.worker.busy, false); f.noActions();
});
