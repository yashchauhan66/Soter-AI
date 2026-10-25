import "./phase2/register.mjs";
import assert from "node:assert/strict";
import childProcess, { type ChildProcess, type spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type * as vscode from "vscode";
import type { VaultAppDescriptor } from "../../../core/src/VaultAppDescriptor";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";
import { GatewayRegistryLease } from "../broker/GatewayRegistryLease";
import type { VaultManager } from "../firewall/VaultManager";
import { runtimeBinding } from "../vault-runtime/RuntimeBinding";
import * as stub from "./phase2/vscode-stub";

// Real coordinator, job, canonical file binding and registry-lease code.
// Only child spawn is mocked. Files are retained synthetic fixtures; no app
// code is executed and no normal profile, vault, credential or network is used.
const SELECTED = "TEST_ONLY_F25_RUNTIME_SELECTED_106bf483";
const OTHER = "TEST_ONLY_F25_RUNTIME_OTHER_WINDOW_VALUE_57cbd018";
const ERROR = "TEST_ONLY_F25_RUNTIME_REGISTRY_ERROR_281ed0a7";
const PLACEHOLDER = "[SOTERAI_PROTECTED_0123456789ABCDEF0123456789ABCDEF_0]";
const SOURCE = "SELECTED_VALUE=" + PLACEHOLDER + "\nPORT=8080\n";
const ENTRY = "exports.start = () => {};\n";
const PUBLIC = "Public F25 coordinator stdout\n", WARNING = "Public F25 coordinator stderr\n";
const MASK = "[REDACTED_SECRET_OUTPUT]";
const ID = "076cd1af-b95d-4974-a3ce-d20000250401";
type Snapshot = Readonly<{ id: string; state: string; pid?: number; exitCode?: number }>;
type Completion = Readonly<{ snapshot: Snapshot; output: OutputResult }>;
type Job = { readonly completion: Promise<Completion>; snapshot(): Snapshot; canRelease(output: OutputResult): boolean; dispose(): void };
type Runtime = { save(value: unknown): Promise<VaultAppDescriptor>; run(id: string): Promise<Job | undefined>;
    jobs(): readonly Snapshot[]; dispose(): void; shutdown(): Promise<void> };
type Factory = new (context: vscode.ExtensionContext, vault: VaultManager) => Runtime;
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
async function flush(): Promise<void> { for (let index = 0; index < 32; index++) await Promise.resolve(); }
class Pipe extends EventEmitter {
    ended = false;
    write(value: string): void { this.emit("data", Buffer.from(value, "utf8")); }
    end(): void { if (this.ended) return; this.ended = true; this.emit("end"); this.emit("close"); }
}
class Child extends EventEmitter {
    readonly stdout = new Pipe(); readonly stderr = new Pipe(); readonly stdin = null;
    readonly pid = 46425; readonly channel = { unref(): void {} }; readonly sent: unknown[] = [];
    connected = true; closed = false; killCalls = 0;
    send(message: unknown, ...tail: unknown[]): boolean {
        this.sent.push(message); const callback = tail.find(value => typeof value === "function") as ((error: null) => void) | undefined;
        callback?.(null); return true;
    }
    kill(): never { this.killCalls++; throw Error("No actual child termination is allowed in this fixture."); }
    finish(code = 17): void {
        if (this.closed) return; this.closed = true;
        this.stdout.end(); this.stderr.end(); this.emit("exit", code, null); this.emit("close", code, null);
    }
}
class CountedLease extends GatewayRegistryLease {
    disposals = 0;
    constructor(values: readonly string[], guard: () => boolean, private readonly afterConsume: () => void) { super(values, guard); }
    override dispose(): void { this.disposals++; super.dispose(); }
    override use<T>(consume: (values: readonly string[]) => Promise<T>): Promise<T> {
        return super.use(async values => { const result = await consume(values); this.afterConsume(); return result; });
    }
}
function safe(value: unknown): void {
    const encoded = JSON.stringify(value) ?? "";
    assert.equal([SELECTED, OTHER, ERROR, Buffer.from(OTHER).toString("base64")].some(secret => encoded.includes(secret)), false,
        "Public coordinator state and completed output must exclude synthetic registry values and exceptions.");
}
function release(job: Job, output: OutputResult): boolean {
    assert.equal(typeof job.canRelease === "function", true, "The real coordinator job must expose held-output release authority.");
    return job.canRelease(output);
}

async function fixture(t: TestContext) {
    const parent = await realpath(tmpdir()), directory = await mkdtemp(join(parent, "soterai-f25-runtime-")), root = join(directory, "project");
    await mkdir(root); await writeFile(join(directory, ".synthetic-lite-f25-runtime"), "retained-synthetic-f25-runtime\n", { flag: "wx" });
    await writeFile(join(root, "app.cjs"), ENTRY, { flag: "wx" }); await writeFile(join(root, ".env.synthetic"), SOURCE, { flag: "wx" });
    stub.resetState(root); const context = stub.makeExtensionContext(directory), children: Child[] = [], jobs: Job[] = [];
    const pending: Array<Promise<Job | undefined>> = [], leases: CountedLease[] = [], spawnCalls: Array<{ args: readonly string[]; options: Record<string, unknown> }> = [];
    const state = { selectedAllowed: true, registryAllowed: true, registryThrows: false, registryCalls: 0, selectedCalls: 0,
        registryHold: undefined as ReturnType<typeof deferred> | undefined, revokeAfterConsume: false };
    const spawnMock = t.mock.method(childProcess, "spawn", ((_executable: string, args: readonly string[], options: Record<string, unknown>) => {
        const child = new Child(); children.push(child); spawnCalls.push({ args, options });
        queueMicrotask(() => { child.emit("spawn"); child.emit("message", { type: "READY" }); });
        return child as unknown as ChildProcess;
    }) as unknown as typeof spawn);
    // Keep native ESM named imports pointed at the same mocked builtin export.
    syncBuiltinESMExports();
    const vault = {
        async withRuntimeValues<T>(descriptor: VaultAppDescriptor, consume: (values: Readonly<Record<string, string>>, guard: () => boolean) => T,
            enabled: () => boolean): Promise<T> {
            state.selectedCalls++; const captured = JSON.stringify(runtimeBinding(descriptor));
            const guard = () => {
                try { return state.selectedAllowed && enabled() === true && JSON.stringify(runtimeBinding(descriptor)) === captured; }
                catch { return false; }
            };
            if (!guard()) throw Error("Synthetic selected lease unavailable.");
            return consume(Object.freeze({ SELECTED_VALUE: SELECTED }), guard);
        },
        async createGatewayRegistry(enabled: () => boolean): Promise<GatewayRegistryLease> {
            state.registryCalls++; await state.registryHold?.promise;
            if (state.registryThrows) throw Error(ERROR);
            const lease = new CountedLease(Object.freeze([SELECTED, OTHER]), () => state.registryAllowed && enabled() === true,
                () => { if (state.revokeAfterConsume) state.registryAllowed = false; });
            leases.push(lease); return lease;
        },
    };
    const module = await import("../vault-runtime/VaultRuntime"), Constructor = module.VaultRuntime as unknown as Factory;
    const runtime = new Constructor(context as unknown as vscode.ExtensionContext, vault as unknown as VaultManager);
    const descriptor = await runtime.save({ schemaVersion: 1, id: ID, root, cwd: root, program: join(root, "app.cjs"), source: join(root, ".env.synthetic"),
        programDigest: createHash("sha256").update(ENTRY).digest("hex"), args: [], selections: [{ name: "SELECTED_VALUE", placeholder: PLACEHOLDER }] });
    t.after(async () => {
        state.registryAllowed = false; state.selectedAllowed = false; state.registryHold?.resolve(); runtime.dispose();
        for (const child of children) child.finish(); await flush();
        await Promise.allSettled(pending); for (const child of children) child.finish(); await flush();
        for (const job of jobs) { await job.completion; job.dispose(); }
        await runtime.shutdown(); for (const subscription of context.subscriptions) subscription.dispose();
        for (const lease of leases) lease.dispose();
        spawnMock.mock.restore(); syncBuiltinESMExports(); stub.resetState();
    });
    const run = () => {
        const work = runtime.run(descriptor.id).then(job => { if (job) jobs.push(job); return job; }); pending.push(work); return work;
    };
    return { runtime, context, descriptor, root, state, children, leases, spawnCalls, run,
        async running(): Promise<Job> {
            const job = await run(); assert.equal(job !== undefined && children.length === 1, true, "One synthetic owned job must start through the real coordinator.");
            await flush(); return job!;
        },
        async finish(job: Job, code = 17): Promise<Completion> {
            for (const child of children) child.finish(code); await flush(); const result = await job.completion;
            assert.equal(children.every(child => child.killCalls === 0), true, "No actual or simulated process signal may be sent.");
            safe(result); safe(runtime.jobs()); safe([...context._inspect.workspaceStore]); safe([...context._inspect.globalStore]);
            assert.equal(context._inspect.secretStore.size === 0, true, "The mock leases must not create a vault key.");
            return result;
        },
        async registryPending(): Promise<void> {
            await flush(); assert.equal(state.registryCalls === 1, true, "Every owned run must acquire the complete current-window registry.");
        },
    };
}

test("F25-R01 real canonical runtime preserves public output and nonzero completion without changing source", async t => {
    const f = await fixture(t), job = await f.running(); f.children[0].stdout.write(PUBLIC); f.children[0].stderr.write(WARNING);
    const result = await f.finish(job, 23);
    assert.equal(result.output.status === "COMPLETE" && result.output.stdout === PUBLIC && result.output.stderr === WARNING && result.output.exitCode === 23, true,
        "Useful public app output must survive complete-registry integration.");
    assert.equal(await readFile(join(f.root, ".env.synthetic"), "utf8") === SOURCE, true, "Canonical source bytes must remain unchanged.");
});

test("F25-R02 the complete current-window registry masks unselected output while IPC contains selected values only", async t => {
    const f = await fixture(t), job = await f.running();
    const starts = f.children[0].sent.filter(message => (message as { type?: string })?.type === "START") as Array<{ values?: Record<string, string> }>;
    assert.equal(starts.length === 1 && Object.keys(starts[0].values ?? {}).join(",") === "SELECTED_VALUE" && starts[0].values?.SELECTED_VALUE === SELECTED, true,
        "Registry filtering must not expand descriptor injection authority.");
    assert.equal(JSON.stringify(starts).includes(OTHER) || JSON.stringify(f.spawnCalls).includes(OTHER), false,
        "Unselected registry values must stay out of injection, argv and spawn environment.");
    f.children[0].stdout.write(OTHER); f.children[0].stderr.write(WARNING); const result = await f.finish(job, 29);
    assert.equal(f.state.registryCalls === 1 && result.output.status === "COMPLETE" && result.output.redacted && result.output.stdout === MASK && result.output.stderr === MASK, true,
        "A current-window value outside the descriptor must still be filtered by the actual job.");
});

test("F25-R03 unavailable complete registry refuses before spawning without selected-only fallback", async t => {
    const f = await fixture(t); f.state.registryThrows = true; const job = await f.run(); await flush();
    assert.equal(job === undefined && f.state.registryCalls === 1 && f.children.length === 0, true,
        "A complete-registry acquisition failure must not create an app with weaker selected-only filtering.");
    safe(f.runtime.jobs()); safe([...f.context._inspect.workspaceStore]);
});

test("F25-R04 selected guard withdrawal during held complete-registry acquisition prevents launch", async t => {
    const f = await fixture(t); f.state.registryHold = deferred(); const work = f.run(); await f.registryPending();
    f.state.selectedAllowed = false; f.state.registryHold.resolve(); const job = await work; await flush();
    assert.equal(job === undefined && f.children.length === 0, true, "A late complete registry cannot revive withdrawn selected-value authority.");
});

test("F25-R05 machine log protection withdrawal during registry acquisition prevents launch after reenable", async t => {
    const f = await fixture(t); f.state.registryHold = deferred(); const work = f.run(); await f.registryPending();
    stub.state.configInspect.set("soterai.lite.logProtection", { globalValue: false, defaultValue: true });
    f.state.registryHold.resolve(); const job = await work; await flush();
    stub.state.configInspect.set("soterai.lite.logProtection", { globalValue: true, defaultValue: true });
    assert.equal(job === undefined && f.children.length === 0, true, "Reenable after an observed refusal must not release the pending run.");
});

test("F25-R06 complete registry stays live across COMPLETE and is disposed with final job authority", async t => {
    const f = await fixture(t), job = await f.running(); f.children[0].stdout.write(PUBLIC); const result = await f.finish(job);
    assert.equal(f.leases.length === 1 && f.leases[0].disposals === 0 && f.leases[0].available(), true,
        "Child completion must retain the registry guard until native consumers can check the exact held output.");
    assert.equal(release(job, result.output), true, "A completion callback must not dispose the registry before the native await continuation.");
    job.dispose(); job.dispose();
    assert.equal(f.leases[0].disposals === 1 && !f.leases[0].available() && !release(job, result.output), true,
        "Final disposal must release the registry once and revoke the held completion.");
});

test("F25-R07 late complete-registry withdrawal revokes held output and cannot be reenabled", async t => {
    const f = await fixture(t), job = await f.running(); f.children[0].stdout.write(PUBLIC); const result = await f.finish(job);
    assert.equal(release(job, result.output), true); f.state.registryAllowed = false;
    assert.equal(release(job, result.output), false, "Final native release must still sample the complete-registry guard.");
    f.state.registryAllowed = true; assert.equal(release(job, result.output), false, "Observed registry withdrawal must remain sticky.");
});

test("F25-R08 late selected source authority withdrawal still revokes output after complete-registry acquisition", async t => {
    const f = await fixture(t), job = await f.running(); f.children[0].stdout.write(PUBLIC); const result = await f.finish(job);
    assert.equal(release(job, result.output), true);
    await writeFile(join(f.root, ".env.synthetic"), SOURCE + "# owner changed this synthetic source\n");
    assert.equal(release(job, result.output), false, "Complete registry access must not replace the selected source guard.");
    await writeFile(join(f.root, ".env.synthetic"), SOURCE);
    assert.equal(release(job, result.output), false, "Restoring source bytes must not revive observed stale output authority.");
});

test("F25-R09 runtime disposal releases retained completed registry leases and held output authority", async t => {
    const f = await fixture(t), job = await f.running(); f.children[0].stdout.write(PUBLIC); const result = await f.finish(job);
    assert.equal(release(job, result.output), true); f.runtime.dispose(); await flush();
    assert.equal(release(job, result.output), false, "Disposing the runtime must revoke already completed output.");
    assert.equal(f.leases.length === 1 && f.leases[0].disposals >= 1 && !f.leases[0].available(), true,
        "Completed jobs must not retain live registry leases after runtime disposal.");
});

test("F25-R10 registry post-use validation failure retains and cooperatively stops any created owned job", async t => {
    const f = await fixture(t); f.state.revokeAfterConsume = true; const job = await f.run(); await flush();
    assert.equal(job === undefined && f.state.registryCalls === 1, true, "A failed final lease validation must not return a job capability.");
    assert.equal(f.children.every(child => child.sent.some(message => (message as { type?: string })?.type === "STOP")), true,
        "A job created before lease rejection must remain owned and receive an immediate cooperative stop.");
    for (const child of f.children) child.finish(); await flush(); safe(f.runtime.jobs());
});
