import "C:/Users/USER/OneDrive/Desktop/Ai-Agent-Security-Guard/packages/vscode-extension/src/__tests__/phase2/register.mjs";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import childProcess from "node:child_process";
import net from "node:net";
import type * as vscode from "vscode";
import type { RemovalAction, RemovalOwner, RemovalReport } from "C:/Users/USER/OneDrive/Desktop/Ai-Agent-Security-Guard/packages/vscode-extension/src/lifecycle/RemovalCoordinator.ts";
import * as stub from "C:/Users/USER/OneDrive/Desktop/Ai-Agent-Security-Guard/packages/vscode-extension/src/__tests__/phase2/vscode-stub.ts";

// TEST FIRST: real coordinator plus native-command registration boundary.
// Editor modals, metadata probes and existing per-action commands are doubles.
// No native editor/process, filesystem fixture, backup decryption or real secret.
// Actual transaction ownership/EOF/installed-only lifecycle remain separate gates.
// Contract: registerLifecycleRecovery(context, {probe, stopBroker}) returns an
// owned Disposable. Only the fixed visible command below is registered; its
// caller arguments never provide paths, action IDs or native approval authority.
const COMMAND = "soterai.restoreChangesBeforeRemoval";
const FLAG = "soterai.lite.lifecycleRecovery";
const ROOT = "C:\\Synthetic F32 Lifecycle Commands\\workspace";
const OTHER = "C:\\Synthetic F32 Lifecycle Commands\\other";
const PRIVATE = "SYNTHETIC_ONLY_F32_COMMAND_PRIVATE_8a1d5f";
const AUTO = [
    ["checkedPowerShell", "soterai.restoreCheckedPowerShell"],
    ["checkedCmd", "soterai.restoreCheckedCmd"],
    ["checkedGitBash", "soterai.restoreCheckedGitBash"],
    ["secureEditorAssociation", "soterai.undoSecureEditorAssociation"],
    ["codexCli", "soterai.restorePinnedCodexCli"],
    ["codexIde", "soterai.restorePinnedCodexIde"],
    ["geminiCli", "soterai.restorePinnedGeminiCli"],
    ["preCommit", "soterai.restorePreCommitGuard"],
    ["prePush", "soterai.restorePrePushGuard"],
    ["psReadLine", "soterai.restorePSReadLineHistoryGuard"],
] as const;
const MANUAL = ["cline", "claude", "legacyBroker", "legacyAIConfigs"] as const;
const IDS: readonly RemovalAction[] = [...AUTO.map(([id]) => id), ...MANUAL];
interface Services {
    probe(id: RemovalAction, capturedOwner: RemovalOwner): Promise<unknown>;
    stopBroker(): Promise<unknown>;
}
interface Registration { dispose(): void }
interface Module {
    registerLifecycleRecovery(context: vscode.ExtensionContext, services: Services): Registration;
}
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve };
}
async function bounded<T>(work: PromiseLike<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([Promise.resolve(work), new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(Error("Synthetic lifecycle command stage was not reached.")), 2000);
        })]);
    } finally { if (timer) clearTimeout(timer); }
}
function safe(value: unknown): void { assert(!JSON.stringify(value).includes(PRIVATE)); }
function modal(rest: readonly unknown[]): boolean {
    return rest.some(value => !!value && typeof value === "object" && (value as { modal?: unknown }).modal === true);
}
function action(result: RemovalReport, id: RemovalAction): string {
    const rows = result.actions.filter(row => row.id === id); assert.equal(rows.length, 1); return rows[0].status;
}
async function fixture(t: TestContext) {
    stub.resetState(ROOT);
    const context = stub.makeExtensionContext("C:\\Synthetic F32 Lifecycle Commands\\profile");
    const configuration = new stub.EventEmitter<{ affectsConfiguration(section: string): boolean }>();
    const folders = new stub.EventEmitter<unknown>(), trust = new stub.EventEmitter<unknown>();
    const remote = Object.getOwnPropertyDescriptor(stub.env, "remoteName");
    Object.defineProperty(stub.env, "remoteName", { configurable: true, value: undefined });
    t.mock.method(stub.workspace, "onDidChangeConfiguration", configuration.event as typeof stub.workspace.onDidChangeConfiguration);
    t.mock.method(stub.workspace, "onDidChangeWorkspaceFolders", folders.event as typeof stub.workspace.onDidChangeWorkspaceFolders);
    t.mock.method(stub.workspace, "onDidGrantWorkspaceTrust", trust.event as typeof stub.workspace.onDidGrantWorkspaceTrust);
    let registration: Registration | undefined;
    t.after(() => {
        registration?.dispose(); context.subscriptions.forEach(item => item.dispose());
        configuration.dispose(); folders.dispose(); trust.dispose();
        if (remote) Object.defineProperty(stub.env, "remoteName", remote); else delete (stub.env as { remoteName?: string }).remoteName;
    });
    // Dynamic import preserves an actual missing-module baseline per case.
    const module = await import("C:/Users/USER/OneDrive/Desktop/Ai-Agent-Security-Guard/packages/vscode-extension/src/lifecycle/commands.ts") as Module;
    const root = () => stub.state.folders[0]?.uri.toString();
    const owned = (ownerRoot = root()!) => ({ state: "OWNED", schemaVersion: 1, root: ownerRoot, receiptFingerprint: "a".repeat(64) });
    const probes = new Map<RemovalAction, unknown>(IDS.map(id => [id, { state: "ABSENT" }]));
    const calls = { probes: [] as Array<{ id: RemovalAction; owner: RemovalOwner }>,
        native: [] as Array<{ id: string; args: unknown[] }>, stops: 0,
        ui: [] as Array<{ kind: string; message: string; rest: unknown[] }>,
        files: 0, keys: 0, children: 0, listeners: 0, documents: 0, clipboard: 0 };
    const hooks = {
        async review(): Promise<boolean> { return true; },
        async probe(id: RemovalAction): Promise<unknown> { return probes.get(id); },
        async native(id: RemovalAction): Promise<unknown> {
            probes.set(id, { state: "ABSENT" });
            return { status: id.startsWith("checked") || id === "secureEditorAssociation" ? "SAVED" : "RESTORED" };
        },
        async stop(): Promise<unknown> { return { state: "stopped" }; },
    };
    t.mock.method(stub.window, "showWarningMessage", (async (message: string, ...rest: unknown[]) => {
        calls.ui.push({ kind: "warning", message, rest });
        if (!modal(rest)) return undefined;
        if (!await hooks.review()) return undefined;
        return rest.find((value): value is string => typeof value === "string");
    }) as typeof stub.window.showWarningMessage);
    for (const kind of ["showInformationMessage", "showErrorMessage"] as const) {
        t.mock.method(stub.window, kind, (async (message: string, ...rest: unknown[]) => {
            calls.ui.push({ kind, message, rest }); return undefined;
        }) as typeof stub.window[typeof kind]);
    }
    t.mock.method(stub.commands, "executeCommand", async (id: string, ...args: unknown[]) => {
        calls.native.push({ id, args });
        const row = AUTO.find(([, command]) => command === id);
        assert(row, "Lifecycle wrapper dispatched a command outside its fixed safe allowlist.");
        assert.deepEqual(args, [], "Per-action native commands must receive no approval/path/caller arguments.");
        return hooks.native(row[0]);
    });
    const noFiles = () => { calls.files++; throw Error(PRIVATE); };
    for (const name of ["readFileSync", "openSync", "lstatSync", "statSync", "realpathSync", "mkdirSync", "writeFileSync"] as const)
        t.mock.method(fs, name, noFiles as never);
    t.mock.method(stub.workspace.fs, "readFile", async () => noFiles());
    t.mock.method(stub.workspace.fs, "writeFile", async () => noFiles());
    t.mock.method(context.secrets, "get", async () => { calls.keys++; throw Error(PRIVATE); });
    t.mock.method(context.secrets, "store", async () => { calls.keys++; throw Error(PRIVATE); });
    t.mock.method(context.secrets, "delete", async () => { calls.keys++; throw Error(PRIVATE); });
    t.mock.method(childProcess, "spawn", (() => { calls.children++; throw Error(PRIVATE); }) as never);
    t.mock.method(childProcess, "execFile", (() => { calls.children++; throw Error(PRIVATE); }) as never);
    t.mock.method(net.Server.prototype, "listen", (() => { calls.listeners++; throw Error(PRIVATE); }) as never);
    t.mock.method(stub.workspace, "openTextDocument", async () => { calls.documents++; throw Error(PRIVATE); });
    t.mock.method(stub.env.clipboard, "readText", async () => { calls.clipboard++; throw Error(PRIVATE); });
    t.mock.method(stub.env.clipboard, "writeText", async () => { calls.clipboard++; throw Error(PRIVATE); });
    context._inspect.workspaceStore.set("soterai.aiForbidden.v1", { deny: "preserved" });
    context._inspect.secretStore.set("synthetic-retained-value", PRIVATE);
    const services: Services = {
        async probe(id, capturedOwner) {
            assert(IDS.includes(id)); assert.equal(capturedOwner.root, root());
            assert.equal(capturedOwner.local, true); assert.equal(capturedOwner.trusted, true);
            assert(Number.isSafeInteger(capturedOwner.revision)); calls.probes.push({ id, owner: capturedOwner });
            return hooks.probe(id);
        },
        async stopBroker() { calls.stops++; return hooks.stop(); },
    };
    const previous = [...stub.registeredCommands.keys()];
    registration = module.registerLifecycleRecovery(context as unknown as vscode.ExtensionContext, services);
    assert.equal(typeof registration.dispose, "function");
    const handler = stub.registeredCommands.get(COMMAND); assert(handler);
    const invoke = (...args: unknown[]) => bounded(Promise.resolve(handler(...args))) as Promise<RemovalReport>;
    const noIO = () => {
        assert.deepEqual({ files: calls.files, keys: calls.keys, children: calls.children, listeners: calls.listeners,
            documents: calls.documents, clipboard: calls.clipboard }, { files: 0, keys: 0, children: 0, listeners: 0, documents: 0, clipboard: 0 });
        assert.deepEqual(context._inspect.workspaceStore.get("soterai.aiForbidden.v1"), { deny: "preserved" });
        assert.equal(context._inspect.secretStore.get("synthetic-retained-value"), PRIVATE);
        safe(calls.ui); safe(stub.capturedText());
    };
    const emitConfiguration = () => configuration.fire({ affectsConfiguration: section => section === "soterai" || section === "soterai.lite" || section === FLAG });
    const flag = (globalValue: boolean, workspaceValue = !globalValue) => {
        stub.state.configInspect.set(FLAG, { defaultValue: true, globalValue, workspaceValue, workspaceFolderValue: workspaceValue });
        stub.state.config.set(FLAG, workspaceValue); emitConfiguration();
    };
    return { context, registration, handler, invoke, root, owned, probes, calls, hooks, noIO, previous,
        configuration, folders, trust, flag, emitConfiguration };
}

