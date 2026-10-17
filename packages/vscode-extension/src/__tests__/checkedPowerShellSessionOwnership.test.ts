import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { mkdtemp, mkdir, rename, writeFile } from "node:fs/promises";
import { renameSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess, spawn } from "node:child_process";
import type * as vscode from "vscode";
import * as stub from "./phase2/vscode-stub";
import { BoundarySnapshot, initializeBoundaryState, updateRules } from "../ai-boundary/BoundarySnapshot";
import { CheckedPowerShellSession } from "../terminal/CheckedPowerShellSession";
import { ManagedOutputFilter } from "../terminal/ManagedOutputFilter";
import { PowerShell51Worker, type PowerShell51Completion, type PowerShell51Snapshot } from "../terminal/PowerShell51Worker";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";

// F10 design05 trusted lifecycle hooks. No original file content is read, no
// outside directory is enumerated, and no real child or process termination is
// used. All synthetic fixture directories, including swapped originals, remain.
const PRIVATE = "synthetic-f10-ownership-registry-value-kQ29";
const tick = () => new Promise<void>(done => setImmediate(done));
function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (error: unknown) => void;
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}
async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(label)), 1500); })]); }
    finally { if (timer) clearTimeout(timer); }
}
const noOutput = (): OutputResult => ({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: "synthetic_withheld" });
function withheld(result: OutputResult): void { assert.equal(result.status, "WITHHELD"); assert.equal(result.stdout, ""); assert.equal(result.stderr, ""); }
function metadata(snapshot: PowerShell51Snapshot): void {
    assert.ok(Object.isFrozen(snapshot));
    assert.ok(Object.keys(snapshot).every(key => ["id", "state", "pid", "exitCode"].includes(key)));
    assert.ok(!JSON.stringify(snapshot).includes(PRIVATE));
    assert.match(snapshot.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
}
let root: string, context: ReturnType<typeof stub.makeExtensionContext>, owned: CheckedPowerShellSession[];
beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-f10-ownership-"));
    await mkdir(join(root, "public")); await writeFile(join(root, "public", "public-name.txt"), "ordinary synthetic fixture\n");
    stub.resetState(root); context = stub.makeExtensionContext(root);
    initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load(); owned = [];
});
afterEach(() => { owned.forEach(session => session.dispose()); context.subscriptions.forEach(item => item.dispose()); });
type WorkerOptions = ConstructorParameters<typeof PowerShell51Worker>[0];
type Hooks = { admitWorker?: (snapshot: PowerShell51Snapshot) => Promise<boolean>; workerChanged?: (snapshot: PowerShell51Snapshot) => void };
function fixture(hooks: Hooks = {}, mode: "complete" | "held" | "blocked" = "complete") {
    let enabled = true, state: PowerShell51Snapshot["state"] = "READY", id = "", starts = 0, cancels = 0, filters = 0, revokes = 0;
    const events: string[] = [], changed: PowerShell51Snapshot[] = [], completion = deferred<PowerShell51Completion>();
    let workerOptions!: WorkerOptions, settled = false;
    const snapshot = (): PowerShell51Snapshot => Object.freeze({ id, state, ...(state === "RUNNING" ? { pid: 43127 } : {}), ...(state === "EXITED" ? { exitCode: 0 } : {}) });
    const finish = () => {
        if (settled) return; settled = true;
        const output = state === "RUNNING" ? (() => { workerOptions.output.push("stdout", Buffer.from("public completed result\n")); return workerOptions.output.finish(0); })() : noOutput();
        if (state === "RUNNING") state = "EXITED";
        completion.resolve(Object.freeze({ snapshot: snapshot(), output }));
    };
    const session = new CheckedPowerShellSession({ root: stub.Uri.file(root) as unknown as vscode.Uri,
        reader: { read: async () => ({ status: "DENIED" }), revoke: () => { revokes++; }, isEnabled: () => enabled },
        vault: { createManagedOutputFilter: async (_root, guard) => { filters++; return new ManagedOutputFilter([PRIVATE], guard); } },
        enabled: () => enabled, parentEnvironment: { SystemRoot: "C:\\Windows", LANG: "C" },
    }, {
        createWorker: (options: WorkerOptions) => {
            workerOptions = options; id = options.id; events.push("create");
            return { snapshot, completion: completion.promise,
                start: async () => { starts++; events.push("start"); state = mode === "blocked" ? "BLOCKED" : "RUNNING"; if (mode !== "held") queueMicrotask(finish); return snapshot(); },
                cancel: () => { cancels++; if (!settled) { state = "CANCELLED"; workerOptions.output.cancel(); finish(); } }, dispose: () => { if (!settled) { state = "CANCELLED"; finish(); } },
            };
        }, ...hooks,
        ...(hooks.workerChanged ? { workerChanged: (value: PowerShell51Snapshot) => { changed.push(value); events.push("changed:" + value.state); hooks.workerChanged!(value); } } : {}),
    } as never);
    owned.push(session);
    return { session, events, changed, finish, completion: completion.promise, get starts() { return starts; }, get cancels() { return cancels; },
        get filters() { return filters; }, get revokes() { return revokes; }, set enabled(value: boolean) { enabled = value; } };
}

