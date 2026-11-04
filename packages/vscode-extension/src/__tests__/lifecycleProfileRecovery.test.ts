import "./phase2/register.mjs";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";

// F32 real profile transactions with API-only editor/configuration doubles.
// The additional lease permits restoring one already owned project setting;
// it never enables managed reading, terminal execution or fresh configuration.
// Synthetic fixture directories are retained, including on failed assertions.
type Result = { status: "SAVED" | "CANCELLED" | "UNAVAILABLE" | "FAILED" };
type Manager = { configure(root: stub.Uri): Promise<Result>; restore(root: stub.Uri): Promise<Result> };
type ExtendedConstructor = new (
    context: ReturnType<typeof stub.makeExtensionContext>, enabled: () => boolean, restoreEnabled?: () => boolean,
) => Manager;
type Receipt = {
    schemaVersion: number; root: string; target: number; phase: string;
    before: { present: boolean; value?: string | null }; after: string;
};
type Provider = { provideTextDocumentContent(uri: stub.Uri): string | Promise<string> };
const SETTING = "terminal.integrated.defaultProfile.windows";
const PRIVATE = "SYNTHETIC_ONLY_F32_UNRELATED_SETTING_d18c4f";
const requiredStub = createRequire(__filename)("./phase2/vscode-stub") as { workspace: Record<string, unknown> };
const FAMILIES = [
    { name: "PowerShell", state: "soterai.lite.ps51.profile.v1", profile: "SoterAI PowerShell 5.1 (checked commands)",
        async load() { return (await import("../terminal/CheckedPowerShellProfile")).CheckedPowerShellProfile as unknown as ExtendedConstructor; } },
    { name: "Cmd", state: "soterai.lite.cmd.profile.v1", profile: "SoterAI cmd (checked commands)",
        async load() { return (await import("../terminal/CheckedCmdProfile")).CheckedCmdProfile as unknown as ExtendedConstructor; } },
    { name: "GitBash", state: "soterai.lite.gitBash.profile.v1", profile: "SoterAI Git Bash (checked commands)",
        async load() { return (await import("../terminal/CheckedGitBashProfile")).CheckedGitBashProfile as unknown as ExtendedConstructor; } },
] as const;
type Family = typeof FAMILIES[number];
const clone = <T>(value: T): T => structuredClone(value);

