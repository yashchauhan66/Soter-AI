import "./phase2/register.mjs";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState } from "../ai-boundary/BoundarySnapshot";

// TEST FIRST: phase2 editor doubles and controller prototype publication oracles.
// No filesystem fixtures, Git/hook/child, listener, native editor or real secrets.
// Actual owner review/transaction/service/provider behavior is tested separately.
const FLAG = "soterai.lite.historyHooks.preCommit";
const PRIVATE = "TEST_ONLY_F26A_COMMAND_ARGS_NOT_AUTHORITY_631cde42";
const ROOT = "C:\\Synthetic F26a Commands\\workspace";
const commands = ["installPreCommitGuard", "resumePreCommitGuard", "restorePreCommitGuard", "preCommitGuardStatus", "installGitSecretHook", "copyPreCommitHookScript"];
const mutations = ["installPreCommitGuard", "resumePreCommitGuard", "restorePreCommitGuard", "installGitSecretHook"];
const success = (status: "APPLIED" | "RESUMED" | "RESTORED") => Object.freeze({ status });
const cancelled = () => Object.freeze({ status: "CANCELLED" });
function safe(value: unknown): void { assert(!JSON.stringify(value).includes(PRIVATE), "Private caller arguments or raw errors cannot leave the fixed UI boundary."); }
function fixed(value: any, status: string): void {
    assert(value && Object.isFrozen(value), "Command lifecycle results must be frozen.");
    assert.deepEqual(Reflect.ownKeys(value), ["status"]); assert.equal(value.status, status); safe(value);
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

test("F31b excluded Lite release cannot install or resume pre-commit even with the machine flag and caller approval", async t => {
    const f = await fixture(t); f.flag(true); let grants = 0;
    Object.defineProperty(f.context, "extension", { configurable: true, value: { packageJSON: { soteraiLiteRelease: { unsupportedFeatures: ["preCommit"] } } } });
    t.mock.method(f.PreCommitController.prototype, "install", async () => { grants++; return success("APPLIED") as any; });
    t.mock.method(f.PreCommitController.prototype, "resume", async () => { grants++; return success("RESUMED") as any; });
    t.mock.method(f.PreCommitController.prototype, "current", () => true);
    for (const name of ["installPreCommitGuard", "installGitSecretHook", "resumePreCommitGuard"]) fixed(await f.call(name, { approved: true, enabled: true, unsupportedFeatures: [], root: PRIVATE }), "UNAVAILABLE");
    assert.equal(grants, 0); f.noIO();
});

test("F31b excluded Lite release retains explicit owned-hook recovery while disabled", async t => {
    const f = await fixture(t); f.flag(false); let restores = 0; const restored = success("RESTORED");
    Object.defineProperty(f.context, "extension", { configurable: true, value: { packageJSON: { soteraiLiteRelease: { unsupportedFeatures: ["preCommit"] } } } });
    t.mock.method(f.PreCommitController.prototype, "restore", async (...args: unknown[]) => { assert.deepEqual(args, []); restores++; return restored as any; });
    t.mock.method(f.PreCommitController.prototype, "current", (value: unknown) => value === restored);
    assert.equal(await f.call("restorePreCommitGuard", { root: PRIVATE, approved: true }), restored); assert.equal(restores, 1); f.noIO();
});

test("F31b unreadable release capability refuses new pre-commit grants without leaking metadata errors", async t => {
    const f = await fixture(t); f.flag(true); let grants = 0;
    Object.defineProperty(f.context, "extension", { configurable: true, get() { throw Error(PRIVATE); } });
    t.mock.method(f.PreCommitController.prototype, "install", async () => { grants++; return success("APPLIED") as any; });
    t.mock.method(f.PreCommitController.prototype, "current", () => true);
    fixed(await f.call("installPreCommitGuard"), "UNAVAILABLE"); assert.equal(grants, 0); f.noIO(); safe(stub.capturedText());
});
test("F26a explicitly enabled release delegates opt-in install and resume while recovery remains available", async t => {
    const f = await fixture(t); let installs = 0, resumes = 0, restores = 0;
    Object.defineProperty(f.context, "extension", { configurable: true, value: { packageJSON: { soteraiLiteRelease: { schemaVersion: 1, channel: "pre-release", unsupportedFeatures: [] } } } });
    t.mock.method(f.PreCommitController.prototype, "install", async (...args: unknown[]) => { assert.deepEqual(args, []); installs++; return success("APPLIED") as any; });
    t.mock.method(f.PreCommitController.prototype, "resume", async (...args: unknown[]) => { assert.deepEqual(args, []); resumes++; return success("RESUMED") as any; });
    t.mock.method(f.PreCommitController.prototype, "restore", async (...args: unknown[]) => { assert.deepEqual(args, []); restores++; return success("RESTORED") as any; });
    t.mock.method(f.PreCommitController.prototype, "current", () => true);
    fixed(await f.call("installPreCommitGuard", { approved: true }), "UNAVAILABLE");
    f.flag(true);
    fixed(await f.call("installPreCommitGuard", { approved: true, root: PRIVATE }), "APPLIED");
    fixed(await f.call("resumePreCommitGuard", { approved: true, root: PRIVATE }), "RESUMED");
    f.flag(false);
    fixed(await f.call("resumePreCommitGuard", { approved: true }), "UNAVAILABLE");
    fixed(await f.call("restorePreCommitGuard", { approved: true, root: PRIVATE }), "RESTORED");
    assert.deepEqual({ installs, resumes, restores }, { installs: 1, resumes: 1, restores: 1 }); f.noIO();
});
async function bounded<T>(promise: PromiseLike<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([Promise.resolve(promise), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Error("Synthetic pre-commit UI stage was not reached.")), 2000);
    })]); } finally { clearTimeout(timer); }
}
async function fixture(t: TestContext) {
    stub.resetState(ROOT);
    const context = stub.makeExtensionContext("C:\\Synthetic F26a Commands\\profile");
    initializeBoundaryState(context.workspaceState as never);
    const configuration = new stub.EventEmitter<{ affectsConfiguration(section: string): boolean }>();
    const folders = new stub.EventEmitter<unknown>();
    const remote = Object.getOwnPropertyDescriptor(stub.env, "remoteName");
    Object.defineProperty(stub.env, "remoteName", { configurable: true, value: undefined });
    t.mock.method(stub.workspace, "onDidChangeConfiguration", configuration.event as typeof stub.workspace.onDidChangeConfiguration);
    t.mock.method(stub.workspace, "onDidChangeWorkspaceFolders", folders.event as typeof stub.workspace.onDidChangeWorkspaceFolders);
    let controller: { dispose(): void } | undefined;
    t.after(() => {
        controller?.dispose(); context.subscriptions.forEach(disposable => disposable.dispose());
        configuration.dispose(); folders.dispose();
        if (remote) Object.defineProperty(stub.env, "remoteName", remote); else delete (stub.env as any).remoteName;
    });
    // Imports remain inside each case: an absent implementation is an individual
    // missing-module baseline, with no eager suite-level production dependency.
    const { registerPreCommitHooks } = await import("../history-hooks/commands");
    const { PreCommitController } = await import("../history-hooks/PreCommitController");
    const { preCommitHooksEnabled } = await import("../history-hooks/PreCommitFlags");
    const counts = { files: 0, keys: 0, children: 0, listeners: 0, clipboardReads: 0, clipboardWrites: 0, documents: 0 };
    const unavailable = () => { counts.files++; throw Error(PRIVATE); };
    t.mock.method(stub.workspace.fs, "readFile", async () => unavailable());
    t.mock.method(stub.workspace.fs, "writeFile", async () => unavailable());
    for (const name of ["readFileSync", "openSync", "lstatSync", "statSync", "realpathSync", "mkdirSync", "writeFileSync"] as const)
        t.mock.method(fs, name, unavailable as never);
    t.mock.method(childProcess, "spawn", (() => { counts.children++; throw Error(PRIVATE); }) as never);
    t.mock.method(childProcess, "execFile", (() => { counts.children++; throw Error(PRIVATE); }) as never);
    t.mock.method(net.Server.prototype, "listen", (() => { counts.listeners++; throw Error(PRIVATE); }) as never);
    t.mock.method(context.secrets, "get", async () => { counts.keys++; throw Error(PRIVATE); });
    t.mock.method(context.secrets, "store", async () => { counts.keys++; throw Error(PRIVATE); });
    t.mock.method(context.secrets, "delete", async () => { counts.keys++; throw Error(PRIVATE); });
    t.mock.method(stub.env.clipboard, "readText", async () => { counts.clipboardReads++; throw Error(PRIVATE); });
    t.mock.method(stub.env.clipboard, "writeText", async () => { counts.clipboardWrites++; throw Error(PRIVATE); });
    t.mock.method(stub.workspace, "openTextDocument", async () => { counts.documents++; throw Error(PRIVATE); });
    const registered = registerPreCommitHooks(context as never); controller = registered;
    assert(registered instanceof PreCommitController);
    const handler = (name: string) => { const value = stub.registeredCommands.get("soterai." + name); assert(value); return value; };
    const call = (name: string, ...args: unknown[]) => bounded(Promise.resolve(handler(name)(...args))) as Promise<any>;
    const flag = (value: boolean) => {
        stub.state.configInspect.set(FLAG, { defaultValue: false, globalValue: value, workspaceValue: !value, workspaceFolderValue: !value });
        configuration.fire({ affectsConfiguration: section => section === "soterai" || section === "soterai.lite" || section === FLAG });
    };
    const noIO = () => assert.deepEqual(counts, { files: 0, keys: 0, children: 0, listeners: 0, clipboardReads: 0, clipboardWrites: 0, documents: 0 });
    return { context, controller: registered, PreCommitController, preCommitHooksEnabled, counts, noIO, handler, call, flag, configuration, folders };
}