test("F10-O01 READY ownership admission is awaited before start and value-free snapshots report completed lifecycle", async () => {
    const gate = deferred<boolean>(), admissions: PowerShell51Snapshot[] = [];
    const f = fixture({ admitWorker: async snapshot => { metadata(snapshot); admissions.push(snapshot); return gate.promise; }, workerChanged: metadata });
    const run = f.session.execute("Get-Date"); let settled = false; void run.then(() => { settled = true; }); await tick();
    const before = { starts: f.starts, admissions: admissions.length, settled, state: admissions[0]?.state };
    gate.resolve(true); const result = await bounded(run, "Admitted run did not complete.");
    assert.deepEqual(before, { starts: 0, admissions: 1, settled: false, state: "READY" });
    assert.equal(result.status, "COMPLETE"); assert.equal(f.starts, 1);
    assert.deepEqual(f.changed.map(value => value.state), ["RUNNING", "EXITED"]);
    assert.equal(f.changed[0].id, admissions[0].id); assert.equal(f.changed[1].id, admissions[0].id);
    assert.equal(f.session.snapshot().state, "IDLE");
});

for (const denied of ["false", "reject", "truthy"] as const) {
    test(`F10-O02-${denied} unsuccessful durable admission closes a no-child worker without starting or releasing output`, async () => {
        let admissions = 0;
        const f = fixture({ admitWorker: async snapshot => { admissions++; metadata(snapshot); if (denied === "reject") throw new Error(PRIVATE); return denied === "truthy" ? "yes" as never : false; }, workerChanged: metadata });
        const result = await bounded(f.session.execute("Get-Date"), "Declined no-child admission did not settle.");
        withheld(result); assert.equal(admissions, 1); assert.equal(f.starts, 0); assert.ok(f.cancels >= 1);
        assert.equal((await bounded(f.completion, "Declined worker completion was abandoned.")).snapshot.state, "CANCELLED");
        assert.equal(f.changed.at(-1)?.state, "CANCELLED"); assert.equal(f.session.snapshot().state, "IDLE");
        assert.ok(!JSON.stringify(result).includes(PRIVATE));
    });
}

for (const action of ["cancel", "dispose", "withdraw"] as const) {
    test(`F10-O03-${action} pending admission rechecks sticky session availability before any worker start`, async () => {
        const gate = deferred<boolean>(); let admissions = 0;
        const f = fixture({ admitWorker: async () => { admissions++; return gate.promise; }, workerChanged: metadata });
        const run = f.session.execute("Get-Date"); await tick();
        if (action === "cancel") f.session.cancel(); else if (action === "dispose") f.session.dispose(); else f.enabled = false;
        gate.resolve(true); const result = await bounded(run, "Withdrawal while admitting did not settle.");
        withheld(result); assert.equal(admissions, 1); assert.equal(f.starts, 0);
        assert.equal((await bounded(f.completion, "No-child withdrawal lost ownership.")).snapshot.state, "CANCELLED");
        assert.equal(f.changed.at(-1)?.state, "CANCELLED");
        assert.equal(f.session.snapshot().state, action === "dispose" ? "CLOSED" : "IDLE");
    });
}

test("F10-O04 current root identity is rechecked after durable ownership await", async () => {
    const gate = deferred<boolean>(); let admissions = 0;
    const f = fixture({ admitWorker: async () => { admissions++; return gate.promise; }, workerChanged: metadata });
    const run = f.session.execute("Get-Date"); await tick();
    await rename(root, root + "-retained-original"); await mkdir(root);
    gate.resolve(true); withheld(await bounded(run, "Root replacement during admission did not settle."));
    assert.equal(admissions, 1); assert.equal(f.starts, 0); assert.equal(f.changed.at(-1)?.state, "CANCELLED");
});