async function fixture(t: TestContext, family: Family, folderScope = false) {
    const container = await mkdtemp(join(tmpdir(), "soterai-f32-profile-recovery-"));
    const rootPath = join(container, "workspace"), otherPath = join(container, "other");
    await mkdir(rootPath); await mkdir(otherPath);
    await writeFile(join(container, ".synthetic-lite-f32-profile-recovery"), "owned-synthetic-v1", { flag: "wx" });
    stub.resetState(rootPath);
    const root = stub.Uri.file(rootPath), other = stub.Uri.file(otherPath);
    const context = stub.makeExtensionContext(join(container, "storage"));
    let enabled = false, restoreEnabled = true, approved = true;
    let workspaceValue: unknown = folderScope ? "Unrelated workspace profile" : family.profile;
    let folderValue: unknown = folderScope ? family.profile : "Unrelated folder profile";
    let onDiff: (() => Promise<void>) | undefined, onModal: (() => Promise<void>) | undefined;
    const providers = new Map<string, Provider>();
    const diffs: Array<{ contents: string[]; uris: stub.Uri[] }> = [];
    const modals: Array<{ message: string; detail?: string; actions: string[] }> = [];
    const updates: Array<{ key: string; value: unknown; target: unknown; scope: unknown; receipt: unknown }> = [];
    const stateUpdates: Array<{ key: string; value: unknown }> = [];
    const target = folderScope ? stub.ConfigurationTarget.WorkspaceFolder : stub.ConfigurationTarget.Workspace;
    const originalWorkspaceFile = Object.getOwnPropertyDescriptor(stub.workspace, "workspaceFile");
    Object.defineProperty(stub.workspace, "workspaceFile", { configurable: true, enumerable: true,
        value: folderScope ? stub.Uri.file(join(container, "synthetic.code-workspace")) : undefined });
    if (folderScope) stub.state.folders.push({ uri: other, name: "other", index: 1 });
    for (const flag of ["soterai.lite.managedRead", "soterai.lite.ps51Terminal", "soterai.lite.cmdTerminal", "soterai.lite.gitBashTerminal"]) {
        stub.state.config.set(flag, false);
    }
    const initialFlags = [...stub.state.config];
    const record = (patch: Partial<Receipt> = {}): Receipt => ({
        schemaVersion: 1, root: root.toString(), target, phase: "APPLIED",
        before: { present: true, value: "Synthetic previous project profile" }, after: family.profile, ...patch,
    });
    context._inspect.workspaceStore.set(family.state, record());
    const currentReceipt = () => context.workspaceState.get<Receipt>(family.state);
    const realStateUpdate = context.workspaceState.update.bind(context.workspaceState);
    t.mock.method(context.workspaceState, "update", async (key: string, value: unknown) => {
        assert.equal(key, family.state); stateUpdates.push({ key, value: clone(value) });
        return realStateUpdate(key, clone(value));
    });
    t.mock.method(stub.workspace, "getConfiguration", ((section?: string, scope?: unknown) => ({
        get<T>(_name: string, _fallback?: T): T { assert.fail("Recovery must inspect the selected project setting."); },
        has(_name: string): boolean { assert.fail("Recovery must inspect the selected project setting."); },
        inspect(name: string) {
            assert.equal(`${section}.${name}`, SETTING, "Read only the owned project terminal setting.");
            assert.ok(scope instanceof stub.Uri && scope.toString() === root.toString());
            return { defaultValue: "Inherited default", globalValue: PRIVATE, workspaceValue, workspaceFolderValue: folderValue };
        },
        async update(name: string, value: unknown, actualTarget?: unknown) {
            assert.equal(`${section}.${name}`, SETTING); assert.equal(actualTarget, target);
            assert.ok(scope instanceof stub.Uri && scope.toString() === root.toString());
            updates.push({ key: SETTING, value: clone(value), target: actualTarget, scope, receipt: clone(currentReceipt()) });
            if (actualTarget === stub.ConfigurationTarget.Workspace) workspaceValue = clone(value);
            else if (actualTarget === stub.ConfigurationTarget.WorkspaceFolder) folderValue = clone(value);
            else assert.fail("Restoration must never update a normal/global profile.");
        },
    })) as typeof stub.workspace.getConfiguration);
    const providerDescriptor = Object.getOwnPropertyDescriptor(requiredStub.workspace, "registerTextDocumentContentProvider");
    Object.defineProperty(requiredStub.workspace, "registerTextDocumentContentProvider", {
        configurable: true, enumerable: true, writable: true,
        value(scheme: string, provider: Provider) {
            providers.set(scheme, provider); return new stub.Disposable(() => providers.delete(scheme));
        },
    });
    t.mock.method(stub.workspace, "openTextDocument", (async () => {
        assert.fail("A terminal recovery preview must not open any settings.json or shell profile.");
    }) as typeof stub.workspace.openTextDocument);
    t.mock.method(stub.commands, "executeCommand", (async (command: string, ...args: unknown[]) => {
        assert.equal(command, "vscode.diff", "Profile recovery has no terminal/process command authority.");
        const uris = args.slice(0, 2) as stub.Uri[];
        assert.equal(uris.length, 2); const contents: string[] = [];
        for (const uri of uris) {
            assert.ok(uri instanceof stub.Uri && !["file", "untitled"].includes(uri.scheme));
            const provider = providers.get(uri.scheme); assert.ok(provider);
            contents.push(await provider.provideTextDocumentContent(uri));
        }
        diffs.push({ contents, uris }); if (onDiff) await onDiff(); return undefined;
    }) as typeof stub.commands.executeCommand);
    t.mock.method(stub.window, "showWarningMessage", (async (message: string, ...items: unknown[]) => {
        const options = items[0] as { modal?: boolean; detail?: string };
        const actions = items.filter((value): value is string => typeof value === "string");
        assert.equal(options.modal, true); assert.deepEqual(actions, ["Restore previous terminal profile"]);
        modals.push({ message, detail: options.detail, actions });
        if (onModal) await onModal(); return approved ? actions[0] : undefined;
    }) as typeof stub.window.showWarningMessage);
    t.after(async () => {
        context.subscriptions.forEach(subscription => subscription.dispose());
        if (providerDescriptor) Object.defineProperty(requiredStub.workspace, "registerTextDocumentContentProvider", providerDescriptor);
        else delete requiredStub.workspace.registerTextDocumentContentProvider;
        if (originalWorkspaceFile) Object.defineProperty(stub.workspace, "workspaceFile", originalWorkspaceFile);
        else delete (stub.workspace as { workspaceFile?: unknown }).workspaceFile;
        assert.equal(dirname(resolve(container)), resolve(tmpdir()));
        assert.ok(basename(container).startsWith("soterai-f32-profile-recovery-"));
        assert.equal(await readFile(join(container, ".synthetic-lite-f32-profile-recovery"), "utf8"), "owned-synthetic-v1");
        assert.deepEqual([...stub.state.config], initialFlags, "Restoration never enables withdrawn feature flags.");
        assert.equal(context._inspect.globalStore.size, 0);
        assert.ok(updates.every(update => update.target !== stub.ConfigurationTarget.Global));
        assert.ok(!JSON.stringify([...diffs, ...modals]).includes(PRIVATE));
        // Retain the marked synthetic directory and every failed fixture.
    });
    const Constructor = await family.load();
    return {
        root, other, context, target, diffs, modals, updates, stateUpdates, record, currentReceipt,
        manager(withRestoreLease = true) {
            return withRestoreLease ? new Constructor(context, () => enabled, () => restoreEnabled)
                : new Constructor(context, () => enabled);
        },
        enabled(value: boolean) { enabled = value; }, restoreEnabled(value: boolean) { restoreEnabled = value; },
        approved(value: boolean) { approved = value; }, onDiff(value?: () => Promise<void>) { onDiff = value; },
        onModal(value?: () => Promise<void>) { onModal = value; },
        setting() { return target === stub.ConfigurationTarget.WorkspaceFolder ? folderValue : workspaceValue; },
        setSetting(value: unknown) { if (target === stub.ConfigurationTarget.WorkspaceFolder) folderValue = value; else workspaceValue = value; },
        workspaceSetting() { return workspaceValue; },
    };
}