test("F26a registration and status are default-off frozen metadata without filesystem keys children or listeners", async t => {
    const f = await fixture(t);
    for (const name of commands) assert(stub.registeredCommands.has("soterai." + name));
    const status = await f.call("preCommitGuardStatus", PRIVATE, { approved: true, enabled: true, root: PRIVATE });
    assert(Object.isFrozen(status)); assert.equal(status.status, "UNAVAILABLE"); safe(status);
    f.flag(true); const enabled = await f.call("preCommitGuardStatus");
    assert(Object.isFrozen(enabled)); assert.equal(enabled.status, "OWNER_REVIEW_REQUIRED"); assert.equal(enabled.busy, false);
    f.noIO(); safe(stub.capturedText());
});

test("F26a install resume restore and legacy install ignore every public argument and validate completed result identity", async t => {
    const f = await fixture(t); f.flag(true); let checks = 0;
    const calls: string[] = [], values = { install: success("APPLIED"), resume: success("RESUMED"), restore: success("RESTORED") };
    for (const method of ["install", "resume", "restore"] as const) t.mock.method(f.PreCommitController.prototype, method, async (...args: unknown[]) => {
        assert.deepEqual(args, []); calls.push(method); return values[method] as any;
    });
    t.mock.method(f.PreCommitController.prototype, "current", (value: unknown) => { checks++; return Object.values(values).includes(value as any); });
    for (const [command, method] of [["installPreCommitGuard", "install"], ["resumePreCommitGuard", "resume"], ["restorePreCommitGuard", "restore"], ["installGitSecretHook", "install"]] as const)
        assert.equal(await f.call(command, PRIVATE, { root: PRIVATE, approved: true, enabled: true, pin: PRIVATE }, true), values[method]);
    assert.deepEqual(calls, ["install", "resume", "restore", "install"]); assert(checks >= 4); f.noIO(); safe(stub.capturedText());
});