test("F32-R01 registration is inert and exposes only the fixed recovery command with default-true machine flag", async t => {
    const f = await fixture(t);
    assert.deepEqual([...stub.registeredCommands.keys()].filter(id => !f.previous.includes(id)), [COMMAND]);
    assert.equal(f.calls.probes.length, 0); assert.equal(f.calls.native.length, 0); assert.equal(f.calls.stops, 0); assert.equal(f.calls.ui.length, 0);
    const result = await f.invoke(); assert.equal(result.status, "COMPLETE"); assert.equal(result.broker, "STOPPED");
    assert(IDS.every(id => f.calls.probes.some(row => row.id === id))); f.noIO();
});

test("F32-R02 every safe owned action dispatches its exact existing native command without arguments", async t => {
    const f = await fixture(t); AUTO.forEach(([id]) => f.probes.set(id, f.owned()));
    const result = await f.invoke(); assert.equal(result.status, "COMPLETE");
    assert.deepEqual(f.calls.native, AUTO.map(([, id]) => ({ id, args: [] })));
    assert(AUTO.every(([id]) => action(result, id) === "RESTORED")); assert.equal(f.calls.stops, 1); f.noIO();
});

test("F32-R03 forged approval paths arbitrary commands getters and action IDs are ignored", async t => {
    const f = await fixture(t); f.probes.set("codexCli", f.owned()); let touched = 0;
    const forged = { approved: true, root: PRIVATE, command: "soterai.restoreFileFromBackup", action: "legacyBroker" };
    Object.defineProperty(forged, "authority", { get() { touched++; throw Error(PRIVATE); } });
    const result = await f.invoke(forged, PRIVATE, true, () => { touched++; });
    assert.equal(touched, 0); assert.equal(result.status, "COMPLETE");
    assert.deepEqual(f.calls.native, [{ id: "soterai.restorePinnedCodexCli", args: [] }]); safe(result); f.noIO();
});