test("F10-O05 policy binding is rechecked after durable ownership await", async () => {
    const gate = deferred<boolean>(); let admissions = 0;
    const f = fixture({ admitWorker: async () => { admissions++; return gate.promise; }, workerChanged: metadata });
    const run = f.session.execute("Get-Date"); await tick();
    await updateRules(stub.Uri.file(root).toString(), rules => ({ ...rules, paths: [...rules.paths, { kind: "file", pattern: "new-denial.txt" }] }));
    gate.resolve(true); withheld(await bounded(run, "Policy drift during admission did not settle."));
    assert.equal(admissions, 1); assert.equal(f.starts, 0); assert.equal(f.changed.at(-1)?.state, "CANCELLED");
});

test("F10-O06 a running owned worker stays BUSY until actual completion and reports the same final id", async () => {
    const f = fixture({ admitWorker: async snapshot => { metadata(snapshot); return true; }, workerChanged: metadata }, "held");
    const run = f.session.execute("Get-Date"); let settled = false; void run.then(() => { settled = true; }); await tick();
    const before = { settled, state: f.session.snapshot().state, changed: f.changed.map(value => value.state) };
    f.finish(); const result = await bounded(run, "Owned completion was not awaited.");
    assert.deepEqual(before, { settled: false, state: "BUSY", changed: ["RUNNING"] });
    assert.equal(result.status, "COMPLETE"); assert.deepEqual(f.changed.map(value => value.state), ["RUNNING", "EXITED"]);
    assert.equal(f.changed[0].id, f.changed[1].id); assert.equal(f.session.snapshot().state, "IDLE");
});

test("F10-O07 no-child start failure reports BLOCKED completion instead of fabricated RUNNING or EXITED", async () => {
    const f = fixture({ admitWorker: async () => true, workerChanged: metadata }, "blocked");
    withheld(await bounded(f.session.execute("Get-Date"), "Blocked no-child completion was lost."));
    assert.equal(f.starts, 1); assert.ok(f.changed.length >= 1); assert.equal(f.changed.at(-1)?.state, "BLOCKED");
    assert.ok(f.changed.every(value => value.state === "BLOCKED")); assert.ok(f.changed.every(value => value.pid === undefined));
});

test("F10-O08 optional trusted hooks preserve existing internal finite-worker compatibility", async () => {
    const f = fixture(), result = await bounded(f.session.execute("Get-Date"), "Optional-hook compatibility failed.");
    assert.equal(result.status, "COMPLETE"); assert.equal(result.stdout, "public completed result\n"); assert.equal(f.starts, 1); assert.equal(f.filters, 1);
});

class ProtocolChild extends EventEmitter {
    readonly stdin = new PassThrough(); readonly stdout = new PassThrough(); readonly stderr = new PassThrough();
    readonly pid = 43129; readonly input: Buffer[] = []; killCalls = 0;
    constructor() { super(); this.stdin.on("data", bytes => this.input.push(Buffer.from(bytes))); }
    kill(): never { this.killCalls++; throw new Error("Process termination is prohibited."); }
    async naturallyClose(): Promise<void> { this.stdout.end(); this.stderr.end(); await tick(); this.emit("close", 0, null); }
}
async function directoryProtocolFixture(swap: boolean) {
    const child = new ProtocolChild(), outside = await mkdtemp(join(tmpdir(), "soterai-f10-protocol-outside-"));
    await writeFile(join(outside, "outside-name-must-not-be-enumerated.txt"), "synthetic fixture only\n");
    let spawns = 0, admissionCalls = 0;
    const session = new CheckedPowerShellSession({ root: stub.Uri.file(root) as unknown as vscode.Uri,
        reader: { read: async () => ({ status: "DENIED" }), revoke() {}, isEnabled: () => true },
        vault: { createManagedOutputFilter: async (_root, guard) => new ManagedOutputFilter([PRIVATE], guard) }, enabled: () => true,
        parentEnvironment: { SystemRoot: "C:\\Windows", LANG: "C" },
    }, { admitWorker: async (snapshot: PowerShell51Snapshot) => { admissionCalls++; metadata(snapshot); return true; },
        createWorker: (options: WorkerOptions) => new PowerShell51Worker(options, { spawn: (() => {
            spawns++;
            // This controlled swap occurs after session/filter acquisition, at
            // native launch, before the worker's spawn/protocol callback. The
            // child never enumerates either target: captured stdin is the oracle.
            if (swap) { renameSync(join(root, "public"), join(root, "public-retained-original")); symlinkSync(outside, join(root, "public"), process.platform === "win32" ? "junction" : "dir"); }
            queueMicrotask(() => { child.emit("spawn"); if (!swap) child.stdout.write("public-name.txt\n"); void child.naturallyClose(); });
            return child as unknown as ChildProcess;
        }) as unknown as typeof spawn }),
    } as never);
    owned.push(session);
    const result = await bounded(session.execute("ls public"), "Directory protocol worker lost natural-close completion.");
    return { result, child, spawns, admissionCalls };
}