test("F26a legacy copy gives fixed owning-editor guidance without clipboard access or executable hook text", async t => {
    const f = await fixture(t); let notices = 0;
    const notice = async (message: string) => {
        notices++; assert.equal(typeof message, "string"); assert(/pre-commit/i.test(message)); assert(/owning|owner|review/i.test(message));
        assert(!message.includes("#!/") && !message.includes("--pin") && !message.includes("env.exe") && !message.includes(PRIVATE)); return undefined;
    };
    t.mock.method(stub.window, "showInformationMessage", notice);
    t.mock.method(stub.window, "showWarningMessage", notice);
    for (const method of ["install", "resume", "restore"] as const) t.mock.method(f.PreCommitController.prototype, method, async () => { throw Error(PRIVATE); });
    fixed(await f.call("copyPreCommitHookScript", { root: PRIVATE, approved: true }, PRIVATE), "UNAVAILABLE");
    assert.equal(notices, 1); f.noIO(); safe(stub.capturedText());
});

test("F26a completed-looking APPLIED RESUMED RESTORED results are unavailable when current rejects them", async t => {
    const f = await fixture(t); f.flag(true); let checks = 0;
    t.mock.method(f.PreCommitController.prototype, "current", () => { checks++; return false; });
    for (const [command, method, status] of [["installPreCommitGuard", "install", "APPLIED"], ["resumePreCommitGuard", "resume", "RESUMED"], ["restorePreCommitGuard", "restore", "RESTORED"]] as const) {
        const completed = success(status); t.mock.method(f.PreCommitController.prototype, method, async () => completed as any);
        fixed(await f.call(command, { approved: true, root: PRIVATE }), "UNAVAILABLE");
    }
    assert(checks >= 3); f.noIO();
});