test("F32-R04 summary requires a native modal and cancellation issues no restore or stop", async t => {
    const f = await fixture(t); f.probes.set("checkedCmd", f.owned()); f.hooks.review = async () => false;
    const result = await f.invoke({ approved: true }); assert.equal(result.status, "CANCELLED");
    assert(f.calls.ui.some(row => row.kind === "warning" && modal(row.rest)));
    assert.equal(f.calls.native.length, 0); assert.equal(f.calls.stops, 0); f.noIO();
});

test("F32-R05 summary approval preserves the separate native route cancellation", async t => {
    const f = await fixture(t); f.probes.set("prePush", f.owned()); f.hooks.native = async () => ({ status: "CANCELLED" });
    const result = await f.invoke(); assert.equal(result.status, "CANCELLED"); assert.equal(action(result, "prePush"), "CANCELLED");
    assert.deepEqual(f.calls.native, [{ id: "soterai.restorePrePushGuard", args: [] }]);
    assert.deepEqual(f.probes.get("prePush"), f.owned()); assert.equal(f.calls.stops, 0); f.noIO();
});

test("F32-R06 workspace overrides cannot enable recovery when the restricted machine flag is globally false", async t => {
    const f = await fixture(t); f.flag(false, true); f.probes.set("checkedPowerShell", f.owned());
    const result = await f.invoke({ enabled: true, approved: true }); assert.equal(result.status, "INCOMPLETE");
    assert.equal(f.calls.probes.length, 0); assert.equal(f.calls.native.length, 0); assert.equal(f.calls.stops, 0); f.noIO();
});

