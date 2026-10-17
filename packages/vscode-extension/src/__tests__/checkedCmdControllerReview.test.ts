import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type * as vscode from "vscode";
import { registerCheckedCmd } from "../terminal/cmdCommands";
import { CmdWorker } from "../terminal/CmdWorker";
import { StreamingOutputRedactor } from "../../../core/src/StreamingOutputRedactor";
import { BoundarySnapshot, initializeBoundaryState } from "../ai-boundary/BoundarySnapshot";
import * as stub from "./phase2/vscode-stub";

// LOW synthetic API review: no worker execution, original files, user profile,
// PID signaling or cleanup. Tests exercise controller ownership admission and
// shutdown through the registered route with all fixture directories retained.
const KEY = "soterai.lite.cmd.ownership.v1";
const windowOriginals = Object.getOwnPropertyDescriptors(stub.window), workspaceOriginals = Object.getOwnPropertyDescriptors(stub.workspace);
let root: string, context: ReturnType<typeof stub.makeExtensionContext>, controller: ReturnType<typeof registerCheckedCmd> | undefined;
let opened: number, saves: unknown[], releases: Array<() => void>, lastPty: { run(input: string): Promise<{ status: string }>; close(): void } | undefined;
const row = () => ({ id: "f1051000-aabb-4cc0-8dd0-000000000001", state: "RUNNING", pid: 400001 });
const tick = () => new Promise<void>(done => setImmediate(done));
function restore(object: object, descriptors: PropertyDescriptorMap): void {
    for (const name of Object.keys(object)) if (!Object.hasOwn(descriptors, name)) Reflect.deleteProperty(object, name);
    Object.defineProperties(object, descriptors);
}
function register(): ReturnType<typeof registerCheckedCmd> {
    const vault = { async createManagedOutputFilter(_root: vscode.Uri, enabled: () => boolean) {
        return Object.assign(new StreamingOutputRedactor(["synthetic-controller-review-canary-X4q9"], { enabled }), { available: enabled, canRelease: enabled });
    } };
    controller = registerCheckedCmd(context as unknown as vscode.ExtensionContext, vault, {
        async read(): Promise<never> { assert.fail("No original file read is part of this fixture."); }, revoke() {}, isEnabled: () => true,
    });
    return controller;
}
async function open(): Promise<void> {
    const handler = stub.registeredCommands.get("soterai.openCheckedCmd"); assert.ok(handler);
    await handler(stub.Uri.file(root));
}
beforeEach(async () => {
    const base = process.platform === "win32" ? "D:\\SoterAI-Lite-test-profiles" : tmpdir(); await mkdir(base, { recursive: true });
    root = await mkdtemp(join(base, "f10-controller-review-")); stub.resetState(root); context = stub.makeExtensionContext(join(root, "storage"));
    opened = 0; saves = []; releases = []; controller = undefined; lastPty = undefined;
    initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load();
    Object.assign(stub.workspace, { registerTextDocumentContentProvider() { return new stub.Disposable(() => undefined); } });
    Object.assign(stub.window, {
        registerTerminalProfileProvider() { return new stub.Disposable(() => undefined); },
        createTerminal(options: { pty?: typeof lastPty }) { opened++; lastPty = options.pty; return { show() {}, dispose() { options.pty?.close(); } }; },
        onDidCloseTerminal: new stub.EventEmitter().event,
    });
    for (const name of ["lite.cmdTerminal", "lite.vaultMode", "lite.secretMatching", "lite.outputRedactor"]) {
        stub.state.config.set("soterai." + name, true); stub.state.configInspect.set("soterai." + name, { globalValue: true, defaultValue: true });
    }
    const update = context.globalState.update.bind(context.globalState);
    mock.method(context.globalState, "update", async (key: string, value: unknown) => { assert.equal(key, KEY); saves.push(structuredClone(value)); await update(key, value); });
});
afterEach(async () => {
    for (const release of releases) release(); await tick();
    if (controller) { await controller.shutdown(); controller.dispose(); }
    for (const subscription of context.subscriptions) subscription.dispose();
    mock.restoreAll(); restore(stub.window, windowOriginals); restore(stub.workspace, workspaceOriginals); stub.resetState();
});

test("F12-CR01 valid empty ownership admits an idle tab and shutdown durably preserves a bounded array", async () => {
    context._inspect.globalStore.set(KEY, []); const current = register(); await open(); assert.equal(opened, 1);
    await current.shutdown(); assert.deepEqual(context.globalState.get(KEY), []); assert.ok(saves.length > 0);
});

for (const [label, saved] of [["all holes", Array(1)], ["valid then hole", [row(), ,]], ["hole then valid", [, row()]]] as const) {
    test(`F12-CR02 sparse ${label} ownership withholds before tab creation and preserves the retained array`, async () => {
        context._inspect.globalStore.set(KEY, saved); const current = register(); await open();
        assert.equal(opened, 0, "Malformed ownership may not admit a terminal."); await current.shutdown();
        assert.equal(context._inspect.globalStore.get(KEY), saved); assert.equal(saves.length, 0);
    });
}

test("F12-CR03 rejected ownership persistence prevents a later terminal admission", async () => {
    register(); await open(); assert.ok(lastPty); let starts = 0;
    mock.method(CmdWorker.prototype, "start", async function(this: CmdWorker) { starts++; this.cancel(); return this.snapshot(); });
    mock.method(context.globalState, "update", async () => { throw new Error("Synthetic persistent store unavailable."); });
    assert.equal((await lastPty.run("ver")).status, "WITHHELD"); assert.equal(starts, 0);
    const previous = opened; await open(); assert.equal(opened, previous);
    assert.equal((controller!.status() as { available: boolean }).available, false);
});

test("F12-CR04 stalled ownership persistence cannot leave controller shutdown pending indefinitely", async () => {
    const current = register(); let release!: () => void, called = false;
    const held = new Promise<void>(done => { release = done; }); releases.push(release);
    mock.method(context.globalState, "update", async () => { called = true; await held; });
    const shutdown = current.shutdown(); await tick(); assert.equal(called, true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const result = await Promise.race([shutdown.then(() => "settled"), new Promise<string>(done => { timer = setTimeout(() => done("pending"), 1500); })]);
        assert.equal(result, "settled", "Shutdown must finish within its bounded flush window even while owned storage remains unconfirmed.");
    } finally { if (timer) clearTimeout(timer); release(); await shutdown; }
});
