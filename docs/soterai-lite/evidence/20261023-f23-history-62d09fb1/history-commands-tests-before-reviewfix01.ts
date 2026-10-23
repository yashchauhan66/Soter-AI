import "./phase2/register.mjs";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { mkdtemp, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState } from "../ai-boundary/BoundarySnapshot";

const FLAG = "soterai.lite.historyScanner", KEY = "soterai.hygiene.hmacKey.v1";
const PRIVATE = "TEST_ONLY_F23_PUBLIC_ARGS_ARE_NOT_AUTHORITY_093cabf8";
const names = ["reviewGitHistory", "historyScannerStatus"];
const result = () => Object.freeze({ status: "ANALYZED", commits: 1, files: 1, findings: [],
    skipped: { unsupported: 0, oversize: 0, binary: 0, analysis: 0, capped: false },
    guidance: "Rotate affected credentials and coordinate removal with the repository owner.",
    scope: "Bounded reachable local history; credential validity and AI access remain unverified." });
const safe = (value: unknown) => assert(!JSON.stringify(value).includes(PRIVATE));
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => resolve = done);
    return { promise, resolve };
}
async function bounded<T>(promise: PromiseLike<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([Promise.resolve(promise), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Error("Synthetic history UI stage was not reached.")), 2000);
    })]); } finally { clearTimeout(timer); }
}
async function fixture(t: TestContext) {
    // Retain all synthetic fixture directories. This suite never initializes or
    // inspects real history, launches a child, sends a signal or cleans up files.
    const base = await mkdtemp(join(tmpdir(), "soterai-f23-history-ui-")), root = join(base, "project");
    await mkdir(root); stub.resetState(root);
    const context = stub.makeExtensionContext(join(base, "profile"));
    initializeBoundaryState(context.workspaceState as never);
    const configuration = new stub.EventEmitter<{ affectsConfiguration(section: string): boolean }>();
    const folders = new stub.EventEmitter<unknown>();
    const remote = Object.getOwnPropertyDescriptor(stub.env, "remoteName");
    let reads = 0, children = 0, keyWrites = 0;
    const documents: unknown[] = [], shown: unknown[] = [];
    Object.defineProperty(stub.env, "remoteName", { configurable: true, value: undefined });
    t.mock.method(stub.workspace, "onDidChangeConfiguration", configuration.event as typeof stub.workspace.onDidChangeConfiguration);
    t.mock.method(stub.workspace, "onDidChangeWorkspaceFolders", folders.event as typeof stub.workspace.onDidChangeWorkspaceFolders);
    t.mock.method(stub.workspace.fs, "readFile", async () => { reads++; throw Error(PRIVATE); });
    t.mock.method(childProcess, "spawn", () => { children++; throw Error(PRIVATE); });
    const store = context.secrets.store.bind(context.secrets);
    t.mock.method(context.secrets, "store", async (key: string, value: string) => { keyWrites++; await store(key, value); });
    t.mock.method(stub.workspace, "openTextDocument", async (options: any) => { documents.push(options); return { metadataDocument: true } as never; });
    t.mock.method(stub.window, "showTextDocument", async (document: unknown) => { shown.push(document); return { document } as never; });
    let controller: { dispose(): void } | undefined;
    t.after(() => {
        controller?.dispose(); context.subscriptions.forEach(disposable => disposable.dispose());
        configuration.dispose(); folders.dispose();
        if (remote) Object.defineProperty(stub.env, "remoteName", remote); else delete (stub.env as any).remoteName;
    });
    // Import inside each case so a missing implementation is a test-first
    // missing-module failure, rather than a suite-level registration failure.
    const { registerHistoryScanner } = await import("../history/commands");
    const { HistoryController } = await import("../history/HistoryController");
    const registered = registerHistoryScanner(context as never); controller = registered;
    assert(registered instanceof HistoryController);
    const call = (name: string, ...args: unknown[]) => {
        const handler = stub.registeredCommands.get("soterai." + name); assert(handler);
        return bounded(Promise.resolve(handler(...args))) as Promise<any>;
    };
    const flag = (value: boolean) => {
        stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: value, workspaceValue: true });
        configuration.fire({ affectsConfiguration: section => section === "soterai" || section === FLAG || section === "soterai.lite" });
    };
    return { controller: registered, HistoryController, context, root, call, flag, configuration, folders, documents, shown,
        reads: () => reads, children: () => children, keyWrites: () => keyWrites };
}

