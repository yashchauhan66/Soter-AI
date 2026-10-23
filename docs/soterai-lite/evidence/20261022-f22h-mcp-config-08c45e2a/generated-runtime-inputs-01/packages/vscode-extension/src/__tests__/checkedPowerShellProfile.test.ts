import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";

// Frozen F10 design04 profile contract; LOW API/state fixtures only. No user
// settings/profile/history access and no native profile or shell is executed.
const PROFILE_ID = "soterai.ps51.checked", NAME = "SoterAI PowerShell 5.1 (checked commands)", STATE = "soterai.lite.ps51.profile.v1";
const SETTING = "terminal.integrated.defaultProfile.windows", UNRELATED = "SYNTHETIC_UNRELATED_SETTINGS_NEVER_PREVIEWED";
type Status = { status: "SAVED" | "CANCELLED" | "UNAVAILABLE" | "FAILED" };
type Manager = { configure(uri: unknown): Promise<Status>; restore(uri: unknown): Promise<Status> };
type Receipt = { schemaVersion: number; root: string; target: number; phase: "PREPARED" | "APPLIED"; before: { present: boolean; value?: string | null }; after: string };
type Provider = { provideTextDocumentContent(uri: stub.Uri): string | Promise<string> };
type Update = { key: string; value: unknown; target: unknown; scope: unknown; receipt: unknown };
let container: string, root: string, other: string, context: ReturnType<typeof stub.makeExtensionContext>;
let workspaceValue: unknown, folderValue: unknown, enabled: boolean, approved: boolean;
let settingFault: "none" | "throw" | "noop" | "apply-then-throw", stateFault: "none" | "PREPARED" | "APPLIED";
let updates: Update[], stateUpdates: { key: string; value: unknown }[], inspections: { key: string; scope: unknown }[], diffs: { contents: string[]; uris: stub.Uri[] }[], modals: { message: string; detail?: string; actions: string[] }[];
let providers: Map<string, Provider>, confirmHook: (() => Promise<void>) | undefined, diffHook: (() => Promise<void>) | undefined;
const windowOriginals = Object.getOwnPropertyDescriptors(stub.window), workspaceOriginals = Object.getOwnPropertyDescriptors(stub.workspace);
const rootUri = () => stub.Uri.file(root);
const clone = <T>(value: T): T => structuredClone(value);
const receipt = () => context.workspaceState.get<Receipt | undefined>(STATE);
const tick = async () => { await new Promise<void>(done => setImmediate(done)); };
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(label)), 1500); })]); }
    finally { if (timer) clearTimeout(timer); }
}
async function wait(predicate: () => boolean): Promise<void> { const until = Date.now() + 1500; while (!predicate() && Date.now() < until) await new Promise<void>(done => setTimeout(done, 5)); assert.ok(predicate(), "Expected owned review stage was not reached."); }
async function manager(): Promise<Manager> {
    const module = await import("../terminal/CheckedPowerShellProfile");
    assert.equal(module.PROFILE_ID, PROFILE_ID); assert.equal(module.PROFILE_NAME, NAME); assert.equal(module.PROFILE_STATE, STATE);
    return new module.CheckedPowerShellProfile(context as never, () => enabled) as unknown as Manager;
}
function canonicalKey(section: string | undefined, name: string): string { return section ? section + "." + name : name; }
function scopeUri(scope: unknown): string | undefined { if (scope instanceof stub.Uri) return scope.toString(); return (scope as { uri?: stub.Uri } | undefined)?.uri?.toString(); }
function safePreview(): void {
    assert.ok(diffs.length > 0); for (const diff of diffs) {
        assert.equal(diff.contents.length, 2); assert.ok(diff.uris.every(uri => !["file", "untitled"].includes(uri.scheme) && providers.has(uri.scheme)));
        const text = diff.contents.join("\n"); assert.ok(text.includes(NAME)); assert.ok(text.includes(SETTING) || text.includes("defaultProfile.windows")); assert.ok(!text.includes(UNRELATED));
    }
    assert.ok(modals.every(modal => !JSON.stringify(modal).includes(UNRELATED)));
}
function assertReceipt(value: Receipt | undefined, before: Receipt["before"], phase = "APPLIED", target: number = stub.ConfigurationTarget.Workspace): asserts value is Receipt {
    assert.ok(value); assert.deepEqual(Object.keys(value).sort(), ["after", "before", "phase", "root", "schemaVersion", "target"]);
    assert.equal(value.schemaVersion, 1); assert.ok(value.root === rootUri().toString() || value.root === root); assert.equal(value.target, target); assert.equal(value.phase, phase); assert.deepEqual(value.before, before); assert.equal(value.after, NAME);
}
function multi(saved: boolean): void {
    stub.state.folders.push({ uri: stub.Uri.file(other), name: "other", index: 1 });
    Object.defineProperty(stub.workspace, "workspaceFile", { configurable: true, enumerable: true, value: saved ? stub.Uri.file(join(container, "synthetic.code-workspace")) : stub.Uri.parse("untitled:/synthetic.code-workspace") });
}
function untouched(): void { assert.ok(updates.every(update => update.key === SETTING && update.target !== stub.ConfigurationTarget.Global)); assert.ok(inspections.every(read => read.key === SETTING)); assert.equal(context._inspect.globalStore.size, 0); }