test("F26a all mutation commands share one pending lock while status remains side effect free", async t => {
    const f = await fixture(t); f.flag(true); const entered = deferred<void>(), completion = deferred<any>(); let installs = 0, others = 0;
    t.mock.method(f.PreCommitController.prototype, "install", async () => { installs++; entered.resolve(); return completion.promise; });
    for (const method of ["resume", "restore"] as const) t.mock.method(f.PreCommitController.prototype, method, async () => { others++; return cancelled() as any; });
    const pending = f.call("installPreCommitGuard"); await bounded(entered.promise);
    const status = await f.call("preCommitGuardStatus", { approved: true }); assert(Object.isFrozen(status)); safe(status);
    for (const command of mutations) fixed(await f.call(command, { approved: true, root: PRIVATE }), "UNAVAILABLE");
    assert.equal(installs, 1); assert.equal(others, 0); f.noIO();
    completion.resolve(cancelled()); fixed(await pending, "CANCELLED");
    fixed(await f.call("resumePreCommitGuard"), "CANCELLED"); assert.equal(others, 1);
});

test("F26a private controller and publication errors produce fixed unavailable results and release the pending lock", async t => {
    const f = await fixture(t); f.flag(true); let calls = 0, throwCurrent = false;
    t.mock.method(f.PreCommitController.prototype, "install", async () => { calls++; if (calls === 1) throw Error(PRIVATE); return throwCurrent ? success("APPLIED") as any : cancelled() as any; });
    t.mock.method(f.PreCommitController.prototype, "current", () => { if (throwCurrent) throw Error(PRIVATE); return true; });
    fixed(await f.call("installPreCommitGuard", PRIVATE), "UNAVAILABLE"); fixed(await f.call("installPreCommitGuard"), "CANCELLED");
    throwCurrent = true; fixed(await f.call("installPreCommitGuard"), "UNAVAILABLE"); throwCurrent = false;
    fixed(await f.call("installPreCommitGuard"), "CANCELLED"); assert.equal(calls, 4); f.noIO(); safe(stub.capturedText());
});

test("F26a flag-off install and resume refuse caller overrides while explicit reviewed restore remains callable", async t => {
    const f = await fixture(t); f.flag(false); let install = 0, resume = 0, restore = 0;
    t.mock.method(f.PreCommitController.prototype, "install", async () => { install++; return success("APPLIED") as any; });
    t.mock.method(f.PreCommitController.prototype, "resume", async () => { resume++; return success("RESUMED") as any; });
    const restored = success("RESTORED"); t.mock.method(f.PreCommitController.prototype, "restore", async (...args: unknown[]) => { assert.deepEqual(args, []); restore++; return restored as any; });
    t.mock.method(f.PreCommitController.prototype, "current", (value: unknown) => value === restored);
    for (const command of ["installPreCommitGuard", "installGitSecretHook", "resumePreCommitGuard"]) fixed(await f.call(command, { approved: true, enabled: true, root: PRIVATE }), "UNAVAILABLE");
    assert.equal(await f.call("restorePreCommitGuard", { root: PRIVATE, approved: true }), restored);
    assert.equal(install, 0); assert.equal(resume, 0); assert.equal(restore, 1); f.noIO();
});

test("F26a disposed registrations suppress late success unregister every command and refuse retained handlers", async t => {
    const f = await fixture(t); f.flag(true); const entered = deferred<void>(), completion = deferred<any>(), applied = success("APPLIED"); let calls = 0;
    t.mock.method(f.PreCommitController.prototype, "install", async () => { calls++; entered.resolve(); return completion.promise; });
    t.mock.method(f.PreCommitController.prototype, "current", (value: unknown) => value === applied);
    const retained = mutations.map(command => f.handler(command)), pending = f.call("installPreCommitGuard"); await bounded(entered.promise);
    f.context.subscriptions.forEach(disposable => disposable.dispose()); completion.resolve(applied); fixed(await pending, "UNAVAILABLE");
    for (const name of commands) assert(!stub.registeredCommands.has("soterai." + name));
    for (const handler of retained) fixed(await bounded(Promise.resolve(handler({ approved: true, root: PRIVATE }))), "UNAVAILABLE");
    assert.equal(calls, 1); assert.equal(f.controller.status().status, "UNAVAILABLE"); f.noIO();
});

test("F26a initial withdrawn or disposed controller cannot authenticate forged copied or cancelled lifecycle results", async t => {
    const f = await fixture(t); f.flag(true); const applied = success("APPLIED");
    for (const value of [undefined, null, false, PRIVATE, applied, { ...applied }, success("RESUMED"), success("RESTORED"), cancelled()]) assert.equal(f.controller.current(value), false);
    f.controller.withdraw(); assert.equal(f.controller.current(applied), false); f.controller.dispose(); f.flag(false); f.flag(true);
    assert.equal(f.controller.status().status, "UNAVAILABLE"); assert.equal(f.controller.current(applied), false); f.noIO();
});

