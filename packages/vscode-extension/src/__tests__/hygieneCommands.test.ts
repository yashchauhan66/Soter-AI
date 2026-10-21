import "./phase2/register.mjs";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import * as stub from "./phase2/vscode-stub";
import { HygieneController } from "../hygiene/HygieneController";
const names = ["reviewWorkspaceHygiene", "reviewSelectedFileHygiene", "reviewHygieneVault", "generateHygieneEnvExample", "restoreHygieneVault", "openHygieneExposureLedger", "exportHygieneExposureLedger", "openHygieneRotationChecklist", "hygieneStatus"];
const PRIVATE = "F21_NATIVE_CALLER_PRIVATE_NOT_APPROVAL";
async function fixture(t: TestContext) {
    const dir = await mkdtemp("D:\\SoterAI-Lite-test-profiles\\f21-native-commands-"), root = join(dir, "project"); await mkdir(root); stub.resetState(root);
    const context = stub.makeExtensionContext(join(dir, "storage")), ui = stub.window as any;
    const prior = Object.getOwnPropertyDescriptor(ui, "showOpenDialog"); Object.defineProperty(ui, "showOpenDialog", { configurable: true, value: async () => undefined, writable: true });
    const { registerHygieneAssistant } = await import("../hygiene/commands"); const controller = registerHygieneAssistant(context as never);
    t.after(() => { controller.dispose(); context.subscriptions.forEach(d => d.dispose()); if (prior) Object.defineProperty(ui, "showOpenDialog", prior); else delete ui.showOpenDialog; });
    const call = (name: string, ...args: unknown[]) => { const handler = stub.registeredCommands.get("soterai." + name); assert(handler); return Promise.resolve(handler(...args)); };
    return { controller, context, ui, root, call };
}
test("F21 native command registration does no startup scan or key creation", async t => {
    const f = await fixture(t); for (const name of names) assert(stub.registeredCommands.has("soterai." + name));
    assert.equal(await f.context.secrets.get("soterai.hygiene.hmacKey.v1"), undefined); assert.match(JSON.stringify(await f.call("hygieneStatus", PRIVATE)), /OWNER_REVIEW_REQUIRED/);
});
test("F21 selected-file command ignores caller URI/content/approval and uses the actual picker", async t => {
    const f = await fixture(t), target = stub.Uri.file(join(f.root, "selected.env")); let called = 0;
    t.mock.method(f.ui, "showOpenDialog", async (options: any) => { assert.equal(options.canSelectMany, false); assert.equal(options.canSelectFiles, true); return [target]; });
    t.mock.method(HygieneController.prototype, "reviewFile", async (uri: unknown) => { called++; assert.equal(uri, target); return { status: "ANALYZED", findings: [] }; });
    const result = await f.call("reviewSelectedFileHygiene", stub.Uri.file("C:\\foreign.env"), { text: PRIVATE, approved: true }); assert.equal(called, 1); assert(!JSON.stringify(result).includes(PRIVATE));
});
test("F21 file-picker cancellation grants no content-read authority", async t => {
    const f = await fixture(t); let calls = 0; t.mock.method(HygieneController.prototype, "reviewFile", async () => { calls++; return {}; });
    assert.equal((await f.call("reviewSelectedFileHygiene", { approved: true }) as any).status, "CANCELLED"); assert.equal(calls, 0);
});
test("F21 action selection uses only an actual current native ordinal item", async t => {
    const f = await fixture(t), id = "a".repeat(64); let selected = false, calls = 0;
    t.mock.method(HygieneController.prototype, "selections", () => [{ id, label: "Finding 1 · api-key", provider: "unknown" }]);
    t.mock.method(stub.window, "showQuickPick", async (items: any) => selected ? items[0] : { label: PRIVATE, id });
    t.mock.method(HygieneController.prototype, "vaultFinding", async (value: string) => { calls++; assert.equal(value, id); return { status: "APPLIED" }; });
    assert.equal((await f.call("reviewHygieneVault", id, { approved: true }) as any).status, "CANCELLED"); assert.equal(calls, 0);
    selected = true; assert.equal((await f.call("reviewHygieneVault", PRIVATE) as any).status, "APPLIED"); assert.equal(calls, 1);
});
test("F21 one pending native flow and flag withdrawal invalidate a late picker", async t => {
    const f = await fixture(t); let entered!: () => void, finish!: (v: unknown) => void, calls = 0; const reached = new Promise<void>(r => entered = r);
    t.mock.method(f.ui, "showOpenDialog", async () => { entered(); return new Promise(r => finish = r); }); t.mock.method(HygieneController.prototype, "reviewFile", async () => { calls++; return {}; });
    const pending = f.call("reviewSelectedFileHygiene"); await reached; assert.equal((await f.call("reviewSelectedFileHygiene") as any).status, "UNAVAILABLE");
    stub.state.configInspect.set("soterai.lite.hygieneAssistant", { defaultValue: true, globalValue: false, workspaceValue: true }); finish([stub.Uri.file(join(f.root, ".env"))]); assert.equal((await pending as any).status, "UNAVAILABLE"); assert.equal(calls, 0);
});
test("F21 ledger and manual checklist documents use safe in-memory content; caller labels cannot select providers", async t => {
    const f = await fixture(t), docs: any[] = []; t.mock.method(HygieneController.prototype, "exposures", async () => ({ version: 1, rows: [], assessment: "Possible exposure only" }));
    t.mock.method(stub.workspace, "openTextDocument", async (value: any) => { assert.equal(typeof value.content, "string"); assert(!JSON.stringify(value).includes(PRIVATE)); docs.push(value); return { getText: () => value.content } as any; });
    t.mock.method(stub.window, "showQuickPick", async (items: any) => items[0]); await f.call("openHygieneExposureLedger", PRIVATE); const rotation: any = await f.call("openHygieneRotationChecklist", { provider: PRIVATE, apiKey: PRIVATE, approved: true });
    assert.equal(rotation.status, "NOT_PERFORMED"); assert.equal(rotation.provider, "openai"); assert.equal(docs.length, 2);
});
test("F21 hygiene setting is default-on machine/restricted and every advanced command is contributed and activated", () => {
    for (const file of ["packages/vscode-extension/package.json", "packages/soterai-lite/package.json"]) { const p = JSON.parse(readFileSync(resolve(__dirname, "../../../..", file), "utf8"));
        assert.deepEqual(p.contributes.configuration.properties["soterai.lite.hygieneAssistant"], { type: "boolean", default: true, scope: "machine", description: "Enable owner-reviewed local secret hygiene, canonical vault actions and possible-exposure metadata. Manual provider checklists do not rotate credentials." });
        assert(p.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.hygieneAssistant"));
        for (const name of names) { const id = "soterai." + name; assert(p.contributes.commands.some((c: any) => c.command === id && c.category === "SoterAI")); assert(p.contributes.menus.commandPalette.some((c: any) => c.command === id && c.when === "soterai.advancedCommands")); }
    }
    assert.match(readFileSync(resolve(__dirname, "../extension.ts"), "utf8"), /registerHygieneAssistant\(context\)/);
});
