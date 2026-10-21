import "./phase2/register.mjs";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import * as stub from "./phase2/vscode-stub";
import { HygieneController } from "../hygiene/HygieneController";
const names = ["reviewWorkspaceSourceSecrets", "reviewSourceSecrets", "reviewSourceSecretVault", "restoreSourceSecretVault", "sourceSecretScannerStatus"];
const PRIVATE = "TEST_ONLY_F22A_CALLER_NOT_AUTHORITY";
async function fixture(t: TestContext) {
    const base = await mkdtemp(join(tmpdir(), "soterai-f22a-commands-")), root = join(base, "project"); await mkdir(root); stub.resetState(root);
    const context = stub.makeExtensionContext(join(base, "profile")), ui = stub.window as any, prior = Object.getOwnPropertyDescriptor(ui, "showOpenDialog");
    Object.defineProperty(ui, "showOpenDialog", { configurable: true, writable: true, value: async () => undefined });
    const { registerSourceScanner } = await import("../config-scanners/commands"); const controller = registerSourceScanner(context as never);
    t.after(() => { controller.dispose(); context.subscriptions.forEach(d => d.dispose()); if (prior) Object.defineProperty(ui, "showOpenDialog", prior); else delete ui.showOpenDialog; });
    const call = (name: string, ...args: unknown[]) => { const handler = stub.registeredCommands.get("soterai." + name); assert(handler); return Promise.resolve(handler(...args)); };
    return { controller, context, root, ui, call };
}
test("F22a source commands register with no scan, key or caller authority", async t => {
    const f = await fixture(t); for (const name of names) assert(stub.registeredCommands.has("soterai." + name)); assert.equal(await f.context.secrets.get("soterai.hygiene.hmacKey.v1"), undefined);
    assert.match(JSON.stringify(await f.call("sourceSecretScannerStatus", PRIVATE)), /JS\/JSX/);
});
test("F22a source command selects actual native file and ignores URI/content/approval carriers", async t => {
    const f = await fixture(t), target = stub.Uri.file(join(f.root, "config.ts")), docs: unknown[] = [];
    t.mock.method(f.ui, "showOpenDialog", async (options: any) => { assert.equal(options.canSelectMany, false); assert.deepEqual(options.filters["Source files"], ["js", "jsx", "ts", "tsx", "mjs", "cjs"]); return [target]; });
    t.mock.method(HygieneController.prototype, "reviewFile", async (uri: unknown) => { assert.equal(uri, target); return { status: "ANALYZED", findings: [] }; });
    t.mock.method(stub.workspace, "openTextDocument", async (value: any) => { docs.push(value); assert.equal(typeof value.content, "string"); return {} as never; });
    assert.equal((await f.call("reviewSourceSecrets", { uri: PRIVATE, content: PRIVATE, approved: true }) as any).status, "ANALYZED"); assert.equal(docs.length, 1); assert(!JSON.stringify(docs).includes(PRIVATE));
});
test("F22a source picker cancellation and forged finding item grant nothing", async t => {
    const f = await fixture(t); let called = 0; t.mock.method(HygieneController.prototype, "reviewFile", async () => { called++; return {}; });
    assert.equal((await f.call("reviewSourceSecrets", { approved: true }) as any).status, "CANCELLED"); assert.equal(called, 0);
    const id = "a".repeat(64); t.mock.method(HygieneController.prototype, "selections", () => [{ id, label: "Finding 1", provider: "unknown" }]); t.mock.method(stub.window, "showQuickPick", async () => ({ id, label: PRIVATE }));
    t.mock.method(HygieneController.prototype, "vaultFinding", async () => { called++; return {}; }); assert.equal((await f.call("reviewSourceSecretVault", id, { approved: true }) as any).status, "CANCELLED"); assert.equal(called, 0);
});
test("F22a source action uses only selected current ordinal and restoration has separate action", async t => {
    const f = await fixture(t), id = "b".repeat(64); t.mock.method(HygieneController.prototype, "selections", () => [{ id, label: "Finding 1", provider: "unknown" }]); t.mock.method(stub.window, "showQuickPick", async (items: any) => items[0]);
    t.mock.method(HygieneController.prototype, "vaultFinding", async (selected: string) => { assert.equal(selected, id); return { status: "APPLIED" }; });
    t.mock.method(HygieneController.prototype, "restoreFinding", async (selected: string) => { assert.equal(selected, id); return { status: "RESTORED" }; });
    assert.equal((await f.call("reviewSourceSecretVault", PRIVATE) as any).status, "APPLIED"); assert.equal((await f.call("restoreSourceSecretVault", PRIVATE) as any).status, "RESTORED");
});
test("F22a pending source picker cannot overlap or survive machine flag withdrawal", async t => {
    const f = await fixture(t); let entered!: () => void, finish!: (v: unknown) => void, calls = 0; const reached = new Promise<void>(r => entered = r);
    t.mock.method(f.ui, "showOpenDialog", async () => { entered(); return new Promise(r => finish = r); }); t.mock.method(HygieneController.prototype, "reviewFile", async () => { calls++; return {}; });
    const pending = f.call("reviewSourceSecrets"); await reached; assert.equal((await f.call("reviewWorkspaceSourceSecrets") as any).status, "UNAVAILABLE");
    stub.state.configInspect.set("soterai.lite.configScanner.source", { globalValue: false, workspaceValue: true }); finish([stub.Uri.file(join(f.root, "a.js"))]); assert.equal((await pending as any).status, "UNAVAILABLE"); assert.equal(calls, 0);
});
test("F22a manifest contributes machine/restricted flag and advanced commands with activation registration", () => {
    for (const file of ["packages/vscode-extension/package.json", "packages/soterai-lite/package.json"]) {
        const p = JSON.parse(readFileSync(resolve(__dirname, "../../../..", file), "utf8")), flag = "soterai.lite.configScanner.source";
        assert.equal(p.contributes.configuration.properties[flag]?.scope, "machine"); assert.equal(p.contributes.configuration.properties[flag]?.default, true); assert.equal(p.contributes.configuration.properties[flag]?.type, "boolean");
        assert(p.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(flag)); assert.equal(p.devDependencies["@babel/parser"], "7.29.7");
        for (const name of names) { const id = "soterai." + name; assert(p.contributes.commands.some((c: any) => c.command === id)); assert(p.contributes.menus.commandPalette.some((c: any) => c.command === id && c.when === "soterai.advancedCommands")); }
    }
    assert.match(readFileSync(resolve(__dirname, "../extension.ts"), "utf8"), /registerSourceScanner\(context\)/);
});