beforeEach(async () => {
    container = await mkdtemp(join(tmpdir(), "soterai-f10-profile-")); root = join(container, "project"); other = join(container, "other"); await mkdir(root); await mkdir(other);
    await writeFile(join(container, ".synthetic-lite-f10-profile"), "owned-synthetic-v1", { flag: "wx" }); await writeFile(join(container, "synthetic.code-workspace"), '{"folders":[]}', { flag: "wx" });
    stub.resetState(root); context = stub.makeExtensionContext(join(container, "storage")); workspaceValue = "Windows PowerShell"; folderValue = "Folder-specific old profile";
    enabled = true; approved = true; settingFault = "none"; stateFault = "none"; updates = []; stateUpdates = []; inspections = []; diffs = []; modals = []; providers = new Map(); confirmHook = undefined; diffHook = undefined;
    Object.defineProperty(stub.workspace, "workspaceFile", { configurable: true, enumerable: true, value: undefined });
    Object.assign(stub.workspace, {
        getConfiguration(section?: string, scope?: unknown) {
            return {
                get(name: string, fallback?: unknown) { const key = canonicalKey(section, name); assert.equal(key, SETTING, "Whole settings and unrelated keys may not be read."); inspections.push({ key, scope }); return workspaceValue ?? fallback; },
                inspect(name: string) { const key = canonicalKey(section, name); assert.equal(key, SETTING, "Inspect only the owned terminal setting."); inspections.push({ key, scope }); return { key, defaultValue: "Default inherited profile", globalValue: UNRELATED, workspaceValue, workspaceFolderValue: folderValue }; },
                async update(name: string, value: unknown, target: unknown) {
                    const key = canonicalKey(section, name); assert.equal(key, SETTING); updates.push({ key, value: clone(value), target, scope, receipt: clone(receipt()) });
                    if (settingFault === "throw") throw new Error("SYNTHETIC_SETTING_WRITE_FAILURE"); if (settingFault === "noop") return;
                    if (target === stub.ConfigurationTarget.Workspace) workspaceValue = clone(value); else if (target === stub.ConfigurationTarget.WorkspaceFolder) folderValue = clone(value); else assert.fail("Global profile changes are outside this feature.");
                    if (settingFault === "apply-then-throw") throw new Error("SYNTHETIC_SETTING_APPLIED_THEN_THROWN");
                },
            };
        },
        registerTextDocumentContentProvider(scheme: string, provider: Provider) { providers.set(scheme, provider); return new stub.Disposable(() => providers.delete(scheme)); },
        async openTextDocument(uri: stub.Uri) { assert.ok(uri instanceof stub.Uri && providers.has(uri.scheme), "Original settings/profile files must not be opened."); return stub.makeDocument(uri, await providers.get(uri.scheme)!.provideTextDocumentContent(uri)); },
    });
    const stateUpdate = context.workspaceState.update.bind(context.workspaceState);
    context.workspaceState.update = async (key: string, value: unknown) => {
        assert.equal(key, STATE); stateUpdates.push({ key, value: clone(value) });
        if ((value as Receipt | undefined)?.phase === stateFault) throw new Error("SYNTHETIC_RECEIPT_WRITE_FAILURE");
        return stateUpdate(key, clone(value));
    };
    Object.assign(stub.window, {
        async showWarningMessage(message: string, ...items: unknown[]) {
            const options = items[0] as { modal?: boolean; detail?: string }, actions = items.filter(item => typeof item === "string") as string[];
            assert.equal(options.modal, true); assert.ok(actions.some(action => ["Use checked PowerShell profile", "Restore previous terminal profile"].includes(action)));
            modals.push({ message, detail: options.detail, actions }); if (confirmHook) await confirmHook(); return approved ? actions[0] : undefined;
        },
        async showInformationMessage() { return undefined; }, async showErrorMessage() { return undefined; },
    });
    const nativeExecute = stub.commands.executeCommand.bind(stub.commands);
    mock.method(stub.commands, "executeCommand", async (command: string, ...args: unknown[]) => {
        if (command !== "vscode.diff") return nativeExecute(command, ...args);
        const uris = args.slice(0, 2); assert.ok(uris.every(uri => uri instanceof stub.Uri)); const contents: string[] = [];
        for (const uri of uris as stub.Uri[]) { const provider = providers.get(uri.scheme); assert.ok(provider, "Diff must use a private read-only metadata provider."); contents.push(await provider.provideTextDocumentContent(uri)); }
        diffs.push({ uris: uris as stub.Uri[], contents }); if (diffHook) await diffHook(); return undefined;
    });
});
afterEach(async () => {
    for (const subscription of context.subscriptions) subscription.dispose(); mock.restoreAll();
    for (const name of Object.keys(stub.window)) if (!(name in windowOriginals)) Reflect.deleteProperty(stub.window, name);
    for (const name of Object.keys(stub.workspace)) if (!(name in workspaceOriginals)) Reflect.deleteProperty(stub.workspace, name);
    Object.defineProperties(stub.window, windowOriginals); Object.defineProperties(stub.workspace, workspaceOriginals);
    assert.equal(dirname(resolve(container)), resolve(tmpdir())); assert.ok(basename(container).startsWith("soterai-f10-profile-")); assert.equal(await readFile(join(container, ".synthetic-lite-f10-profile"), "utf8"), "owned-synthetic-v1");
    // Retain the synthetic fixture directory as evidence, including failures.
});