test("F26a actual configuration and workspace listeners withdraw controller authority without resource I/O", async t => {
    const f = await fixture(t); f.flag(true); let withdrawals = 0;
    const original = f.controller.withdraw.bind(f.controller);
    t.mock.method(f.controller, "withdraw", () => { withdrawals++; original(); });
    f.flag(false); assert(withdrawals >= 1); assert.equal(f.controller.status().status, "UNAVAILABLE");
    f.flag(true); const beforeFolders = withdrawals; f.folders.fire({}); assert(withdrawals > beforeFolders);
    assert.equal(f.controller.current(success("APPLIED")), false); f.noIO();
});

test("F26a initial status withholds absent multiple or nonlocal roots without filesystem key child or listener access", async t => {
    const f = await fixture(t); f.flag(true); const folder = stub.state.folders[0];
    for (const folders of [[], [folder, { ...folder, index: 1 }], [{ ...folder, uri: stub.Uri.parse("synthetic://remote/project") }]]) {
        stub.state.folders = folders; const status = f.controller.status(); assert(Object.isFrozen(status)); assert.equal(status.status, "UNAVAILABLE");
        assert.equal(f.controller.current(success("APPLIED")), false); safe(status);
    }
    f.noIO();
});

test("F26a strict owner flag accepts only global boolean true and an explicit false defeats the default", async t => {
    const f = await fixture(t);
    for (const globalValue of [false, "true", "false", 1, 0, null, {}, []]) {
        stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue, workspaceValue: true, workspaceFolderValue: true });
        assert.equal(f.preCommitHooksEnabled(), false);
    }
    stub.state.configInspect.set(FLAG, { defaultValue: false, globalValue: true, workspaceValue: false }); assert.equal(f.preCommitHooksEnabled(), true); f.noIO();
});

test("F26a missing inspect and nonboolean defaults fail closed without using merged get values", async t => {
    const f = await fixture(t);
    for (const defaultValue of [undefined, false, "true", 1, null, {}, []]) {
        stub.state.configInspect.set(FLAG, { defaultValue, workspaceValue: true, workspaceFolderValue: true }); assert.equal(f.preCommitHooksEnabled(), false);
    }
    stub.state.configInspect.delete(FLAG); stub.state.config.set(FLAG, true); assert.equal(f.preCommitHooksEnabled(), false);
    stub.state.configInspect.set(FLAG, { defaultValue: true }); assert.equal(f.preCommitHooksEnabled(), true); f.noIO();
});

test("F26a workspace and folder values cannot grant or revoke the strict machine owner or boolean default", async t => {
    const f = await fixture(t);
    for (const [entry, expected] of [
        [{ defaultValue: false, workspaceValue: true, workspaceFolderValue: true }, false],
        [{ defaultValue: true, workspaceValue: false, workspaceFolderValue: false }, true],
        [{ defaultValue: false, globalValue: true, workspaceValue: false, workspaceFolderValue: false }, true],
        [{ defaultValue: true, globalValue: false, workspaceValue: true, workspaceFolderValue: true }, false],
    ] as const) { stub.state.configInspect.set(FLAG, entry); assert.equal(f.preCommitHooksEnabled(), expected); }
    f.noIO();
});

test("F26a untrusted and remote environments cannot enable a globally approved owner hook", async t => {
    const f = await fixture(t); stub.state.configInspect.set(FLAG, { defaultValue: false, globalValue: true });
    stub.state.isTrusted = false; assert.equal(f.preCommitHooksEnabled(), false);
    stub.state.isTrusted = true; Object.defineProperty(stub.env, "remoteName", { configurable: true, value: "synthetic-remote" }); assert.equal(f.preCommitHooksEnabled(), false);
    Object.defineProperty(stub.env, "remoteName", { configurable: true, value: undefined }); assert.equal(f.preCommitHooksEnabled(), true); f.noIO();
});

test("F26a configuration access and inspect errors fail closed without exposing raw diagnostics", async t => {
    const f = await fixture(t); stub.state.configInspect.set(FLAG, { defaultValue: false, globalValue: true });
    const original = stub.workspace.getConfiguration.bind(stub.workspace);
    t.mock.method(stub.workspace, "getConfiguration", ((section: string) => {
        const entry = original(section); return { ...entry, inspect() { throw Error(PRIVATE); } };
    }) as never);
    assert.equal(f.preCommitHooksEnabled(), false);
    t.mock.method(stub.workspace, "getConfiguration", () => { throw Error(PRIVATE); });
    assert.equal(f.preCommitHooksEnabled(), false); f.noIO(); safe(stub.capturedText());
});