test("F23 history registration and status create no startup history read, child, key or document", async t => {
    const f = await fixture(t);
    for (const name of names) assert(stub.registeredCommands.has("soterai." + name));
    const status = await f.call("historyScannerStatus", { root: PRIVATE, ref: PRIVATE, approved: true });
    assert.equal(status.status, "OWNER_REVIEW_REQUIRED"); assert.equal(status.busy, false); assert.equal(typeof status.scope, "string");
    assert.equal(await f.context.secrets.get(KEY), undefined); assert.equal(f.keyWrites(), 0);
    assert.equal(f.children(), 0); assert.equal(f.reads(), 0); assert.equal(f.documents.length, 0); assert.equal(f.shown.length, 0); safe(status);
});

test("F23 a new controller rejects forged, copied and cancelled result authority", async t => {
    const f = await fixture(t), forged = result();
    for (const value of [undefined, null, false, PRIVATE, forged, { ...forged }, { status: "CANCELLED" }]) assert.equal(f.controller.current(value), false);
    f.controller.withdraw(); assert.equal(f.controller.current(forged), false);
    assert.equal((f.controller.status() as any).busy, false); assert.equal(f.children(), 0); assert.equal(f.keyWrites(), 0);
});

test("F23 native owner cancellation ignores public approval, path and ref before any key or Git child", async t => {
    const f = await fixture(t); let prompts = 0;
    const cancel = async (_message: string, ...rest: unknown[]) => {
        prompts++; assert(rest.some(value => !!value && typeof value === "object" && (value as any).modal === true)); return undefined;
    };
    t.mock.method(stub.window, "showWarningMessage", cancel); t.mock.method(stub.window, "showInformationMessage", cancel);
    const cancelled = await f.call("reviewGitHistory", { approved: true, root: PRIVATE, ref: PRIVATE, text: PRIVATE }, true);
    assert.equal(cancelled.status, "CANCELLED"); assert.equal(prompts, 1); assert.equal(f.controller.current(cancelled), false);
    assert.equal(f.keyWrites(), 0); assert.equal(await f.context.secrets.get(KEY), undefined); assert.equal(f.children(), 0);
    assert.equal(f.documents.length, 0); assert.equal(f.shown.length, 0); safe(cancelled); safe(stub.capturedText());
});

test("F23 one native owner prompt remains pending while status is side effect free and another review is refused", async t => {
    const f = await fixture(t), entered = deferred<void>(), choice = deferred<undefined>(); let prompts = 0;
    const prompt = async () => { prompts++; entered.resolve(); return choice.promise; };
    t.mock.method(stub.window, "showWarningMessage", prompt); t.mock.method(stub.window, "showInformationMessage", prompt);
    const pending = f.call("reviewGitHistory"); await bounded(entered.promise);
    assert.equal((await f.call("historyScannerStatus")).busy, true);
    assert.equal((await f.call("reviewGitHistory", { approved: true })).status, "UNAVAILABLE");
    assert.equal(prompts, 1); assert.equal(f.children(), 0); assert.equal(f.keyWrites(), 0); assert.equal(f.documents.length, 0);
    choice.resolve(undefined); assert.equal((await pending).status, "CANCELLED"); assert.equal((await f.call("historyScannerStatus")).busy, false);
});

test("F23 public review arguments never reach the controller and only current metadata becomes a JSON document", async t => {
    const f = await fixture(t), reviewed = result(); let reviews = 0, validations = 0;
    t.mock.method(f.HistoryController.prototype, "review", async (...args: unknown[]) => { reviews++; assert.deepEqual(args, []); return reviewed as any; });
    t.mock.method(f.HistoryController.prototype, "current", (value: unknown) => { validations++; assert.equal(value, reviewed); return true; });
    assert.equal(await f.call("reviewGitHistory", PRIVATE, { root: PRIVATE, ref: PRIVATE, approved: true }, true), reviewed);
    assert.equal(reviews, 1); assert(validations >= 2); assert.equal(f.documents.length, 1); assert.equal(f.shown.length, 1);
    const document = f.documents[0] as any; assert.equal(document.language, "json"); assert.deepEqual(JSON.parse(document.content), reviewed);
    assert.equal(typeof document, "object"); assert.equal(document.uri, undefined); safe(f.documents); safe(stub.capturedText());
});

