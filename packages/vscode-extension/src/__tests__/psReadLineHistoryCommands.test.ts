import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import * as stub from "./phase2/vscode-stub";

const flag = "soterai.lite.historyHooks.psReadLine", privateArg = "FAKE_ONLY_F26C_CALLER_NOT_AUTHORITY_19ac";
const ids = ["soterai.installPSReadLineHistoryGuard", "soterai.restorePSReadLineHistoryGuard", "soterai.psReadLineHistoryGuardStatus"];
async function fixture(t: TestContext) {
    stub.resetState("C:\\Synthetic F26c Commands\\workspace");
    stub.state.configInspect.set(flag, { defaultValue: false, globalValue: true, workspaceValue: false });
    const context = stub.makeExtensionContext("C:\\Synthetic F26c Commands\\profile");
    const module = await import("../history-hooks/psReadLineCommands"), controllerModule = await import("../history-hooks/PSReadLineHistoryController");
    const priorProvider = Object.getOwnPropertyDescriptor(stub.workspace, "registerTextDocumentContentProvider");
    Object.defineProperty(stub.workspace, "registerTextDocumentContentProvider", { configurable: true, value: () => ({ dispose() {} }) });
    t.after(() => { if (priorProvider) Object.defineProperty(stub.workspace, "registerTextDocumentContentProvider", priorProvider); else Reflect.deleteProperty(stub.workspace, "registerTextDocumentContentProvider"); });
    const config = new stub.EventEmitter<{ affectsConfiguration(name: string): boolean }>(), folders = new stub.EventEmitter<unknown>();
    t.mock.method(stub.workspace, "onDidChangeConfiguration", config.event as never); t.mock.method(stub.workspace, "onDidChangeWorkspaceFolders", folders.event as never);
    let keys = 0; t.mock.method(context.secrets, "get", async () => { keys++; throw Error(privateArg); }); t.mock.method(context.secrets, "store", async () => { keys++; throw Error(privateArg); });
    const controller = module.registerPSReadLineHistory(context as never);
    t.after(() => { context.subscriptions.forEach(d => d.dispose()); controller.dispose(); config.dispose(); folders.dispose(); });
    // A queued invocation can retain a handler after VS Code unregisters it.
    const handlers = new Map(ids.map(id => [id, stub.registeredCommands.get(id)]));
    const call = (id: string, ...args: unknown[]) => { const handler = handlers.get(id); assert(handler); return Promise.resolve(handler(...args)) as Promise<{ status: string }>; };
    return { context, controller, proto: controllerModule.PSReadLineHistoryController.prototype, call, config, folders, get keys() { return keys; } };
}

test("F26c commands register exact owner actions without key or profile activity", async t => {
    const f = await fixture(t); for (const id of ids) assert(stub.registeredCommands.has(id)); assert.equal(f.keys, 0);
    const status = await f.call(ids[2]) as unknown as { badge: string }; assert.equal(status.badge, "Uncovered"); assert.equal(f.keys, 0);
});

test("F26c command caller arguments never reach install or restore authority", async t => {
    const f = await fixture(t), observed: unknown[][] = [];
    t.mock.method(f.proto, "install", async (...args: unknown[]) => { observed.push(args); return Object.freeze({ status: "APPLIED" as const }); });
    t.mock.method(f.proto, "restore", async (...args: unknown[]) => { observed.push(args); return Object.freeze({ status: "RESTORED" as const }); });
    assert.equal((await f.call(ids[0], { path: privateArg, approved: true }, privateArg)).status, "APPLIED");
    assert.equal((await f.call(ids[1], { before: privateArg }, true)).status, "RESTORED"); assert.deepEqual(observed, [[], []]); assert.equal(f.keys, 0);
});

test("F26c command exceptions and unexpected result fields cannot publish private caller text", async t => {
    const f = await fixture(t); t.mock.method(f.proto, "install", async () => { throw Error(privateArg); });
    let result = await f.call(ids[0], privateArg); assert.deepEqual(result, { status: "UNAVAILABLE" }); assert(Object.isFrozen(result));
    t.mock.method(f.proto, "restore", async () => ({ status: "RESTORED", private: privateArg } as never));
    result = await f.call(ids[1], privateArg); assert.deepEqual(result, { status: "RESTORED" }); assert(!JSON.stringify(result).includes(privateArg));
});

test("F26c command single pending review refuses another mutation", async t => {
    const f = await fixture(t); let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
    t.mock.method(f.proto, "install", async () => { await waiting; return Object.freeze({ status: "CANCELLED" as const }); });
    const first = f.call(ids[0]); assert.equal((await f.call(ids[1])).status, "UNAVAILABLE"); release(); assert.equal((await first).status, "CANCELLED");
});

test("F26c command flag-off rejects install but permits explicit reviewed restore", async t => {
    const f = await fixture(t); stub.state.configInspect.set(flag, { defaultValue: false, globalValue: false, workspaceValue: true }); let installs = 0;
    t.mock.method(f.proto, "install", async () => { installs++; return Object.freeze({ status: "APPLIED" as const }); });
    t.mock.method(f.proto, "restore", async () => Object.freeze({ status: "RESTORED" as const }));
    assert.equal((await f.call(ids[0])).status, "UNAVAILABLE"); assert.equal(installs, 0); assert.equal((await f.call(ids[1])).status, "RESTORED");
});

test("F26c configuration and folder events withdraw reviews; disposed commands stay unavailable", async t => {
    const f = await fixture(t); let withdrawals = 0; t.mock.method(f.proto, "withdraw", () => { withdrawals++; });
    f.config.fire({ affectsConfiguration: name => name === "soterai" }); f.folders.fire({}); assert.equal(withdrawals, 2);
    f.context.subscriptions.forEach(d => d.dispose()); assert.equal((await f.call(ids[0])).status, "UNAVAILABLE"); assert.equal((await f.call(ids[1])).status, "UNAVAILABLE");
});

test("F26c flag withdrawal while command awaits cannot publish a late APPLIED result", async t => {
    const f = await fixture(t); t.mock.method(f.proto, "install", async () => {
        stub.state.configInspect.set(flag, { defaultValue: false, globalValue: false }); return Object.freeze({ status: "APPLIED" as const });
    });
    assert.equal((await f.call(ids[0])).status, "UNAVAILABLE");
});

test("F26c manifests make history profile writes machine-only restricted and off by default", () => {
    for (const location of ["../../../soterai-lite/package.json", "../../package.json"]) {
        const manifest = JSON.parse(readFileSync(require.resolve(location), "utf8"));
        const property = manifest.contributes.configuration.properties[flag]; assert(property); assert.equal(property.type, "boolean"); assert.equal(property.default, false); assert.equal(property.scope, "machine");
        assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(flag));
        for (const id of ids) { assert.equal(manifest.contributes.commands.filter((row: { command: string }) => row.command === id).length, 1); assert(manifest.contributes.menus.commandPalette.some((row: { command: string; when: string }) => row.command === id && row.when.includes("soterai.advancedCommands"))); }
    }
});

test("F26c activation registers owner commands through the feature module", () => {
    const source = readFileSync(require.resolve("../extension.ts"), "utf8");
    assert(source.includes('from "./history-hooks/psReadLineCommands"')); assert(source.includes("registerPSReadLineHistory(context)"));
});