test("F10-O09 directory swapped to outside junction before protocol withholds every request byte without outside enumeration", async () => {
    const f = await directoryProtocolFixture(true); withheld(f.result);
    assert.equal(f.spawns, 1); assert.equal(Buffer.concat(f.child.input).length, 0); assert.equal(f.child.killCalls, 0);
    assert.ok(!JSON.stringify(f.result).includes("outside-name"));
});

test("F10-O10 stable public directory receives exact finite list protocol and completed public output", async () => {
    const f = await directoryProtocolFixture(false);
    assert.equal(f.spawns, 1); assert.equal(f.child.killCalls, 0);
    assert.deepEqual(JSON.parse(Buffer.concat(f.child.input).toString("utf8")), { operation: { kind: "PUBLIC", action: "list", args: ["public"] } });
    assert.equal(f.result.status, "COMPLETE"); assert.equal(f.result.stdout, "public-name.txt\n");
});

test("F10-O11 throwing start observer cancels output but retains BUSY ownership until actual completion", async () => {
    const completion = deferred<PowerShell51Completion>(), changed: PowerShell51Snapshot[] = [];
    let id = "", started = false, cancelled = false, cancelRequests = 0, options!: WorkerOptions;
    const snapshot = (): PowerShell51Snapshot => Object.freeze({ id, state: cancelled ? "CANCEL_PENDING" : started ? "RUNNING" : "READY", ...(started ? { pid: 43131 } : {}) });
    const session = new CheckedPowerShellSession({ root: stub.Uri.file(root) as unknown as vscode.Uri,
        reader: { read: async () => ({ status: "DENIED" }), revoke() {}, isEnabled: () => true },
        vault: { createManagedOutputFilter: async (_root, guard) => new ManagedOutputFilter([PRIVATE], guard) },
        enabled: () => true, parentEnvironment: { SystemRoot: "C:\\Windows", LANG: "C" },
    }, { admitWorker: async (value: PowerShell51Snapshot) => { metadata(value); return true; },
        workerChanged: (value: PowerShell51Snapshot) => { metadata(value); changed.push(value); if (value.state === "RUNNING") throw new Error(PRIVATE); },
        createWorker: (value: WorkerOptions) => {
            options = value; id = value.id;
            return { snapshot, completion: completion.promise, start: async () => { started = true; return snapshot(); },
                // Cancellation is a request, never evidence of actual close.
                cancel: () => { cancelRequests++; cancelled = true; options.output.cancel(); }, dispose() {},
            };
        },
    } as never);
    owned.push(session);
    const run = session.execute("Get-Date"); let settled = false; void run.then(() => { settled = true; }); await tick();
    const during = { settled, state: session.snapshot().state, cancelRequests };
    let output: OutputResult;
    if (cancelled) output = noOutput(); else { options.output.push("stdout", Buffer.from("public child completed\n")); output = options.output.finish(0); }
    completion.resolve(Object.freeze({ snapshot: Object.freeze({ id, state: cancelled ? "CANCELLED" : "EXITED", exitCode: 0 }), output }));
    const result = await bounded(run, "Throwing observer abandoned actual completion.");
    assert.deepEqual(during, { settled: false, state: "BUSY", cancelRequests: 1 });
    withheld(result); assert.deepEqual(changed.map(value => value.state), ["RUNNING", "CANCELLED"]);
    assert.equal(session.snapshot().state, "IDLE"); assert.ok(!JSON.stringify(result).includes(PRIVATE));
});
