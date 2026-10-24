import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess, spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, appendFile } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { StreamingOutputRedactor, type OutputResult } from "../../../core/src/StreamingOutputRedactor";

// Frozen design06 regressions. All repositories and data are synthetic and
// retained. This file never reads the real workspace Git configuration/history.
const GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
const PS = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const ID = "adab60fa-bccf-4ac1-9508-ce7cc19b63c9";
const PRIVATE = "synthetic-f10-git-private-Qx9/z";
const PREFIX = "Staged changes only; unstaged and untracked files are not inspected.\n";
const CONFIG = "[core]\n\trepositoryformatversion = 0\n\tbare = false\n\tfilemode = false\n\tlogallrefupdates = true\n";
type Descriptor = Readonly<{ executable: string; job: string; environment: NodeJS.ProcessEnv; available(): boolean }>;
type Module = { CHECKED_GIT_EXECUTABLE: string; supportsCheckedGitVersion(text: unknown): boolean;
    prepareCheckedGitMetadata(root: string, environment: NodeJS.ProcessEnv, enabled: () => boolean): Promise<Descriptor | undefined> };
type Snapshot = Readonly<{ id: string; state: string; pid?: number; exitCode?: number }>;
type Completion = { snapshot: Snapshot; output: OutputResult };
type Worker = { start(): Promise<Snapshot>; snapshot(): Snapshot; cancel(): void; dispose(): void; readonly completion: Promise<Completion> };
type Timer = { callback: () => void; ms: number; active: boolean };
type Options = { id: string; executable: string; root: string; operation: unknown; parentEnvironment: NodeJS.ProcessEnv;
    output: StreamingOutputRedactor; enabled?: () => boolean; git?: Descriptor };
