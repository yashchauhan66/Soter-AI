import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { FirewallDeps } from "../firewall/shared";
import { captureRuntimeArtifact } from "../vault-runtime/RuntimeBinding";
import * as stub from "./phase2/vscode-stub";

const requiredStub = createRequire(__filename)("./phase2/vscode-stub") as Record<string, unknown>;
const placeholder = "[SOTERAI_PROTECTED_0123456789ABCDEF0123456789ABCDEF_0]";
async function fixture(t: TestContext, entry = "exports.start = () => process.stdout.write(require('./helper.cjs').value);", legacy = false) {
    const root = await mkdtemp(join(await realpath(tmpdir()), "soterai-artifact-command-"));
    await writeFile(join(root, "app.cjs"), entry, { flag: "wx" }); await writeFile(join(root, "helper.cjs"), "exports.value = 'approved public';", { flag: "wx" });
    await writeFile(join(root, ".env"), `SELECTED=${placeholder}\n`, { flag: "wx" });
    stub.resetState(root); const context = stub.makeExtensionContext(root);
    if (legacy) context._inspect.workspaceStore.set("soterai.lite.vaultApps.v1", [{ schemaVersion: 1, id: "historical" }]);
    const restore: Array<() => void> = [];
    function replace(target: object, key: string, value: unknown): void {
        const original = Object.getOwnPropertyDescriptor(target, key); Object.defineProperty(target, key, { value, configurable: true, enumerable: true });
        restore.push(() => { if (original) Object.defineProperty(target, key, original); else Reflect.deleteProperty(target, key); });
    }
    const dialogs = [[stub.Uri.file(join(root, "app.cjs"))], [stub.Uri.file(join(root, ".env"))]];
    const observations = { selections: 0, refreshes: 0, errors: [] as string[], warnings: [] as string[], beforeSave: undefined as (() => Promise<void>) | undefined };
    replace(stub.window, "showOpenDialog", async () => dialogs.shift());
    replace(stub.window, "showQuickPick", async (items: unknown[]) => items);
    replace(stub.window, "showInputBox", async () => { await observations.beforeSave?.(); return "[]"; });
    replace(stub.window, "showErrorMessage", async (value: string) => { observations.errors.push(value); });
    replace(stub.window, "showWarningMessage", async (value: string) => { observations.warnings.push(value); });
    replace(stub.tasks, "registerTaskProvider", () => new stub.Disposable());
    replace(requiredStub, "debug", { registerDebugConfigurationProvider: () => new stub.Disposable(), registerDebugAdapterDescriptorFactory: () => new stub.Disposable() });
    const module = await import("../vault-runtime/commands");
    t.after(async () => { await module.stopVaultRuntime(); context.subscriptions.forEach(subscription => subscription.dispose()); restore.reverse().forEach(fn => fn()); stub.resetState(); });
    module.registerVaultRuntimeCommands({ context, requireTrust: () => true, refreshViews: () => { observations.refreshes++; },
        vault: { runtimeSelections: async () => { observations.selections++; return [{ name: "SELECTED", placeholder }]; } },
    } as unknown as FirewallDeps);
    const configure = () => stub.commands.executeCommand("soterai.configureVaultApp");
    return { root, context, observations, configure };
}

test("owner setup binds complete closure and exposes only public descriptor identity", async t => {
    const f = await fixture(t), result = await f.configure() as { id: string; saved: boolean };
    assert.equal(result.saved, true); assert.deepEqual(Object.keys(result).sort(), ["id", "saved"]);
    const saved = f.context._inspect.workspaceStore.get("soterai.lite.vaultApps.v2") as Array<{ schemaVersion: number; artifactDigest: string }>;
    assert.equal(saved.length, 1); assert.equal(saved[0].schemaVersion, 2);
    assert.equal(saved[0].artifactDigest, captureRuntimeArtifact(f.root, join(f.root, "app.cjs")).digest);
    assert.ok(!JSON.stringify(saved).includes("approved public")); assert.equal(f.observations.refreshes, 1);
});

test("changed dependency while owner setup awaits input prevents descriptor persistence", async t => {
    const f = await fixture(t);
    f.observations.beforeSave = async () => { await writeFile(join(f.root, "helper.cjs"), "exports.value = 'changed during setup';"); };
    assert.equal(await f.configure(), undefined); assert.equal(f.context._inspect.workspaceStore.has("soterai.lite.vaultApps.v2"), false);
    assert.equal(f.observations.errors.length, 1); assert.equal(f.observations.refreshes, 0);
});

test("unsupported dynamic loader refuses before selecting vault variables", async t => {
    const f = await fixture(t, "require(process.env.DEPENDENCY);");
    assert.equal(await f.configure(), undefined); assert.equal(f.observations.selections, 0);
    assert.equal(f.context._inspect.workspaceStore.has("soterai.lite.vaultApps.v2"), false);
});

test("legacy approvals remain retained and explicitly require owner setup again", async t => {
    const f = await fixture(t, "exports.start = () => {};", true);
    assert.ok(f.observations.warnings.some(value => value.includes("need setup again")));
    assert.deepEqual(await stub.commands.executeCommand("soterai.vaultAppStatus"), { descriptors: [], jobs: [] });
    assert.equal((await f.configure() as { saved: boolean }).saved, true);
    assert.deepEqual(f.context._inspect.workspaceStore.get("soterai.lite.vaultApps.v1"), [{ schemaVersion: 1, id: "historical" }]);
});
