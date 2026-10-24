import "./phase2/register.mjs";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import * as stub from "./phase2/vscode-stub";
import { HygieneController } from "../hygiene/HygieneController";
const names = ["reviewWorkspaceCiSecrets", "reviewCiSecrets", "reviewCiSecretVault", "restoreCiSecretVault", "ciSecretScannerStatus"], PRIVATE = "TEST_ONLY_F22F_CALLER_NOT_AUTHORITY";
async function fixture(t: TestContext) {
    const base = await mkdtemp(join(tmpdir(), "soterai-f22f-commands-")), root = join(base, "project"); await mkdir(root); stub.resetState(root); const context = stub.makeExtensionContext(join(base, "profile")), ui = stub.window as any, prior = Object.getOwnPropertyDescriptor(ui, "showOpenDialog");
    Object.defineProperty(ui, "showOpenDialog", { configurable: true, writable: true, value: async () => undefined }); const { registerCiScanner } = await import("../config-scanners/ciCommands"); const controller = registerCiScanner(context as never);
    t.after(() => { controller.dispose(); context.subscriptions.forEach(d => d.dispose()); if (prior) Object.defineProperty(ui, "showOpenDialog", prior); else delete ui.showOpenDialog; });
    const call = (name: string, ...args: unknown[]) => { const fn = stub.registeredCommands.get("soterai." + name); assert(fn); return Promise.resolve(fn(...args)); }; return { controller, context, root, ui, call };
}
test("F22f CI commands register without startup scan, authentication or key creation", async t => {
    const f = await fixture(t); for (const name of names) assert(stub.registeredCommands.has("soterai." + name)); assert.equal(await f.context.secrets.get("soterai.hygiene.hmacKey.v1"), undefined); assert.match(JSON.stringify(await f.call("ciSecretScannerStatus", PRIVATE)), /no config execution/);
});
test("F22f selected config command uses actual native file picker and ignores caller paths/content/approval", async t => {
    const f = await fixture(t), selected = stub.Uri.file(join(f.root, ".github/workflows/secret.yml")), docs: unknown[] = [];
    t.mock.method(f.ui, "showOpenDialog", async (options: any) => { assert.equal(options.canSelectMany, false); assert(options.filters["CI YAML"].includes("yml")); assert.deepEqual(options.filters["All files"], ["*"]); return [selected]; });
    t.mock.method(HygieneController.prototype, "reviewFile", async (uri: unknown) => { assert.equal(uri, selected); return { status: "ANALYZED", findings: [] }; }); t.mock.method(stub.workspace, "openTextDocument", async (value: any) => { assert.equal(typeof value.content, "string"); docs.push(value); return {} as never; });
    assert.equal((await f.call("reviewCiSecrets", { uri: PRIVATE, content: PRIVATE, approved: true }) as any).status, "ANALYZED"); assert.equal(docs.length, 1); assert(!JSON.stringify(docs).includes(PRIVATE));
});
test("F22f file picker cancellation and forged finding objects grant no read or mutation", async t => {
    const f = await fixture(t); let calls = 0; t.mock.method(HygieneController.prototype, "reviewFile", async () => { calls++; return {}; }); assert.equal((await f.call("reviewCiSecrets", { approved: true }) as any).status, "CANCELLED"); assert.equal(calls, 0);
    const id = "a".repeat(64); t.mock.method(HygieneController.prototype, "selections", () => [{ id, label: "Finding 1", provider: "unknown" }]); t.mock.method(stub.window, "showQuickPick", async () => ({ id, label: PRIVATE })); t.mock.method(HygieneController.prototype, "vaultFinding", async () => { calls++; return {}; });
    assert.equal((await f.call("reviewCiSecretVault", id, { approved: true }) as any).status, "CANCELLED"); assert.equal(calls, 0);
});
test("F22f migration and disclosure restoration use only actual current ordinal selections", async t => {
    const f = await fixture(t), id = "b".repeat(64); t.mock.method(HygieneController.prototype, "selections", () => [{ id, label: "Finding 1", provider: "unknown" }]); t.mock.method(stub.window, "showQuickPick", async (items: any) => items[0]);
    t.mock.method(HygieneController.prototype, "vaultFinding", async (value: string) => { assert.equal(value, id); return { status: "APPLIED" }; }); t.mock.method(HygieneController.prototype, "restoreFinding", async (value: string) => { assert.equal(value, id); return { status: "RESTORED" }; });
    assert.equal((await f.call("reviewCiSecretVault", PRIVATE) as any).status, "APPLIED"); assert.equal((await f.call("restoreCiSecretVault", PRIVATE) as any).status, "RESTORED");
});
test("F22f one pending native config flow and machine flag withdrawal invalidate late picker", async t => {
    const f = await fixture(t); let entered!: () => void, finish!: (v: unknown) => void, calls = 0; const reached = new Promise<void>(r => entered = r);
    t.mock.method(f.ui, "showOpenDialog", async () => { entered(); return new Promise(r => finish = r); }); t.mock.method(HygieneController.prototype, "reviewFile", async () => { calls++; return {}; }); const pending = f.call("reviewCiSecrets"); await reached;
    assert.equal((await f.call("reviewWorkspaceCiSecrets") as any).status, "UNAVAILABLE"); stub.state.configInspect.set("soterai.lite.configScanner.ci", { globalValue: false, workspaceValue: true }); finish([stub.Uri.file(join(f.root, ".github/workflows/secret.yml"))]); assert.equal((await pending as any).status, "UNAVAILABLE"); assert.equal(calls, 0);
});
test("F22f manifests contribute machine/restricted family flag, five advanced commands without new runtime dependency", () => {
    for (const file of ["packages/vscode-extension/package.json", "packages/soterai-lite/package.json"]) {
        const p = JSON.parse(readFileSync(resolve(__dirname, "../../../..", file), "utf8")), flag = "soterai.lite.configScanner.ci", setting = p.contributes.configuration.properties[flag]; assert.equal(setting?.scope, "machine"); assert.equal(setting?.default, true); assert.equal(setting?.type, "boolean"); assert(p.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(flag));
        for (const name of names) { const id = "soterai." + name; assert(p.contributes.commands.some((c: any) => c.command === id)); assert(p.contributes.menus.commandPalette.some((c: any) => c.command === id && c.when === "soterai.advancedCommands")); }
    }
    assert.match(readFileSync(resolve(__dirname, "../extension.ts"), "utf8"), /registerCiScanner\(context\)/);
});