for (const family of FAMILIES) {
    test(`PR-${family.name}-01 restore-only lease restores exact owned project setting with diff and modal while feature gates remain off`, async t => {
        const f = await fixture(t, family, true), profile = f.manager();
        assert.deepEqual(await profile.restore(f.root), { status: "SAVED" });
        assert.equal(f.setting(), "Synthetic previous project profile");
        assert.equal(f.workspaceSetting(), "Unrelated workspace profile"); assert.equal(f.currentReceipt(), undefined);
        assert.equal(f.updates.length, 1); assert.equal(f.updates[0].target, stub.ConfigurationTarget.WorkspaceFolder);
        assert.equal((f.updates[0].receipt as Receipt).phase, "PREPARED");
        assert.equal(f.diffs.length, 1); assert.equal(f.modals.length, 1);
        assert.ok(f.diffs[0].contents[0].includes(family.profile));
        assert.ok(f.diffs[0].contents[1].includes("Synthetic previous project profile"));
        assert.deepEqual(f.stateUpdates.map(row => (row.value as Receipt | undefined)?.phase), ["PREPARED", undefined]);
    });

    test(`PR-${family.name}-02 restore lease cannot configure a new route and omitted lease preserves the existing enable gate`, async t => {
        const f = await fixture(t, family), original = clone(f.currentReceipt());
        assert.deepEqual(await f.manager().configure(f.root), { status: "UNAVAILABLE" });
        assert.deepEqual(await f.manager(false).restore(f.root), { status: "UNAVAILABLE" });
        f.restoreEnabled(false);
        assert.deepEqual(await f.manager().restore(f.root), { status: "UNAVAILABLE" });
        assert.equal(f.setting(), family.profile); assert.deepEqual(f.currentReceipt(), original);
        assert.equal(f.diffs.length, 0); assert.equal(f.modals.length, 0);
        assert.equal(f.updates.length, 0); assert.equal(f.stateUpdates.length, 0);
    });

    test(`PR-${family.name}-03 cancelled native review and restore-lease withdrawal during modal preserve the owned setting and receipt`, async t => {
        const f = await fixture(t, family), profile = f.manager(), original = clone(f.currentReceipt());
        f.approved(false);
        assert.deepEqual(await profile.restore(f.root), { status: "CANCELLED" });
        assert.equal(f.diffs.length, 1); assert.equal(f.modals.length, 1);
        assert.equal(f.setting(), family.profile); assert.deepEqual(f.currentReceipt(), original);
        f.approved(true); f.onModal(async () => { f.restoreEnabled(false); });
        assert.deepEqual(await profile.restore(f.root), { status: "UNAVAILABLE" });
        assert.equal(f.diffs.length, 2); assert.equal(f.modals.length, 2);
        assert.equal(f.setting(), family.profile); assert.deepEqual(f.currentReceipt(), original);
        assert.equal(f.updates.length, 0); assert.equal(f.stateUpdates.length, 0);
    });

    test(`PR-${family.name}-04 separate lease does not authorize changed values, foreign receipts or selected scope drift`, async t => {
        const f = await fixture(t, family), profile = f.manager(), original = clone(f.currentReceipt());
        f.setSetting("Owner-selected different profile");
        assert.ok(["FAILED", "UNAVAILABLE"].includes((await profile.restore(f.root)).status));
        assert.equal(f.setting(), "Owner-selected different profile"); assert.deepEqual(f.currentReceipt(), original);
        assert.equal(f.diffs.length, 0);
        f.setSetting(family.profile);
        const foreign = f.record({ root: f.other.toString() });
        f.context._inspect.workspaceStore.set(family.state, foreign);
        assert.ok(["FAILED", "UNAVAILABLE"].includes((await profile.restore(f.root)).status));
        assert.deepEqual(f.currentReceipt(), foreign); assert.equal(f.diffs.length, 0);
        f.context._inspect.workspaceStore.set(family.state, clone(original));
        f.onModal(async () => { stub.state.folders = [{ uri: f.other, name: "other", index: 0 }]; });
        assert.ok(["FAILED", "UNAVAILABLE"].includes((await profile.restore(f.root)).status));
        assert.equal(f.diffs.length, 1); assert.equal(f.modals.length, 1);
        assert.equal(f.setting(), family.profile); assert.deepEqual(f.currentReceipt(), original);
        assert.equal(f.updates.length, 0); assert.equal(f.stateUpdates.length, 0);
    });
}