test("F23 an analyzed-looking result rejected by current never opens a metadata document", async t => {
    const f = await fixture(t), reviewed = result(); let validations = 0;
    t.mock.method(f.HistoryController.prototype, "review", async () => reviewed as any);
    t.mock.method(f.HistoryController.prototype, "current", (value: unknown) => { validations++; assert.equal(value, reviewed); return false; });
    await f.call("reviewGitHistory"); assert(validations >= 1); assert.equal(f.documents.length, 0); assert.equal(f.shown.length, 0);
});

test("F23 cancellation is returned to the caller without creating a document", async t => {
    const f = await fixture(t), cancelled = { status: "CANCELLED" };
    t.mock.method(f.HistoryController.prototype, "review", async () => cancelled as any);
    const returned = await f.call("reviewGitHistory"); assert.equal(returned.status, "CANCELLED");
    assert.equal(f.controller.current(returned), false); assert.equal(f.documents.length, 0); assert.equal(f.shown.length, 0);
});

test("F23 command registration permits one pending review even when a controller review is awaiting", async t => {
    const f = await fixture(t), entered = deferred<void>(), completion = deferred<any>(); let calls = 0;
    t.mock.method(f.HistoryController.prototype, "review", async () => { calls++; entered.resolve(); return completion.promise; });
    const pending = f.call("reviewGitHistory"); await bounded(entered.promise);
    assert.equal((await f.call("reviewGitHistory", PRIVATE)).status, "UNAVAILABLE"); assert.equal(calls, 1);
    completion.resolve({ status: "CANCELLED" }); assert.equal((await pending).status, "CANCELLED"); assert.equal(f.documents.length, 0);
});

test("F23 a completed cancelled review releases the command guard for a fresh native flow", async t => {
    const f = await fixture(t); let calls = 0;
    t.mock.method(f.HistoryController.prototype, "review", async () => { calls++; return { status: "CANCELLED" } as any; });
    assert.equal((await f.call("reviewGitHistory")).status, "CANCELLED"); assert.equal((await f.call("reviewGitHistory")).status, "CANCELLED");
    assert.equal(calls, 2); assert.equal(f.documents.length, 0);
});

test("F23 private controller errors produce a static unavailable result and release the pending guard", async t => {
    const f = await fixture(t); let calls = 0;
    t.mock.method(f.HistoryController.prototype, "review", async () => { calls++; if (calls === 1) throw Error(PRIVATE); return { status: "CANCELLED" } as any; });
    const failed = await f.call("reviewGitHistory", PRIVATE); assert.equal(failed.status, "UNAVAILABLE"); safe(failed); safe(stub.capturedText());
    assert.equal((await f.call("reviewGitHistory")).status, "CANCELLED"); assert.equal(calls, 2); assert.equal(f.documents.length, 0);
});

test("F23 metadata-document failure is sanitized and never displays a partial document", async t => {
    const f = await fixture(t), reviewed = result();
    t.mock.method(f.HistoryController.prototype, "review", async () => reviewed as any);
    t.mock.method(f.HistoryController.prototype, "current", (value: unknown) => value === reviewed);
    t.mock.method(stub.workspace, "openTextDocument", async () => { throw Error(PRIVATE); });
    const failed = await f.call("reviewGitHistory"); assert.equal(failed.status, "UNAVAILABLE"); assert.equal(f.shown.length, 0); safe(failed); safe(stub.capturedText());
});

test("F23 authority is checked again after opening metadata and before display", async t => {
    const f = await fixture(t), reviewed = result(), entered = deferred<void>(), document = deferred<any>(); let current = true, checks = 0;
    t.mock.method(f.HistoryController.prototype, "review", async () => reviewed as any);
    t.mock.method(f.HistoryController.prototype, "current", (value: unknown) => { checks++; return value === reviewed && current; });
    t.mock.method(stub.workspace, "openTextDocument", async () => { entered.resolve(); return document.promise; });
    const pending = f.call("reviewGitHistory"); await bounded(entered.promise); current = false;
    document.resolve({ metadataDocument: true }); await pending; assert(checks >= 2); assert.equal(f.shown.length, 0);
});

