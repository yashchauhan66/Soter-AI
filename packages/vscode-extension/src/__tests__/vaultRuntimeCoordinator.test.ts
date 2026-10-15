import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type * as vscode from "vscode";
import type { VaultAppDescriptor } from "../../../core/src/VaultAppDescriptor";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";
import type { VaultManager } from "../firewall/VaultManager";
import * as stub from "./phase2/vscode-stub";

// The real coordinator and real finite Node job execute only synthetic public
// app code. A mock vault supplies one synthetic private lease; it is not an
// oracle for the real VaultManager's key/source/policy guarantees.
const FAKE = "postgresql://synthetic-f09:coordinator-fake-only@f09.invalid/database";
const PLACEHOLDER = "[SOTERAI_PROTECTED_A3427B3646BA4D8482E5C5DFB5BA5DD1_0]";
const MASK = "[REDACTED_SECRET_OUTPUT]";
const SOURCE = `DATABASE_URL=${PLACEHOLDER}\nPORT=8080\n`;
const ENTRY = "exports.start = () => new Promise(resolve => setTimeout(() => { process.stdout.write('public-complete'); resolve(); }, 50));\n";
const COOPERATIVE = "exports.start = signal => new Promise(resolve => { let done = false; const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(); }; const timer = setTimeout(finish, 2000); signal.addEventListener('abort', finish, { once: true }); if (signal.aborted) finish(); });\n";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
type Snapshot = Readonly<{ id: string; state: string; pid?: number; exitCode?: number }>;
type Job = { snapshot(): Snapshot; requestStop(): void; readonly completion: Promise<{ snapshot: Snapshot; output: OutputResult }> };
type Runtime = { descriptors(): readonly VaultAppDescriptor[]; save(value: unknown): Promise<VaultAppDescriptor>;
    run(id: string): Promise<Job | undefined>; stop(jobId: string): void; jobs(): readonly Snapshot[]; dispose(): void };
type Factory = new (context: vscode.ExtensionContext, vault: VaultManager) => Runtime;
type Lease = { withRuntimeValues<T>(descriptor: VaultAppDescriptor, use: (values: Readonly<Record<string, string>>, guard: () => boolean) => T, enabled: () => boolean): Promise<T> };
function deferred() { let release!: () => void; const promise = new Promise<void>(done => { release = done; }); return { promise, release }; }
async function bounded<T>(work: PromiseLike<T>, ms = 6000): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([Promise.resolve(work), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Synthetic coordinator operation did not settle within its bound.")), ms); })]); }
    finally { if (timer) clearTimeout(timer); }
}
const tick = () => new Promise<void>(done => setImmediate(done));
async function implementation(): Promise<Factory> {
    const module = await import("../vault-runtime/VaultRuntime");
    assert.equal(typeof module.VaultRuntime, "function", "F09 must implement the frozen coordinator API."); return module.VaultRuntime;
}
let fixtureParent: string, fixtureDirectory: string, root: string, context: ReturnType<typeof stub.makeExtensionContext>;
let runtimes: Runtime[], jobs: Set<Job>, pending: Array<Promise<Job | undefined>>, calls: VaultAppDescriptor[];
let leaseHold: ReturnType<typeof deferred> | undefined, leaseApproved: boolean, leaseGuard: boolean, lease: Lease;
let configEvents: stub.EventEmitter<{ affectsConfiguration(section: string): boolean }>, rootEvents: stub.EventEmitter<unknown>;

function descriptor(index = 0, source = ENTRY): VaultAppDescriptor {
    return { schemaVersion: 1, id: `6c2988d0-5023-4c1a-9bd2-${String(index).padStart(12, "0")}`, root,
        program: join(root, "app.cjs"), cwd: root, source: join(root, ".env"), programDigest: sha(source), args: ["literal public argument"],
        selections: [{ name: "DATABASE_URL", placeholder: PLACEHOLDER }] };
}
async function coordinator(): Promise<Runtime> {
    const Factory = await implementation(), runtime = new Factory(context as unknown as vscode.ExtensionContext, lease as unknown as VaultManager);
    runtimes.push(runtime); return runtime;
}
function run(runtime: Runtime, id: string): Promise<Job | undefined> {
    const work = runtime.run(id).then(job => { if (job) jobs.add(job); return job; }); pending.push(work); return work;
}
function safe(value: unknown): void {
    const text = JSON.stringify(value) ?? "";
    for (const privateValue of [FAKE, sha(FAKE), Buffer.from(FAKE).toString("base64"), encodeURIComponent(FAKE)]) assert.ok(!text.includes(privateValue));
    assert.doesNotMatch(text, /"(?:env|values|rawValue|replacementText)"\s*:/);
}
function stateSafe(runtime: Runtime): void {
    safe(runtime.descriptors()); safe(runtime.jobs()); safe([...context._inspect.workspaceStore]); safe([...context._inspect.globalStore]);
    for (const snapshot of runtime.jobs()) assert.ok(Object.keys(snapshot).every(key => ["id", "state", "pid", "exitCode"].includes(key)));
    for (const sink of stub.sinks) assert.ok(!sink.text.includes(FAKE));
}
function withdraw(): void {
    stub.state.config.set("soterai.lite.vaultRuntime", false);
    stub.state.configInspect.set("soterai.lite.vaultRuntime", { globalValue: false, defaultValue: true });
    configEvents.fire({ affectsConfiguration: section => section === "soterai" || section === "soterai.lite.vaultRuntime" });
}
function rewriteDescriptor(value: unknown, id: string): unknown {
    if (Array.isArray(value)) return value.map(item => rewriteDescriptor(item, id));
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (record.id === id && "programDigest" in record) return { ...record, env: { DATABASE_URL: "UNREVIEWED_PUBLIC_FIELD" } };
        return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, rewriteDescriptor(item, id)]));
    }
    return value;
}