test("F32-R07 a workspace false override cannot replace a true machine/default recovery choice", async t => {
    const f = await fixture(t); f.flag(true, false);
    const result = await f.invoke(); assert.equal(result.status, "COMPLETE"); assert.equal(result.broker, "STOPPED"); f.noIO();
});

test("F32-R08 missing multi-root remote virtual and untrusted workspaces have no probe or mutation authority", async t => {
    const f = await fixture(t);
    const original = [...stub.state.folders];
    const cases = [
        () => { stub.state.folders = []; },
        () => { stub.state.folders = [...original, { uri: stub.Uri.file(OTHER), name: "other", index: 1 }]; },
        () => { Object.defineProperty(stub.env, "remoteName", { configurable: true, value: "ssh-remote" }); },
        () => { stub.state.folders = [{ uri: stub.Uri.parse("memfs:///synthetic"), name: "virtual", index: 0 }]; },
        () => { stub.state.isTrusted = false; },
    ];
    for (const change of cases) {
        stub.state.folders = [...original]; stub.state.isTrusted = true;
        Object.defineProperty(stub.env, "remoteName", { configurable: true, value: undefined }); change(); f.folders.fire(undefined);
        const result = await f.invoke(); assert.equal(result.status, "INCOMPLETE");
    }
    assert.equal(f.calls.probes.length, 0); assert.equal(f.calls.native.length, 0); assert.equal(f.calls.stops, 0); f.noIO();
});

test("F32-R09 URI impostors UNC authority and noncanonical parent-segment roots are refused", async t => {
    const f = await fixture(t), valid = stub.Uri.file(ROOT);
    const candidates = [
        { scheme: "file", authority: "", fsPath: ROOT, toString: () => valid.toString() },
        stub.Uri.parse("file://synthetic-server/share/workspace"),
        stub.Uri.file(ROOT + "\\part\\.."),
    ];
    for (const candidate of candidates) {
        stub.state.folders = [{ uri: candidate as stub.Uri, name: "synthetic", index: 0 }]; f.folders.fire(undefined);
        assert.equal((await f.invoke()).status, "INCOMPLETE");
    }
    assert.equal(f.calls.probes.length, 0); assert.equal(f.calls.native.length, 0); f.noIO();
});