test("F23 disable then reenable cannot display a withdrawn metadata result waiting on a document", async t => {
    const f = await fixture(t), reviewed = result(), entered = deferred<void>(), document = deferred<any>(); let live = true, withdrawals = 0;
    const withdraw = f.controller.withdraw.bind(f.controller);
    // UI-only identity oracle: real configuration listeners must invoke the
    // public withdrawal hook; successful scanner publication is tested apart.
    t.mock.method(f.controller, "withdraw", () => { withdrawals++; live = false; withdraw(); });
    t.mock.method(f.HistoryController.prototype, "review", async () => reviewed as any);
    t.mock.method(f.HistoryController.prototype, "current", (value: unknown) => value === reviewed && live);
    t.mock.method(stub.workspace, "openTextDocument", async () => { entered.resolve(); return document.promise; });
    const pending = f.call("reviewGitHistory"); await bounded(entered.promise); f.flag(false);
    assert.equal((f.controller.status() as any).status, "UNAVAILABLE"); f.flag(true);
    assert.equal((f.controller.status() as any).status, "OWNER_REVIEW_REQUIRED"); assert(withdrawals >= 1);
    document.resolve({ metadataDocument: true }); await pending; assert.equal(f.shown.length, 0); assert.equal(f.controller.current(reviewed), false);
});

test("F23 workspace replacement withdraws pending metadata authority", async t => {
    const f = await fixture(t), reviewed = result(), entered = deferred<void>(), document = deferred<any>(); let live = true;
    const withdraw = f.controller.withdraw.bind(f.controller);
    t.mock.method(f.controller, "withdraw", () => { live = false; withdraw(); });
    t.mock.method(f.HistoryController.prototype, "review", async () => reviewed as any);
    t.mock.method(f.HistoryController.prototype, "current", (value: unknown) => value === reviewed && live);
    t.mock.method(stub.workspace, "openTextDocument", async () => { entered.resolve(); return document.promise; });
    const pending = f.call("reviewGitHistory"); await bounded(entered.promise); f.folders.fire({});
    document.resolve({ metadataDocument: true }); await pending; assert.equal(live, false); assert.equal(f.shown.length, 0);
});

test("F23 disposing command subscriptions suppresses a late review result and unregisters both commands", async t => {
    const f = await fixture(t), reviewed = result(), entered = deferred<void>(), completion = deferred<any>();
    t.mock.method(f.HistoryController.prototype, "review", async () => { entered.resolve(); return completion.promise; });
    // A disposed registration must also guard UI independently of this mocked
    // publication oracle, even if the completed work supplies an old result.
    t.mock.method(f.HistoryController.prototype, "current", (value: unknown) => value === reviewed);
    const pending = f.call("reviewGitHistory"); await bounded(entered.promise);
    f.context.subscriptions.forEach(disposable => disposable.dispose()); completion.resolve(reviewed); await pending;
    for (const name of names) assert(!stub.registeredCommands.has("soterai." + name));
    assert.equal((f.controller.status() as any).status, "UNAVAILABLE"); assert.equal(f.documents.length, 0); assert.equal(f.shown.length, 0);
});

test("F23 disposing subscriptions during document creation prevents late display", async t => {
    const f = await fixture(t), reviewed = result(), entered = deferred<void>(), document = deferred<any>();
    t.mock.method(f.HistoryController.prototype, "review", async () => reviewed as any);
    t.mock.method(f.HistoryController.prototype, "current", (value: unknown) => value === reviewed);
    t.mock.method(stub.workspace, "openTextDocument", async () => { entered.resolve(); return document.promise; });
    const pending = f.call("reviewGitHistory"); await bounded(entered.promise);
    f.context.subscriptions.forEach(disposable => disposable.dispose()); document.resolve({ metadataDocument: true }); await pending;
    assert.equal(f.shown.length, 0);
});

test("F23 owner disable refuses public review arguments before calling the controller", async t => {
    const f = await fixture(t); let calls = 0; f.flag(false);
    t.mock.method(f.HistoryController.prototype, "review", async () => { calls++; return result() as any; });
    assert.equal((await f.call("reviewGitHistory", { approved: true, enabled: true, root: PRIVATE })).status, "UNAVAILABLE");
    assert.equal((await f.call("historyScannerStatus")).status, "UNAVAILABLE"); assert.equal(calls, 0);
    assert.equal(f.documents.length, 0); assert.equal(f.children(), 0); assert.equal(f.keyWrites(), 0);
});

test("F23 strict history flag rejects nonboolean global enable values and an owner disable", async t => {
    await fixture(t); const { historyScannerEnabled } = await import("../history/HistoryFlags");
    for (const globalValue of [false, "true", "false", 1, 0, {}, []]) {
        stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue, workspaceValue: true, workspaceFolderValue: true });
        assert.equal(historyScannerEnabled(), false);
    }
    stub.state.configInspect.set(FLAG, { defaultValue: false, globalValue: true, workspaceValue: false }); assert.equal(historyScannerEnabled(), true);
});