type Constructor = new (options: Options, deps?: { spawn?: typeof spawn; setTimer?: (callback: () => void, ms: number) => unknown;
    clearTimer?: (handle: unknown) => void }) => Worker;
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
async function implementation(): Promise<Module> {
    const value = await import("../terminal/CheckedGitMetadata") as Module;
    assert.equal(typeof value.prepareCheckedGitMetadata, "function"); assert.equal(typeof value.supportsCheckedGitVersion, "function"); return value;
}
async function workerClass(): Promise<Constructor> {
    return (await import("../terminal/PowerShell51Worker")).PowerShell51Worker as unknown as Constructor;
}
async function repository(config = CONFIG): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "soter-f10-git-meta-"));
    await mkdir(join(root, ".git", "objects", "info"), { recursive: true });
    await mkdir(join(root, ".git", "objects", "pack"), { recursive: true });
    await mkdir(join(root, ".git", "refs", "heads"), { recursive: true });
    await writeFile(join(root, ".git", "config"), config, { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" }); return root;
}
const parent = (): NodeJS.ProcessEnv => ({ SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC,
    ProgramFiles: "Z:\\untrusted-program-files", PATH: PRIVATE, HOME: PRIVATE, USERPROFILE: PRIVATE, TEMP: tmpdir(), TMP: tmpdir(),
    OPENAI_API_KEY: PRIVATE, GIT_CONFIG: PRIVATE, GIT_CONFIG_SYSTEM: PRIVATE, GIT_CONFIG_GLOBAL: PRIVATE, GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.fsmonitor", GIT_CONFIG_VALUE_0: PRIVATE, GIT_DIR: PRIVATE, GIT_WORK_TREE: PRIVATE,
    GIT_INDEX_FILE: PRIVATE, GIT_OBJECT_DIRECTORY: PRIVATE, GIT_ALTERNATE_OBJECT_DIRECTORIES: PRIVATE,
    GIT_EXTERNAL_DIFF: PRIVATE, GIT_SSH_COMMAND: PRIVATE, SSH_ASKPASS: PRIVATE, HTTP_PROXY: PRIVATE, NODE_OPTIONS: PRIVATE, PSModulePath: PRIVATE });
async function prepared(root: string | undefined = undefined, enabled = () => true) {
    root ??= await repository();
    const m = await implementation(), descriptor = await m.prepareCheckedGitMetadata(root, parent(), enabled);
    assert.ok(descriptor, "Ordinary synthetic in-root repository must support staged metadata."); return { root, descriptor, m };
}
function withheld(value: Completion): void {
    assert.equal(value.output.status, "WITHHELD"); assert.equal(value.output.stdout, ""); assert.equal(value.output.stderr, "");
    assert.ok(!JSON.stringify(value).includes(PRIVATE));
}
class Child extends EventEmitter {
    readonly stdin = new PassThrough(); readonly stdout = new PassThrough(); readonly stderr = new PassThrough();
    readonly input: Buffer[] = []; readonly pid = 43219; killCalls = 0;
    constructor() { super(); this.stdin.on("data", bytes => this.input.push(Buffer.from(bytes))); }
    kill(): never { this.killCalls++; throw new Error("Process termination is not authorized."); }
    async close(code = 0): Promise<void> { this.stdout.end(); this.stderr.end(); await tick(); this.emit("close", code, null); await tick(); }
}
async function fixture(options: Partial<Options> = {}) {
    const p = await prepared(), child = new Child(), timers: Timer[] = [], calls: { file: string; args: readonly string[]; options: any }[] = [];
    const fakeSpawn = ((file: string, args: readonly string[], settings: any) => {
        calls.push({ file, args, options: settings }); queueMicrotask(() => child.emit("spawn")); return child as unknown as ChildProcess;
    }) as typeof spawn;
    const Factory = await workerClass(), worker = new Factory({ id: ID, executable: PS, root: p.root, operation: { kind: "GIT", action: "status" },
        parentEnvironment: parent(), output: new StreamingOutputRedactor([PRIVATE]), git: p.descriptor, ...options }, {
        spawn: fakeSpawn, setTimer(callback, ms) { const timer = { callback, ms, active: true }; timers.push(timer); return timer; },
        clearTimer(handle) { (handle as Timer).active = false; },
    });
    let settled = false; void worker.completion.then(() => { settled = true; });
    return { ...p, child, calls, timers, worker, get settled() { return settled; },
        fire(ms: number) { for (const timer of [...timers]) if (timer.ms === ms && timer.active) { timer.active = false; timer.callback(); } },
        async running() { assert.equal((await worker.start()).state, "RUNNING"); assert.equal(calls.length, 1); },
        async finish(code = 0) { await child.close(code); assert.equal(child.killCalls, 0); return worker.completion; } };
}

test("F10-G01 only the reviewed exact installed Git version is accepted", async () => {
    const m = await implementation(); assert.equal(m.CHECKED_GIT_EXECUTABLE, GIT);
    for (const value of ["git version 2.53.0.windows.1", "git version 2.53.0.windows.1\n", "git version 2.53.0.windows.1\r\n"]) assert.equal(m.supportsCheckedGitVersion(value), true);
    for (const value of [undefined, {}, "2.53.0", "git version 2.35.1.windows.1", "git version 2.54.0.windows.1", "git version 2.53.0.windows.2", "git version 2.53.0.windows.1\nextra", " git version 2.53.0.windows.1", "git version 2.53.0.windows.1 " ]) assert.equal(m.supportsCheckedGitVersion(value), false);
});
test("F10-G02 ordinary unborn repository gets an immutable pinned descriptor and retained empty config/hooks", async () => {
    const { root, descriptor: d } = await prepared(); assert.equal(d.executable, GIT); assert.ok(isAbsolute(d.job)); assert.notEqual(d.job, root);
    assert.ok(Object.isFrozen(d)); assert.ok(Object.isFrozen(d.environment)); assert.equal(d.available(), true);
    assert.equal(await readFile(join(d.job, "empty.gitconfig"), "utf8"), "");
    assert.equal(await readFile(d.environment.GIT_CONFIG_GLOBAL!, "utf8"), "");
    assert.ok(!JSON.stringify(d).includes(PRIVATE)); assert.ok(!JSON.stringify(d).includes("repositoryformatversion"));
});
test("F10-G03 inherited Git/config/credential/proxy/loader/search settings cannot reach the finite Git environment", async () => {
    const { descriptor: d } = await prepared(), e = d.environment;
    assert.ok(!Object.values(e).includes(PRIVATE));
    for (const key of ["PATH", "OPENAI_API_KEY", "GIT_CONFIG", "GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_EXTERNAL_DIFF", "GIT_SSH_COMMAND", "SSH_ASKPASS", "HTTP_PROXY", "NODE_OPTIONS", "PSModulePath"]) assert.equal(e[key], undefined, key);
    for (const [key, value] of Object.entries({ GIT_CONFIG_NOSYSTEM: "1", GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", GIT_PROTOCOL_FROM_USER: "0", GIT_ATTR_NOSYSTEM: "1" })) assert.equal(e[key], value, key);
    for (const key of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "TEMP", "TMP"]) assert.equal(e[key], d.job, key);
    assert.equal(e.GIT_CONFIG_SYSTEM, join(d.job, "empty.gitconfig"));
});
test("F10-G04 ambient executable-location overrides cannot replace the pinned standard Git", async () => {
    const { descriptor: d } = await prepared(); assert.equal(d.executable, GIT); assert.ok(!JSON.stringify(d).includes("untrusted-program-files"));
});
test("F10-G05 flag withdrawal is sticky even after reenable", async () => {
    let enabled = true; const { descriptor: d } = await prepared(undefined, () => enabled); assert.equal(d.available(), true);
    enabled = false; assert.equal(d.available(), false); enabled = true; assert.equal(d.available(), false);
});
test("F10-G06 thrown live guard withholds permanently without disclosing exception data", async () => {
    let broken = false; const { descriptor: d } = await prepared(undefined, () => { if (broken) throw new Error(PRIVATE); return true; });
    broken = true; assert.equal(d.available(), false); broken = false; assert.equal(d.available(), false); assert.ok(!JSON.stringify(d).includes(PRIVATE));
});
test("F10-G07 local config drift invalidates captured metadata and cannot recover by restoring bytes", async () => {
    const { root, descriptor: d } = await prepared(); await appendFile(join(root, ".git", "config"), "[core]\n\tfsmonitor = untrusted\n");
    assert.equal(d.available(), false); await writeFile(join(root, ".git", "config"), CONFIG); assert.equal(d.available(), false);
});
test("F10-G08 HEAD drift invalidates the captured repository", async () => {
    const { root, descriptor: d } = await prepared(); await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/another\n"); assert.equal(d.available(), false);
});
test("F10-G09 false admission guard produces no descriptor", async () => {
    const m = await implementation(), root = await repository(); assert.equal(await m.prepareCheckedGitMetadata(root, parent(), () => false), undefined);
});
test("F10-G10 relative roots and malformed metadata refuse without repository Git execution", async () => {
    const m = await implementation(); assert.equal(await m.prepareCheckedGitMetadata("relative", parent(), () => true), undefined);
    const root = await repository(); await writeFile(join(root, ".git", "HEAD"), "ref: ../outside\n"); assert.equal(await m.prepareCheckedGitMetadata(root, parent(), () => true), undefined);
});
for (const [label, extra] of [
    ["include", "[include]\n\tpath = ../must-not-read\n"], ["conditional include", "[includeIf \"gitdir:**\"]\n\tpath = ../must-not-read\n"],
    ["partial clone", "[extensions]\n\tpartialClone = origin\n"], ["promisor remote", "[remote \"origin\"]\n\tpromisor = true\n"],
    ["partial clone filter", "[remote \"origin\"]\n\tpartialclonefilter = blob:none\n"], ["external worktree", "[core]\n\tworktree = ../outside\n"],
    ["bare repository", "[core]\n\tbare = true\n"], ["unknown extension", "[extensions]\n\tobjectFormat = sha256\n"],
    ["configuration continuation", "[core]\n\tbare = fal\\\nse\n"], ["unknown execution affecting key", "[core]\n\tgitProxy = untrusted\n"],
] as const) test(`F10-G11 ${label} config is unavailable before spawn`, async () => {
    const m = await implementation(), root = await repository(CONFIG + extra); assert.equal(await m.prepareCheckedGitMetadata(root, parent(), () => true), undefined);
});
for (const name of ["commondir", "config.worktree", "objects/info/alternates", "objects/info/http-alternates", "objects/pack/pack-synthetic.promisor", "info/grafts", "sharedindex.synthetic", "shallow"] as const) {
    test(`F10-G12 unsupported ${name} repository metadata refuses`, async () => {
        const m = await implementation(), root = await repository(), target = join(root, ".git", name); await mkdir(resolve(target, ".."), { recursive: true });
        await writeFile(target, "synthetic-indirection\n", { flag: "wx" }); assert.equal(await m.prepareCheckedGitMetadata(root, parent(), () => true), undefined);
    });
}
test("F10-G13 gitfile and linked-worktree pointer are never followed", async () => {
    const m = await implementation(), root = await mkdtemp(join(tmpdir(), "soter-f10-gitfile-")); await writeFile(join(root, ".git"), "gitdir: ../outside\n", { flag: "wx" });
    assert.equal(await m.prepareCheckedGitMetadata(root, parent(), () => true), undefined);
});
test("F10-G14 invalid UTF8 and over-bound local config remain unavailable", async () => {
    const m = await implementation(); for (const content of [Buffer.from([0xff, 0xfe, 0x00]), Buffer.alloc(65537, 0x20)]) {
        const root = await repository(); await writeFile(join(root, ".git", "config"), content); assert.equal(await m.prepareCheckedGitMetadata(root, parent(), () => true), undefined);
    }
});
test("F10-G15 alternates introduced after preparation revoke the descriptor", async () => {
    const { root, descriptor: d } = await prepared(); await writeFile(join(root, ".git", "objects", "info", "alternates"), "../outside\n", { flag: "wx" }); assert.equal(d.available(), false);
});
test("F10-G16 GIT request without the prepared private descriptor is BLOCKED before spawn", async () => {
    const f = await fixture({ git: undefined }); assert.equal((await f.worker.start()).state, "BLOCKED"); assert.equal(f.calls.length, 0); withheld(await f.worker.completion);
});
test("F10-G17 structurally forged descriptor cannot authorize GIT", async () => {
    const f = await fixture({ git: Object.freeze({ executable: GIT, job: tmpdir(), environment: Object.freeze({}), available: () => true }) });
    assert.equal((await f.worker.start()).state, "BLOCKED"); assert.equal(f.calls.length, 0); withheld(await f.worker.completion);
});
test("F10-G18 extra fields/arbitrary Git operation requests refuse before spawn", async () => {
    for (const operation of [{ kind: "GIT", action: "log" }, { kind: "GIT", action: "status", args: ["--porcelain"] }, { kind: "GIT", action: "diff-stat", executable: "git" }, { kind: "GIT", action: "status", env: { PRIVATE } }]) {
        const f = await fixture({ operation }); assert.equal((await f.worker.start()).state, "BLOCKED"); assert.equal(f.calls.length, 0); withheld(await f.worker.completion);
    }
});
test("F10-G19 accessor Git operations are refused without evaluating accessors", async () => {
    let reads = 0; const operation = { kind: "GIT", get action() { reads++; return "status"; } }, f = await fixture({ operation });
    assert.equal((await f.worker.start()).state, "BLOCKED"); assert.equal(reads, 0); assert.equal(f.calls.length, 0); withheld(await f.worker.completion);
});
test("F10-G20 prepared GIT uses fixed encoded PowerShell and private data protocol rather than a caller script", async () => {
    const f = await fixture(); await f.running(); const call = f.calls[0], request = JSON.parse(Buffer.concat(f.child.input).toString("utf8"));
    assert.equal(call.file, PS); assert.deepEqual(call.args.slice(0, 4), ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand"]);
    assert.equal(call.options.shell, false); assert.equal(call.options.windowsHide, true); assert.equal(call.options.timeout, undefined); assert.equal(call.options.killSignal, undefined);
    assert.deepEqual(request.operation, { kind: "GIT", action: "status" }); assert.ok(!JSON.stringify(request).includes(PRIVATE));
    const script = Buffer.from(call.args[4], "base64").toString("utf16le"); assert.ok(!script.includes(f.root));
    assert.ok(!Object.values(call.options.env).includes(PRIVATE)); await f.finish();
});
test("F10-G21 staged output goes through final masking after actual pipe drain and close", async () => {
    const f = await fixture(); await f.running(); f.child.stdout.write(PREFIX + "A\t" + PRIVATE + ".txt\n"); await tick(); assert.equal(f.settled, false);
    const value = await f.finish(); assert.equal(value.output.status, "COMPLETE"); assert.ok(value.output.stdout.includes("[REDACTED_SECRET_OUTPUT]")); assert.ok(!JSON.stringify(value).includes(PRIVATE));
});
test("F10-G22 failed Git/PowerShell invocation withholds its diagnostic bytes and staged label", async () => {
    const f = await fixture(); await f.running(); f.child.stdout.write(PREFIX + "A\tpublic.txt\n"); f.child.stderr.write(PRIVATE); withheld(await f.finish(1));
});
test("F10-G23 metadata drift between worker construction and start blocks spawning", async () => {
    const f = await fixture(); await appendFile(join(f.root, ".git", "config"), "[core]\n\tbare = true\n");
    assert.equal((await f.worker.start()).state, "BLOCKED"); assert.equal(f.calls.length, 0); withheld(await f.worker.completion);
});
test("F10-G24 cancellation of a live Git worker keeps actual-close ownership without terminating it", async () => {
    const f = await fixture(); await f.running(); f.child.stdout.write(PREFIX + "A\tpublic.txt\n"); f.worker.cancel(); assert.equal(f.worker.snapshot().state, "CANCEL_PENDING");
    f.fire(1000); assert.equal(f.worker.snapshot().state, "STOP_UNCONFIRMED"); assert.equal(f.settled, false); assert.equal(f.child.killCalls, 0); withheld(await f.finish());
});
test("F10-G25 late repository drift withholds public buffered metadata", async () => {
    const f = await fixture(); await f.running(); f.child.stdout.write(PREFIX + "A\tpublic.txt\n"); await writeFile(join(f.root, ".git", "HEAD"), "ref: refs/heads/drifted\n"); withheld(await f.finish());
});