test("F32-R10 concurrent invocation returns BUSY without duplicate modal probes or native writes", async t => {
    const f = await fixture(t), entered = deferred<void>(), release = deferred<boolean>();
    f.hooks.review = async () => { entered.resolve(); return release.promise; };
    const pending = f.invoke(); await bounded(entered.promise); const probes = f.calls.probes.length;
    const second = await f.invoke({ approved: true }); assert.equal(second.status, "BUSY"); assert.equal(f.calls.probes.length, probes);
    assert.equal(f.calls.ui.filter(row => row.kind === "warning" && modal(row.rest)).length, 1); assert.equal(f.calls.native.length, 0);
    release.resolve(false); await pending; f.noIO();
});

test("F32-R11 off then on configuration events invalidate an already-open summary", async t => {
    const f = await fixture(t); f.probes.set("checkedPowerShell", f.owned());
    f.hooks.review = async () => { f.flag(false, true); f.flag(true, false); return true; };
    assert.equal((await f.invoke()).status, "INCOMPLETE"); assert.equal(f.calls.native.length, 0); assert.equal(f.calls.stops, 0); f.noIO();
});

test("F32-R12 workspace away-and-back events cannot reuse an earlier identical-URI review", async t => {
    const f = await fixture(t); f.probes.set("codexCli", f.owned());
    f.hooks.review = async () => {
        stub.setWorkspace(OTHER); f.folders.fire(undefined); stub.setWorkspace(ROOT); f.folders.fire(undefined); return true;
    };
    assert.equal((await f.invoke()).status, "INCOMPLETE"); assert.equal(f.calls.native.length, 0); assert.equal(f.calls.stops, 0); f.noIO();
});

test("F32-R13 a trust-change event revokes pending review even when the current trusted value is true again", async t => {
    const f = await fixture(t); f.probes.set("prePush", f.owned());
    f.hooks.review = async () => { stub.state.isTrusted = false; stub.state.isTrusted = true; f.trust.fire(undefined); return true; };
    assert.equal((await f.invoke()).status, "INCOMPLETE"); assert.equal(f.calls.native.length, 0); assert.equal(f.calls.stops, 0); f.noIO();
});

test("F32-R14 subscription disposal removes the command and invalidates captured pending callbacks", async t => {
    const f = await fixture(t); f.probes.set("codexIde", f.owned());
    f.hooks.review = async () => { f.context.subscriptions.forEach(item => item.dispose()); return true; };
    const result = await f.invoke(); assert.equal(result.status, "INCOMPLETE"); assert(!stub.registeredCommands.has(COMMAND));
    assert.equal((await bounded(Promise.resolve(f.handler({ approved: true }))) as RemovalReport).status, "INCOMPLETE");
    assert.equal(f.calls.native.length, 0); assert.equal(f.calls.stops, 0); f.noIO();
});

test("F32-R15 probes bind only the current canonical owner and foreign corrupt errors stay pending without contents", async t => {
    const f = await fixture(t);
    f.probes.set("codexCli", f.owned(stub.Uri.file(OTHER).toString())); f.probes.set("codexIde", { state: "CORRUPT", value: PRIVATE });
    f.hooks.probe = async id => { if (id === "geminiCli") throw Error(PRIVATE); return f.probes.get(id); };
    const result = await f.invoke(); assert.equal(result.status, "INCOMPLETE");
    for (const id of ["codexCli", "codexIde", "geminiCli"] as const) assert.equal(action(result, id), "PENDING");
    assert(f.calls.probes.every(row => row.owner.root === stub.Uri.file(ROOT).toString()));
    assert.equal(f.calls.native.length, 0); assert.equal(f.calls.stops, 0); safe(result); f.noIO();
});

test("F32-R16 plaintext-capable manual routes never dispatch legacy or raw restore commands", async t => {
    const f = await fixture(t); MANUAL.forEach(id => f.probes.set(id, f.owned()));
    const result = await f.invoke(); assert.equal(result.status, "INCOMPLETE"); assert(MANUAL.every(id => action(result, id) === "MANUAL_RECOVERY"));
    assert.equal(f.calls.native.length, 0); assert.equal(f.calls.stops, 0); f.noIO();
});