beforeEach(async () => {
    const base = process.platform === "win32" ? "D:\\SoterAI-Lite-test-profiles" : tmpdir();
    await mkdir(base, { recursive: true }); fixtureParent = await realpath(base);
    fixtureDirectory = await mkdtemp(join(fixtureParent, "f09-coordinator-")); root = join(fixtureDirectory, "project");
    await mkdir(root); await writeFile(join(root, "app.cjs"), ENTRY); await writeFile(join(root, ".env"), SOURCE);
    stub.resetState(root); context = stub.makeExtensionContext(fixtureDirectory);
    runtimes = []; jobs = new Set(); pending = []; calls = []; leaseHold = undefined; leaseApproved = true; leaseGuard = true;
    configEvents = new stub.EventEmitter(); rootEvents = new stub.EventEmitter();
    mock.method(stub.workspace, "onDidChangeConfiguration", configEvents.event);
    mock.method(stub.workspace, "onDidChangeWorkspaceFolders", rootEvents.event);
    lease = { async withRuntimeValues(descriptor, use, enabled) {
        calls.push(descriptor); await leaseHold?.promise;
        if (!leaseApproved || !leaseGuard || !enabled()) throw new Error("Synthetic private lease withheld.");
        return use(Object.freeze({ DATABASE_URL: FAKE }), () => leaseGuard && enabled());
    } };
});
afterEach(async () => {
    leaseGuard = false; for (const runtime of runtimes) runtime.dispose(); leaseHold?.release();
    try {
        await bounded(Promise.allSettled(pending));
        await bounded(Promise.all([...jobs].map(job => job.completion)));
        for (const subscription of context.subscriptions) subscription.dispose();
        const owned = resolve(fixtureDirectory);
        assert.equal(dirname(owned), fixtureParent); assert.ok(basename(owned).startsWith("f09-coordinator-"));
        await rm(owned, { recursive: true });
    } finally { configEvents.dispose(); rootEvents.dispose(); mock.restoreAll(); stub.resetState(); }
});

test("F09-C01 save persists only strict public metadata and leaves placeholder source/app bytes unchanged", async () => {
    const runtime = await coordinator(), value = descriptor();
    const saved = await runtime.save(value); assert.ok(Object.isFrozen(saved)); assert.deepEqual(saved, value);
    assert.deepEqual(runtime.descriptors(), [saved]); stateSafe(runtime);
    assert.ok([...context._inspect.workspaceStore.values()].some(item => JSON.stringify(item).includes(value.id)));
    assert.equal(await readFile(join(root, ".env"), "utf8"), SOURCE); assert.equal(await readFile(join(root, "app.cjs"), "utf8"), ENTRY);
    assert.equal(calls.length, 0); assert.equal(context._inspect.secretStore.size, 0);
});

test("F09-C02 invalid or falsely digested metadata is never acknowledged or persisted", async () => {
    const runtime = await coordinator();
    for (const value of [{ ...descriptor(), env: { DATABASE_URL: FAKE } }, { ...descriptor(), programDigest: "b".repeat(64) },
        { ...descriptor(), program: join(fixtureDirectory, "outside.cjs") }]) {
        await assert.rejects(() => runtime.save(value), error => { assert.ok(!String(error).includes(FAKE)); return true; });
        assert.deepEqual(runtime.descriptors(), []);
    }
    assert.equal(calls.length, 0); stateSafe(runtime);
});

