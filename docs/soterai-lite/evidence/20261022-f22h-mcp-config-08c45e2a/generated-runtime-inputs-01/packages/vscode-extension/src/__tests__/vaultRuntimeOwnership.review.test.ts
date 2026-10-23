import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type * as vscode from "vscode";
import type { VaultManager } from "../firewall/VaultManager";
import { VaultRuntime } from "../vault-runtime/VaultRuntime";
import * as stub from "./phase2/vscode-stub";

// Read-only public recovery metadata fixtures. The lease always rejects before
// its trusted callback, so no child is created and no vault value is accessed.
const DESCRIPTORS = "soterai.lite.vaultApps.v1";
const OWNERSHIP = "soterai.lite.vaultJobs.v1";
const ENTRY = "exports.start = () => {};\n";
const id = (index: number) => `89cd22c0-cde1-42c6-b6a9-${String(index).padStart(12, "0")}`;
const record = (index: number, state = "RUNNING") => ({ id: id(index), state, pid: 400000 + index });
const tick = () => new Promise<void>(done => setImmediate(done));
let parent: string, directory: string, root: string, context: ReturnType<typeof stub.makeExtensionContext>;
let runtimes: VaultRuntime[], leaseCalls: number, pidCalls: number, writes: unknown[];
function create(): VaultRuntime {
    const vault = { async withRuntimeValues() { leaseCalls++; throw new Error("Synthetic lease deliberately withheld before callback."); } };
    const runtime = new VaultRuntime(context as unknown as vscode.ExtensionContext, vault as unknown as VaultManager);
    runtimes.push(runtime); return runtime;
}
async function blocked(saved: unknown, unreadable = false): Promise<void> {
    context._inspect.workspaceStore.set(OWNERSHIP, saved);
    const before = JSON.stringify(saved);
    if (unreadable) {
        const original = context.workspaceState.get.bind(context.workspaceState);
        const replacement: typeof context.workspaceState.get = <T>(key: string, fallback?: T) => {
            if (key === OWNERSHIP) throw new Error("Synthetic ownership read failure.");
            return original<T>(key, fallback);
        };
        mock.method(context.workspaceState, "get", replacement);
    }
    const runtime = create(), result = await runtime.run(id(999));
    runtime.dispose(); await tick(); await tick();
    assert.equal(result, undefined); assert.equal(leaseCalls, 0, "Unresolved ownership must block before private approval/value access.");
    assert.equal(writes.length, 0, "Run/dispose must not overwrite unreadable or corrupt ownership with a clean-looking list.");
    assert.equal(JSON.stringify(context._inspect.workspaceStore.get(OWNERSHIP)), before);
    assert.deepEqual(runtime.jobs(), []); assert.equal(pidCalls, 0);
}

beforeEach(async () => {
    const base = process.platform === "win32" ? "D:\\SoterAI-Lite-test-profiles" : tmpdir();
    await mkdir(base, { recursive: true }); parent = await realpath(base);
    directory = await mkdtemp(join(parent, "f09-ownership-review-")); root = join(directory, "project"); await mkdir(root);
    await writeFile(join(root, "app.cjs"), ENTRY);
    await writeFile(join(root, ".env"), "DATABASE_URL=[SOTERAI_PROTECTED_A3427B3646BA4D8482E5C5DFB5BA5DD1_0]\n");
    stub.resetState(root); context = stub.makeExtensionContext(directory); runtimes = []; leaseCalls = 0; pidCalls = 0; writes = [];
    context._inspect.workspaceStore.set(DESCRIPTORS, [{ schemaVersion: 1, id: id(999), root,
        program: join(root, "app.cjs"), cwd: root, source: join(root, ".env"),
        programDigest: createHash("sha256").update(ENTRY).digest("hex"), args: [],
        selections: [{ name: "DATABASE_URL", placeholder: "[SOTERAI_PROTECTED_A3427B3646BA4D8482E5C5DFB5BA5DD1_0]" }] }]);
    const original = context.workspaceState.update.bind(context.workspaceState);
    mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        if (key === OWNERSHIP) writes.push(value); await original(key, value);
    });
    mock.method(process, "kill", (() => { pidCalls++; return true; }) as typeof process.kill);
});
afterEach(async () => {
    try {
        for (const runtime of runtimes) runtime.dispose(); await tick(); await tick();
        for (const subscription of context.subscriptions) subscription.dispose();
        const owned = resolve(directory); assert.equal(dirname(owned), parent); assert.ok(basename(owned).startsWith("f09-ownership-review-"));
        await rm(owned, { recursive: true });
    } finally { mock.restoreAll(); stub.resetState(); }
});