test("F32-R17 void wrong-success and throwing native results cannot erase pending recovery or disclose exceptions", async t => {
    const f = await fixture(t); for (const id of ["checkedCmd", "codexCli", "prePush"] as const) f.probes.set(id, f.owned());
    f.hooks.native = async id => { if (id === "checkedCmd") return undefined; if (id === "codexCli") return { status: "SAVED" }; throw Error(PRIVATE); };
    const result = await f.invoke(); assert.equal(result.status, "INCOMPLETE");
    assert(["checkedCmd", "codexCli", "prePush"].every(id => action(result, id as RemovalAction) === "PENDING"));
    assert.equal(f.calls.stops, 0); safe(result); f.noIO();
});

test("F32-R18 only an exact stopped service snapshot completes; unconfirmed exit void and throw remain pending", async t => {
    const f = await fixture(t);
    for (const reply of [{ state: "STOP_UNCONFIRMED", exitCode: 0 }, { exitCode: 0, stdoutEOF: true, stderrEOF: true }, undefined, new Error(PRIVATE)]) {
        f.hooks.stop = async () => { if (reply instanceof Error) throw reply; return reply; };
        const result = await f.invoke(); assert.equal(result.status, "INCOMPLETE"); assert.equal(result.broker, "PENDING"); safe(result);
    }
    f.hooks.stop = async () => ({ state: "stopped" });
    assert.equal((await f.invoke()).status, "COMPLETE"); assert.equal(f.calls.stops, 5); assert.equal(f.calls.native.length, 0); f.noIO();
});

test("F32-R19 flag withdrawal during metadata probing prevents summary and all mutation", async t => {
    const f = await fixture(t); f.probes.set("preCommit", f.owned()); let changed = false;
    f.hooks.probe = async id => { if (!changed) { changed = true; f.flag(false, true); } return f.probes.get(id); };
    assert.equal((await f.invoke()).status, "INCOMPLETE");
    assert.equal(f.calls.ui.filter(row => row.kind === "warning" && modal(row.rest)).length, 0); assert.equal(f.calls.native.length, 0); assert.equal(f.calls.stops, 0); f.noIO();
});

test("F32-R20 owner epoch drift during a native transaction stops later routes and broker shutdown", async t => {
    const f = await fixture(t); f.probes.set("checkedPowerShell", f.owned()); f.probes.set("checkedCmd", f.owned());
    f.hooks.native = async id => { f.probes.set(id, { state: "ABSENT" }); f.emitConfiguration(); return { status: "SAVED" }; };
    assert.equal((await f.invoke()).status, "INCOMPLETE");
    assert.deepEqual(f.calls.native, [{ id: "soterai.restoreCheckedPowerShell", args: [] }]); assert.equal(f.calls.stops, 0); f.noIO();
});

// INERT snippet for lifecycleRecoveryCommands.test.ts, appended after R20.
// Uses existing test/fixture/deferred/bounded helpers. NOT_EXECUTED here.
// First capture failure against the frozen awaiting-notification implementation.
test("F32-R21 a pending nonmodal completion notice cannot block the fixed removal report", async t => {
    const f = await fixture(t);
    const noticeOpened = deferred<void>(), noticeDismissed = deferred<undefined>();
    let noticeSettled = false;
    t.mock.method(stub.window, "showInformationMessage", ((message: string, ...rest: unknown[]) => {
        f.calls.ui.push({ kind: "showInformationMessage", message, rest });
        assert(!modal(rest), "A fixed completion notice must remain nonmodal.");
        noticeOpened.resolve();
        return noticeDismissed.promise.then(value => { noticeSettled = true; return value; });
    }) as typeof stub.window.showInformationMessage);
    const work = f.invoke();
    try {
        await bounded(noticeOpened.promise);
        // Keep the actual notice promise pending through report resolution.
        // No Escape/click/dismissal may make the command look responsive.
        const result = await work;
        assert.equal(noticeSettled, false);
        assert.equal(result.status, "COMPLETE");
        assert.equal(result.broker, "STOPPED");
        assert.equal(result.actions.length, 14);
        assert(result.actions.every(row => row.status === "NOT_APPLICABLE"));
        assert.equal(f.calls.stops, 1);
        f.noIO();
    } finally {
        // Release only after the success/failure assertion, to retain the exact
        // observed hang while avoiding a dangling fixture promise on cleanup.
        noticeDismissed.resolve(undefined);
        await work.catch(() => undefined);
    }
});