test("F09-C03 sixteen saved descriptors fit; a seventeenth cannot discard accepted allowlist entries", async () => {
    const runtime = await coordinator(); for (let index = 0; index < 16; index++) await runtime.save(descriptor(index));
    const before = runtime.descriptors(); assert.equal(before.length, 16);
    await assert.rejects(() => runtime.save(descriptor(16))); assert.deepEqual(runtime.descriptors(), before); stateSafe(runtime);
});

test("F09-C04 a persistence failure cannot acknowledge an unsaved descriptor or leak an exception", async () => {
    const runtime = await coordinator();
    mock.method(context.workspaceState, "update", async () => { throw new Error(FAKE); });
    mock.method(context.globalState, "update", async () => { throw new Error(FAKE); });
    await assert.rejects(() => runtime.save(descriptor()), error => { assert.ok(!String(error).includes(FAKE)); return true; });
    assert.deepEqual(runtime.descriptors(), []); stateSafe(runtime);
});

test("F09-C05 each descriptor read reparses persisted data rather than trusting an earlier cached object", async () => {
    const runtime = await coordinator(), value = await runtime.save(descriptor());
    let changed = false;
    for (const [key, stored] of context._inspect.workspaceStore) {
        if (JSON.stringify(stored).includes(value.id)) { context._inspect.workspaceStore.set(key, rewriteDescriptor(stored, value.id)); changed = true; }
    }
    assert.ok(changed); assert.ok(!runtime.descriptors().some(item => item.id === value.id));
    assert.equal(await bounded(run(runtime, value.id)), undefined); assert.equal(calls.length, 0);
});

test("F09-C06 changing the allowed app blocks run until its new public digest is explicitly saved", async () => {
    const runtime = await coordinator(), value = await runtime.save(descriptor()), changed = ENTRY + "// public owner revision\n";
    await writeFile(join(root, "app.cjs"), changed);
    assert.equal(await bounded(run(runtime, value.id)), undefined); assert.equal(calls.length, 0);
    const reviewed = await runtime.save({ ...value, programDigest: sha(changed) });
    const job = await bounded(run(runtime, reviewed.id)); assert.ok(job);
    const completed = await bounded(job.completion); assert.equal(completed.output.status, "COMPLETE");
    assert.equal(completed.output.stdout, "public-complete"); stateSafe(runtime);
});

test("F09-C07 unknown descriptor IDs, lost trust and withdrawn runtime settings never reach the private lease", async () => {
    const runtime = await coordinator(), value = await runtime.save(descriptor());
    assert.equal(await bounded(run(runtime, "unregistered-id")), undefined);
    stub.state.isTrusted = false; assert.equal(await bounded(run(runtime, value.id)), undefined); stub.state.isTrusted = true;
    withdraw(); assert.equal(await bounded(run(runtime, value.id)), undefined); assert.equal(calls.length, 0); stateSafe(runtime);
});

for (const kind of ["configuration", "workspace", "dispose"] as const) {
    test(`F09-C08 ${kind} withdrawal revokes held approval before any child job is released`, async () => {
        const runtime = await coordinator(), value = await runtime.save(descriptor()); leaseHold = deferred();
        const work = run(runtime, value.id); await tick(); assert.equal(calls.length, 1);
        if (kind === "configuration") withdraw();
        else if (kind === "workspace") { stub.state.folders = []; rootEvents.fire({}); }
        else runtime.dispose();
        leaseHold.release(); assert.equal(await bounded(work), undefined); assert.equal(jobs.size, 0); stateSafe(runtime);
    });
}

test("F09-C09 the four-job admission limit includes pending approvals rather than queuing unlimited private requests", async () => {
    const runtime = await coordinator(), value = await runtime.save(descriptor()); leaseHold = deferred();
    const held = Array.from({ length: 4 }, () => run(runtime, value.id)); await tick(); assert.equal(calls.length, 4);
    assert.equal(await bounded(run(runtime, value.id), 1000), undefined); assert.equal(calls.length, 4);
    runtime.dispose(); leaseHold.release(); assert.deepEqual(await bounded(Promise.all(held)), [undefined, undefined, undefined, undefined]);
    assert.equal(jobs.size, 0); stateSafe(runtime);
});