for (const [label, saved] of [["null", null], ["object", { state: "unknown" }],
    ["string", "corrupt ownership metadata"], ["number", 7]] as const) {
    test(`F09-O01 non-array ${label} ownership cannot become permission to launch`, async () => { await blocked(saved); });
}

test("F09-O02 more than 64 outstanding records withholds instead of discarding all prior ownership", async () => {
    await blocked(Array.from({ length: 65 }, (_, index) => record(index)));
});

for (const [label, bad] of [
    ["null record", null], ["array record", []], ["unknown property", { ...record(0), env: "unreviewed metadata" }],
    ["invalid UUID", { ...record(0), id: "not-a-job-id" }], ["missing state", { id: id(0), pid: 400000 }],
    ["unknown state", { ...record(0), state: "ADOPTED" }], ["zero PID", { ...record(0), pid: 0 }],
    ["fractional PID", { ...record(0), pid: 1.5 }], ["string PID", { ...record(0), pid: "400000" }],
    ["malformed exit metadata", { ...record(0), exitCode: "not-an-exit-code" }],
] as const) {
    test(`F09-O03 ${label} fails ownership recovery atomically`, async () => { await blocked([bad]); });
}

test("F09-O04 duplicate job IDs cannot silently collapse two prior ownership records", async () => {
    await blocked([record(0), { ...record(0), pid: 400001 }]);
});

test("F09-O05 one malformed row cannot be silently omitted from otherwise valid recovery metadata", async () => {
    await blocked([record(0), { ...record(1), pid: -1 }, record(2, "STOP_UNCONFIRMED")]);
});

test("F09-O06 a throwing ownership Memento read blocks before lease and never overwrites retained bytes", async () => {
    await blocked([record(0)], true);
});

test("F09-O07 strictly valid outstanding rows recover only as UNVERIFIED public metadata", async () => {
    const saved = [record(0, "READY"), record(1), record(2, "STOP_REQUESTED"), record(3, "STOP_UNCONFIRMED"),
        { id: id(4), state: "UNVERIFIED" }];
    context._inspect.workspaceStore.set(OWNERSHIP, saved); const runtime = create(), recovered = runtime.jobs();
    assert.ok(Object.isFrozen(recovered)); assert.equal(recovered.length, 5);
    for (let index = 0; index < recovered.length; index++) {
        const row = recovered[index]; assert.ok(Object.isFrozen(row)); assert.equal(row.id, id(index)); assert.equal(row.state, "UNVERIFIED");
        assert.ok(Object.keys(row).every(key => ["id", "state", "pid"].includes(key)));
    }
    for (const row of recovered) runtime.stop(row.id);
    assert.equal(pidCalls, 0); assert.equal(await runtime.run(id(999)), undefined); assert.equal(leaseCalls, 1);
    runtime.dispose(); await tick(); await tick(); assert.equal(pidCalls, 0);
    const retained = context._inspect.workspaceStore.get(OWNERSHIP) as Array<{ id: string; state: string }>;
    assert.equal(retained.length, 5); assert.ok(retained.every(row => row.state === "UNVERIFIED"));
});

test("F09-O08 exactly 64 valid outstanding rows remain visible and block a 65th reservation", async () => {
    context._inspect.workspaceStore.set(OWNERSHIP, Array.from({ length: 64 }, (_, index) => record(index)));
    const runtime = create(); assert.equal(runtime.jobs().length, 64);
    assert.equal(await runtime.run(id(999)), undefined); assert.equal(leaseCalls, 0);
    for (const row of runtime.jobs()) { assert.equal(row.state, "UNVERIFIED"); runtime.stop(row.id); }
    assert.equal(pidCalls, 0);
});

test("F09-O09 a valid empty ownership list permits private approval without manufacturing adopted jobs", async () => {
    context._inspect.workspaceStore.set(OWNERSHIP, []); const runtime = create();
    assert.deepEqual(runtime.jobs(), []); assert.equal(await runtime.run(id(999)), undefined); assert.equal(leaseCalls, 1);
    assert.deepEqual(runtime.jobs(), []); assert.equal(pidCalls, 0);
});