test("F10-P01 declined native review writes neither setting nor receipt and previews only the selected metadata", async () => {
    const profile = await manager(); approved = false; assert.deepEqual(await profile.configure(rootUri()), { status: "CANCELLED" }); assert.equal(workspaceValue, "Windows PowerShell"); assert.equal(updates.length, 0); assert.equal(stateUpdates.length, 0); assert.equal(receipt(), undefined); safePreview(); untouched();
});
test("F10-P02 configure durably prepares before one precise workspace write and verifies the applied record", async () => {
    const profile = await manager(); assert.deepEqual(await profile.configure(rootUri()), { status: "SAVED" }); assert.equal(workspaceValue, NAME); assert.equal(folderValue, "Folder-specific old profile"); assert.equal(updates.length, 1);
    assertReceipt(updates[0].receipt as Receipt, { present: true, value: "Windows PowerShell" }, "PREPARED"); assertReceipt(receipt(), { present: true, value: "Windows PowerShell" });
    assert.deepEqual(stateUpdates.filter(row => row.value !== undefined).map(row => (row.value as Receipt).phase), ["PREPARED", "APPLIED"]); safePreview(); untouched();
});
test("F10-P03 restore reviews native metadata, restores only the owned setting and clears the receipt", async () => {
    const profile = await manager(); assert.deepEqual(await profile.configure(rootUri()), { status: "SAVED" }); assert.deepEqual(await profile.restore(rootUri()), { status: "SAVED" }); assert.equal(workspaceValue, "Windows PowerShell"); assert.equal(receipt(), undefined);
    assert.ok(modals.some(modal => modal.actions.includes("Restore previous terminal profile"))); assert.equal(updates.length, 2); safePreview(); untouched();
});
for (const initial of [undefined, null] as const) {
    test(`F10-P04-${initial === undefined ? "absent" : "null"} selected-scope absence/null is preserved independently of inherited defaults`, async () => {
        workspaceValue = initial; const profile = await manager(); assert.deepEqual(await profile.configure(rootUri()), { status: "SAVED" }); assertReceipt(receipt(), initial === undefined ? { present: false } : { present: true, value: null });
        assert.deepEqual(await profile.restore(rootUri()), { status: "SAVED" }); assert.equal(workspaceValue, initial); assert.equal(updates.at(-1)!.value, initial); assert.equal(receipt(), undefined); safePreview(); untouched();
    });
}
test("F10-P05 a saved multi-root workspace targets only the chosen folder setting", async () => {
    multi(true); const profile = await manager(); assert.deepEqual(await profile.configure(rootUri()), { status: "SAVED" }); assert.equal(folderValue, NAME); assert.equal(workspaceValue, "Windows PowerShell"); assertReceipt(receipt(), { present: true, value: "Folder-specific old profile" }, "APPLIED", stub.ConfigurationTarget.WorkspaceFolder);
    assert.ok(updates.every(update => update.target === stub.ConfigurationTarget.WorkspaceFolder && scopeUri(update.scope) === rootUri().toString())); assert.deepEqual(await profile.restore(rootUri()), { status: "SAVED" }); assert.equal(folderValue, "Folder-specific old profile"); untouched();
});
test("F10-P06 an unsaved multi-root workspace uses workspace scope rather than a folder override", async () => {
    multi(false); const profile = await manager(); assert.deepEqual(await profile.configure(rootUri()), { status: "SAVED" }); assert.equal(workspaceValue, NAME); assert.equal(folderValue, "Folder-specific old profile"); assert.ok(updates.every(update => update.target === stub.ConfigurationTarget.Workspace)); untouched();
});
test("F10-P07 declined restore preserves the applied setting and complete undo receipt", async () => {
    const profile = await manager(); await profile.configure(rootUri()); const before = clone(receipt()); approved = false; assert.deepEqual(await profile.restore(rootUri()), { status: "CANCELLED" }); assert.equal(workspaceValue, NAME); assert.deepEqual(receipt(), before); assert.equal(updates.length, 1); untouched();
});
test("F10-P08 a PREPARED receipt write failure prevents any setting change", async () => {
    const profile = await manager(); stateFault = "PREPARED"; assert.deepEqual(await profile.configure(rootUri()), { status: "FAILED" }); assert.equal(updates.length, 0); assert.equal(workspaceValue, "Windows PowerShell"); assert.equal(receipt(), undefined); untouched();
});
test("F10-P09 an applied-setting receipt failure retains PREPARED metadata for a new instance to restore", async () => {
    const profile = await manager(); stateFault = "APPLIED"; assert.deepEqual(await profile.configure(rootUri()), { status: "FAILED" }); assert.equal(workspaceValue, NAME); assertReceipt(receipt(), { present: true, value: "Windows PowerShell" }, "PREPARED");
    stateFault = "none"; const restarted = await manager(); assert.deepEqual(await restarted.restore(rootUri()), { status: "SAVED" }); assert.equal(workspaceValue, "Windows PowerShell"); assert.equal(receipt(), undefined); untouched();
});
test("F10-P10 a no-op setting write fails readback and its owned PREPARED record can be safely cleared", async () => {
    const profile = await manager(); settingFault = "noop"; assert.deepEqual(await profile.configure(rootUri()), { status: "FAILED" }); assert.equal(workspaceValue, "Windows PowerShell"); assertReceipt(receipt(), { present: true, value: "Windows PowerShell" }, "PREPARED");
    settingFault = "none"; assert.deepEqual(await profile.restore(rootUri()), { status: "SAVED" }); assert.equal(workspaceValue, "Windows PowerShell"); assert.equal(receipt(), undefined); untouched();
});
test("F10-P11 apply-then-throw preserves the original-value receipt and permits later owned restoration", async () => {
    const profile = await manager(); settingFault = "apply-then-throw"; assert.deepEqual(await profile.configure(rootUri()), { status: "FAILED" }); assert.equal(workspaceValue, NAME); assert.ok(receipt()); assert.deepEqual(receipt()!.before, { present: true, value: "Windows PowerShell" });
    settingFault = "none"; assert.deepEqual(await (await manager()).restore(rootUri()), { status: "SAVED" }); assert.equal(workspaceValue, "Windows PowerShell"); assert.equal(receipt(), undefined); untouched();
});
test("F10-P12 a third-party profile change is preserved and the stale undo receipt is retained", async () => {
    const profile = await manager(); await profile.configure(rootUri()); const before = clone(receipt()); workspaceValue = "Different owner profile"; const writes = updates.length;
    assert.deepEqual(await profile.restore(rootUri()), { status: "FAILED" }); assert.equal(workspaceValue, "Different owner profile"); assert.deepEqual(receipt(), before); assert.equal(updates.length, writes); untouched();
});
test("F10-P13 corrupt or mismatched durable records are neither applied nor overwritten", async () => {
    const profile = await manager(); const valid: Receipt = { schemaVersion: 1, root: rootUri().toString(), target: stub.ConfigurationTarget.Workspace, phase: "APPLIED", before: { present: true, value: "Windows PowerShell" }, after: NAME };
    for (const value of [{ ...valid, schemaVersion: 9 }, { ...valid, root: stub.Uri.file(other).toString() }, { ...valid, target: stub.ConfigurationTarget.Global }, { ...valid, phase: "BROKEN" }, { ...valid, after: "Another profile" }, { ...valid, before: { present: true, value: { nested: UNRELATED } } }]) {
        context._inspect.workspaceStore.set(STATE, clone(value)); const state = clone(value), writes = updates.length, saves = stateUpdates.length; const restored = await profile.restore(rootUri()); assert.ok(["FAILED", "UNAVAILABLE"].includes(restored.status));
        const configured = await profile.configure(rootUri()); assert.ok(["FAILED", "UNAVAILABLE"].includes(configured.status)); assert.deepEqual(receipt(), state); assert.equal(updates.length, writes); assert.equal(stateUpdates.length, saves);
    }
    untouched();
});
test("F10-P14 invalid selected-scope profile types or oversized strings are refused before preview or state writes", async () => {
    const profile = await manager(); for (const value of [17, { nested: UNRELATED }, "x".repeat(257)]) { workspaceValue = value; const result = await profile.configure(rootUri()); assert.ok(["FAILED", "UNAVAILABLE"].includes(result.status)); }
    assert.equal(diffs.length, 0); assert.equal(modals.length, 0); assert.equal(updates.length, 0); assert.equal(stateUpdates.length, 0); untouched();
});
test("F10-P15 current-setting drift during the metadata diff cancels publication without a stale before receipt", async () => {
    const profile = await manager(); diffHook = async () => { workspaceValue = "Owner changed during diff"; }; const result = await profile.configure(rootUri()); assert.ok(["FAILED", "UNAVAILABLE"].includes(result.status)); assert.equal(workspaceValue, "Owner changed during diff"); assert.equal(updates.length, 0); assert.equal(stateUpdates.length, 0); untouched();
});
test("F10-P16 workspace removal during owner approval prevents the pending write", async () => {
    const profile = await manager(); confirmHook = async () => { stub.state.folders = [{ uri: stub.Uri.file(other), name: "other", index: 0 }]; }; const result = await profile.configure(rootUri()); assert.ok(["FAILED", "UNAVAILABLE"].includes(result.status)); assert.equal(workspaceValue, "Windows PowerShell"); assert.equal(updates.length, 0); assert.equal(stateUpdates.length, 0);
});
test("F10-P17 withdrawal blocks configure/restore and revokes a held owner approval without deleting its existing receipt", async () => {
    const profile = await manager(); const gate = deferred(); confirmHook = () => gate.promise; const pending = profile.configure(rootUri()); await wait(() => modals.length === 1); enabled = false; gate.resolve();
    assert.equal((await bounded(pending, "Withdrawn approval did not settle.")).status, "UNAVAILABLE"); assert.equal(workspaceValue, "Windows PowerShell"); assert.equal(updates.length, 0); assert.equal(receipt(), undefined);
    enabled = true; confirmHook = undefined; await profile.configure(rootUri()); const saved = clone(receipt()); enabled = false; assert.deepEqual(await profile.restore(rootUri()), { status: "UNAVAILABLE" }); assert.deepEqual(await profile.configure(rootUri()), { status: "UNAVAILABLE" }); assert.equal(workspaceValue, NAME); assert.deepEqual(receipt(), saved); untouched();
});
test("F10-P18 only one operation may own a pending review and a second call cannot overwrite its original before value", async () => {
    const profile = await manager(), gate = deferred(); confirmHook = () => gate.promise; const first = profile.configure(rootUri()); await wait(() => modals.length === 1);
    const second = await bounded(profile.configure(rootUri()), "Concurrent configure must not queue indefinitely."); const restore = await bounded(profile.restore(rootUri()), "Concurrent restore must not queue indefinitely.");
    assert.equal(second.status, "UNAVAILABLE"); assert.equal(restore.status, "UNAVAILABLE"); assert.equal(modals.length, 1); assert.equal(updates.length, 0); gate.resolve();
    assert.deepEqual(await bounded(first, "Owned initial review did not finish."), { status: "SAVED" }); assert.equal(updates.length, 1); assertReceipt(receipt(), { present: true, value: "Windows PowerShell" }); untouched();
});
test("F10-P19 restoration is bound to the original root and chosen scope and survives refusal unchanged", async () => {
    const profile = await manager(); await profile.configure(rootUri()); const saved = clone(receipt()); stub.state.folders.push({ uri: stub.Uri.file(other), name: "other", index: 1 });
    const wrong = await profile.restore(stub.Uri.file(other)); assert.ok(["FAILED", "UNAVAILABLE"].includes(wrong.status)); assert.equal(workspaceValue, NAME); assert.deepEqual(receipt(), saved); assert.equal(updates.length, 1); untouched();
});
test("F10-P20 selected scope and current value are rechecked after the native owner modal", async () => {
    const profile = await manager(); confirmHook = async () => { multi(true); }; let result = await profile.configure(rootUri()); assert.ok(["FAILED", "UNAVAILABLE"].includes(result.status)); assert.equal(workspaceValue, "Windows PowerShell"); assert.equal(folderValue, "Folder-specific old profile");
    stub.state.folders = [{ uri: rootUri(), name: "project", index: 0 }]; Object.defineProperty(stub.workspace, "workspaceFile", { configurable: true, enumerable: true, value: undefined });
    confirmHook = async () => { workspaceValue = "Owner changed during modal"; }; result = await profile.configure(rootUri()); assert.ok(["FAILED", "UNAVAILABLE"].includes(result.status)); assert.equal(workspaceValue, "Owner changed during modal"); assert.equal(updates.length, 0); assert.equal(stateUpdates.length, 0); untouched();
});