test("F09-C10 four owned active children fit and stop cooperatively; a fifth cannot start", async () => {
    await writeFile(join(root, "app.cjs"), COOPERATIVE); const runtime = await coordinator();
    const active: Job[] = [];
    for (let index = 0; index < 4; index++) {
        const value = await runtime.save(descriptor(index, COOPERATIVE)), job = await bounded(run(runtime, value.id));
        assert.ok(job); active.push(job);
    }
    assert.equal(new Set(active.map(job => job.snapshot().id)).size, 4);
    assert.equal(await bounded(run(runtime, descriptor(0, COOPERATIVE).id), 1000), undefined); assert.equal(calls.length, 4);
    for (const job of active) runtime.stop(job.snapshot().id);
    const completed = await bounded(Promise.all(active.map(job => job.completion)));
    for (const result of completed) { assert.equal(result.output.status, "WITHHELD"); assert.equal(result.snapshot.state, "STOPPED"); }
    stateSafe(runtime);
});

test("F09-C11 real app values pass only through the private lease and completed F08 output", async () => {
    const entry = "exports.start = () => { process.stdout.write(process.env.DATABASE_URL || 'missing'); process.stderr.write('ordinary warning'); };\n";
    await writeFile(join(root, "app.cjs"), entry); const runtime = await coordinator(), value = await runtime.save(descriptor(0, entry));
    const job = await bounded(run(runtime, value.id)); assert.ok(job); safe(job); stateSafe(runtime);
    const result = await bounded(job.completion); assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.redacted, true);
    assert.equal(result.output.stdout, MASK); assert.equal(result.output.stderr, MASK); safe(result);
    assert.equal(await readFile(join(root, ".env"), "utf8"), SOURCE); stateSafe(runtime);
});

test("F09-C12 guard withdrawal after launch stops the owned app and withholds all pending output", async () => {
    await writeFile(join(root, "app.cjs"), COOPERATIVE); const runtime = await coordinator(), value = await runtime.save(descriptor(0, COOPERATIVE));
    const job = await bounded(run(runtime, value.id)); assert.ok(job); leaseGuard = false;
    const result = await bounded(job.completion); assert.equal(result.output.status, "WITHHELD"); assert.equal(result.output.stdout, "");
    assert.equal(result.output.stderr, ""); assert.equal(result.snapshot.state, "STOPPED"); stateSafe(runtime);
});

test("F09-C13 feature withdrawal requests cooperative stop and prevents later launches", async () => {
    await writeFile(join(root, "app.cjs"), COOPERATIVE); const runtime = await coordinator(), value = await runtime.save(descriptor(0, COOPERATIVE));
    const job = await bounded(run(runtime, value.id)); assert.ok(job); withdraw();
    const result = await bounded(job.completion); assert.equal(result.output.status, "WITHHELD"); assert.equal(result.snapshot.state, "STOPPED");
    assert.equal(await bounded(run(runtime, value.id)), undefined); stateSafe(runtime);
});

test("F09-C14 rejected private approval produces no job, retained raw state or swallowed admission slot", async () => {
    const runtime = await coordinator(), value = await runtime.save(descriptor()); leaseApproved = false;
    for (let index = 0; index < 5; index++) assert.equal(await bounded(run(runtime, value.id)), undefined);
    assert.equal(calls.length, 5); assert.equal(jobs.size, 0); leaseApproved = true;
    const job = await bounded(run(runtime, value.id)); assert.ok(job); assert.equal((await bounded(job.completion)).output.status, "COMPLETE"); stateSafe(runtime);
});

test("F09-C15 restarting reports prior ownership as UNVERIFIED without adopting or stopping the live child", async () => {
    await writeFile(join(root, "app.cjs"), COOPERATIVE); const original = await coordinator(), value = await original.save(descriptor(0, COOPERATIVE));
    const job = await bounded(run(original, value.id)); assert.ok(job); const id = job.snapshot().id;
    const restarted = await coordinator(), prior = restarted.jobs().find(snapshot => snapshot.id === id);
    assert.ok(prior); assert.equal(prior.state, "UNVERIFIED"); stateSafe(restarted);
    restarted.stop(id); restarted.dispose(); await tick(); assert.equal(job.snapshot().state, "RUNNING");
    original.stop(id); const result = await bounded(job.completion); assert.equal(result.snapshot.state, "STOPPED"); stateSafe(original);
});

test("F09-C16 stop of an unrelated identifier cannot affect the owned live job", async () => {
    await writeFile(join(root, "app.cjs"), COOPERATIVE); const runtime = await coordinator(), value = await runtime.save(descriptor(0, COOPERATIVE));
    const job = await bounded(run(runtime, value.id)); assert.ok(job);
    runtime.stop("unrelated-id"); runtime.stop(String(process.pid)); await tick(); assert.equal(job.snapshot().state, "RUNNING");
    runtime.stop(job.snapshot().id); const result = await bounded(job.completion); assert.equal(result.snapshot.state, "STOPPED"); stateSafe(runtime);
});
