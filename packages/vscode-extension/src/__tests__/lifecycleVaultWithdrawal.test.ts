import "./phase2/register.mjs";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import childProcess from "node:child_process";
import type { FirewallDeps } from "../firewall/shared";
import * as stub from "./phase2/vscode-stub";

// Real registerVaultRuntimeCommands + real VaultRuntime, no saved descriptors,
// private leases, children, normal profile, vault values or filesystem fixture.
// Empty public jobs() after corrupt ownership is not successful withdrawal.
// These tests require the failed withdrawal owner to remain available to retry;
// they do not prove process close/EOF, which needs the native lifecycle gate.
const OWNERSHIP = "soterai.lite.vaultJobs.v1";
const PRIVATE = "SYNTHETIC_ONLY_F32_WITHDRAWAL_PRIVATE_b1e32a";
const requiredStub = createRequire(__filename)("./phase2/vscode-stub") as Record<string, unknown>;
const tick = () => new Promise<void>(done => setImmediate(done));

async function fixture(t: TestContext, saved: unknown, unreadable = false) {
    stub.resetState("C:\\Synthetic F32 Vault Withdrawal\\workspace");
    const context = stub.makeExtensionContext("C:\\Synthetic F32 Vault Withdrawal\\profile");
    context._inspect.workspaceStore.set(OWNERSHIP, saved);
    const registrations: string[] = [], writes: unknown[] = [];
    let forbidden = 0, ownershipReads = 0;
    const deny = () => { forbidden++; throw Error("Forbidden synthetic withdrawal capability."); };
    t.mock.method(process, "kill", deny as typeof process.kill);
    for (const method of ["spawn", "fork", "exec", "execFile"] as const) t.mock.method(childProcess, method, deny as never);
    t.mock.method(context.secrets, "get", deny as never);
    t.mock.method(context.secrets, "store", deny as never);
    t.mock.method(context.secrets, "delete", deny as never);
    const originalGet = context.workspaceState.get.bind(context.workspaceState);
    t.mock.method(context.workspaceState, "get", (<T>(key: string, fallback?: T) => {
        if (key === OWNERSHIP) {
            ownershipReads++;
            if (unreadable) throw Error(PRIVATE);
        }
        return originalGet<T>(key, fallback);
    }) as typeof context.workspaceState.get);
    const originalUpdate = context.workspaceState.update.bind(context.workspaceState);
    t.mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        if (key === OWNERSHIP) writes.push(structuredClone(value));
        return originalUpdate(key, value);
    });

    // Supply registration-only plumbing absent from the common stub. Providers
    // are never executed; no task/debug implementation or child is substituted.
    const taskObject = stub.tasks as unknown as Record<string, unknown>;
    const oldTaskRegistration = Object.getOwnPropertyDescriptor(taskObject, "registerTaskProvider");
    const oldDebug = Object.getOwnPropertyDescriptor(requiredStub, "debug");
    Object.defineProperty(taskObject, "registerTaskProvider", { configurable: true, enumerable: true,
        value() { registrations.push("task"); return new stub.Disposable(); } });
    Object.defineProperty(requiredStub, "debug", { configurable: true, enumerable: true, value: {
        registerDebugConfigurationProvider() { registrations.push("debug-configuration"); return new stub.Disposable(); },
        registerDebugAdapterDescriptorFactory() { registrations.push("debug-adapter"); return new stub.Disposable(); },
    } });
    t.after(async () => {
        context.subscriptions.forEach(subscription => subscription.dispose());
        await tick(); await tick();
        if (oldTaskRegistration) Object.defineProperty(taskObject, "registerTaskProvider", oldTaskRegistration);
        else delete taskObject.registerTaskProvider;
        if (oldDebug) Object.defineProperty(requiredStub, "debug", oldDebug); else delete requiredStub.debug;
        assert.equal(forbidden, 0, "Ownership recovery never reads values, launches a child or signals a PID.");
        assert.equal(context._inspect.secretStore.size, 0);
        assert.equal(context._inspect.globalStore.size, 0);
        assert.ok(!JSON.stringify(stub.sinks).includes(PRIVATE), "Private failure text is not notification/status output.");
        stub.resetState();
    });
    const module = await import("../vault-runtime/commands");
    module.registerVaultRuntimeCommands({
        context, vault: { withRuntimeValues: deny, createGatewayRegistry: deny, runtimeSelections: deny },
        requireTrust: deny, refreshViews: deny,
    } as unknown as FirewallDeps);
    assert.deepEqual(registrations, ["task", "debug-configuration", "debug-adapter"]);
    const status = async () => {
        const value = await stub.commands.executeCommand("soterai.vaultAppStatus");
        assert.deepEqual(value, { descriptors: [], jobs: [] });
        return value;
    };
    const failsWithoutLeaking = async () => {
        await assert.rejects(module.stopVaultRuntime, (error: unknown) => {
            assert.ok(error instanceof Error); assert.ok(!String(error).includes(PRIVATE)); return true;
        });
    };
    return { context, module, writes, status, failsWithoutLeaking, reads: () => ownershipReads };
}

test("VW01 corrupt ownership at registration cannot become successful empty withdrawal on a second stop", async t => {
    const corrupt = { state: "corrupt-synthetic-owner", metadata: PRIVATE };
    const f = await fixture(t, corrupt);
    assert.equal(f.reads(), 1); await f.status();
    await f.failsWithoutLeaking();
    assert.deepEqual(f.context._inspect.workspaceStore.get(OWNERSHIP), corrupt);
    await f.failsWithoutLeaking();
    await f.status();
    assert.deepEqual(f.context._inspect.workspaceStore.get(OWNERSHIP), corrupt);
    assert.equal(f.writes.length, 0, "A failed ownership check never overwrites the retained journal with [].");
});

test("VW02 ownership corruption after registration remains a failed owner on repeated withdrawal", async t => {
    const f = await fixture(t, []); await f.status();
    const corrupt = [{ id: "synthetic-not-a-uuid", state: "RUNNING", pid: 123 }];
    f.context._inspect.workspaceStore.set(OWNERSHIP, corrupt);
    await f.failsWithoutLeaking();
    assert.ok(f.reads() >= 2, "Shutdown must revalidate its actual retained ownership journal.");
    await f.failsWithoutLeaking();
    await f.status();
    assert.deepEqual(f.context._inspect.workspaceStore.get(OWNERSHIP), corrupt);
    assert.equal(f.writes.length, 0);
});

test("VW03 unreadable ownership remains unavailable through two stop requests and never becomes clean status authority", async t => {
    const retained = [{ id: "aa3d9af3-60cf-46ed-a70b-c9be02d4e6ad", state: "RUNNING", pid: 123 }];
    const f = await fixture(t, retained, true); await f.status();
    await f.failsWithoutLeaking();
    await f.failsWithoutLeaking();
    await f.status();
    assert.deepEqual(f.context._inspect.workspaceStore.get(OWNERSHIP), retained);
    assert.equal(f.writes.length, 0);
});