test("F23 workspace and folder flag values have no power to change the owner or boolean default", async t => {
    await fixture(t); const { historyScannerEnabled } = await import("../history/HistoryFlags");
    stub.state.configInspect.set(FLAG, { defaultValue: true, workspaceValue: false, workspaceFolderValue: false }); assert.equal(historyScannerEnabled(), true);
    stub.state.configInspect.set(FLAG, { defaultValue: false, workspaceValue: true, workspaceFolderValue: true }); assert.equal(historyScannerEnabled(), false);
    stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: false, workspaceValue: true }); assert.equal(historyScannerEnabled(), false);
});

test("F23 strict history default accepts only booleans and ignores the merged workspace get fallback", async t => {
    await fixture(t); const { historyScannerEnabled } = await import("../history/HistoryFlags");
    for (const defaultValue of [false, "true", 1, {}]) {
        stub.state.configInspect.set(FLAG, { defaultValue, workspaceValue: true }); assert.equal(historyScannerEnabled(), false);
    }
    stub.state.configInspect.delete(FLAG); stub.state.config.set(FLAG, false); assert.equal(historyScannerEnabled(), true);
});

test("F23 untrusted and remote workspaces cannot enable history, and configuration errors fail closed", async t => {
    await fixture(t); const { historyScannerEnabled } = await import("../history/HistoryFlags");
    stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue: true }); stub.state.isTrusted = false; assert.equal(historyScannerEnabled(), false);
    stub.state.isTrusted = true; Object.defineProperty(stub.env, "remoteName", { configurable: true, value: "synthetic-remote" }); assert.equal(historyScannerEnabled(), false);
    Object.defineProperty(stub.env, "remoteName", { configurable: true, value: undefined });
    t.mock.method(stub.workspace, "getConfiguration", () => { throw Error(PRIVATE); }); assert.equal(historyScannerEnabled(), false);
});

test("F23 initial controller status withholds on absent, multiple or nonlocal workspace roots without IO", async t => {
    const f = await fixture(t), folder = stub.state.folders[0];
    for (const folders of [[], [folder, { ...folder, index: 1 }], [{ ...folder, uri: stub.Uri.parse("synthetic://remote/project") }]]) {
        stub.state.folders = folders; assert.equal((f.controller.status() as any).status, "UNAVAILABLE"); assert.equal(f.controller.current(result()), false);
    }
    stub.state.folders = [folder]; stub.state.isTrusted = false; assert.equal((f.controller.status() as any).status, "UNAVAILABLE");
    assert.equal(f.children(), 0); assert.equal(f.keyWrites(), 0); assert.equal(f.reads(), 0); assert.equal(f.documents.length, 0);
});

test("F23 disposing a real initial controller permanently withdraws status and forged result authority", async t => {
    const f = await fixture(t); f.controller.withdraw(); f.controller.dispose(); f.flag(false); f.flag(true);
    assert.equal((f.controller.status() as any).status, "UNAVAILABLE"); assert.equal(f.controller.current(result()), false);
    assert.equal(f.children(), 0); assert.equal(f.keyWrites(), 0); assert.equal(f.documents.length, 0);
});

test("F23 both manifests contribute only the two advanced history commands and the restricted machine flag", () => {
    for (const file of ["packages/vscode-extension/package.json", "packages/soterai-lite/package.json"]) {
        const manifest = JSON.parse(readFileSync(resolve(__dirname, "../../../..", file), "utf8"));
        const setting = manifest.contributes.configuration.properties[FLAG];
        assert.equal(setting?.scope, "machine"); assert.equal(setting?.default, true); assert.equal(setting?.type, "boolean");
        assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(FLAG));
        for (const name of names) {
            const command = "soterai." + name;
            assert.equal(manifest.contributes.commands.filter((entry: any) => entry.command === command).length, 1);
            const palette = manifest.contributes.menus.commandPalette.filter((entry: any) => entry.command === command);
            assert.equal(palette.length, 1); assert.equal(palette[0].when, "soterai.advancedCommands");
        }
    }
    assert.match(readFileSync(resolve(__dirname, "../extension.ts"), "utf8"), /registerHistoryScanner\(context\)/);
});
