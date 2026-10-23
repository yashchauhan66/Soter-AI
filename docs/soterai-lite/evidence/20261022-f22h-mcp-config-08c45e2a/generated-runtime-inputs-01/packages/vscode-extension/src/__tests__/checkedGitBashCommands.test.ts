import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type * as vscode from "vscode";
import type { AccessResult } from "../project-privacy/ProjectFileAccess";
import { StreamingOutputRedactor } from "../../../core/src/StreamingOutputRedactor";
import { BoundarySnapshot, initializeBoundaryState } from "../ai-boundary/BoundarySnapshot";
import { CheckedGitBashProfile } from "../terminal/CheckedGitBashProfile";
import * as stub from "./phase2/vscode-stub";

// Frozen design05 registration/recovery fixtures. Only READ commands use the
// real session and F08 collector. No worker, native shell, real profile, secret
// source or public integration-command fallback is part of this fixture.
const PROFILE = "soterai.gitbash.checked", NAME = "SoterAI Git Bash (checked commands)";
const OWNERSHIP = "soterai.lite.gitBash.ownership.v1", PRIVATE = "synthetic F10 command argument must remain private q7J9";
const IDS = ["configureCheckedGitBash", "openCheckedGitBash", "runCheckedGitBash", "restoreCheckedGitBash", "checkedGitBashStatus"].map(name => "soterai." + name);
interface Pty { open(dimensions?: unknown): void; close(): void; handleInput(input: string): void; onDidWrite(listener: (text: string) => void): { dispose(): void } }
interface Controller { status(): unknown; shutdown(): Promise<void>; dispose(): void }
interface Module { registerCheckedGitBash(context: vscode.ExtensionContext, vault: unknown, reader?: unknown): Controller; stopCheckedGitBash(): Promise<void> }
type Reader = { read(uri: vscode.Uri): Promise<AccessResult>; revoke(): void; isEnabled(): boolean };
type Provider = { provideTerminalProfile(token?: unknown): unknown | PromiseLike<unknown> };
type Options = { name?: string; pty?: Pty; [key: string]: unknown };
const requiredStub = createRequire(__filename)("./phase2/vscode-stub") as Record<string, unknown>;
const windowDescriptors = Object.getOwnPropertyDescriptors(stub.window), workspaceDescriptors = Object.getOwnPropertyDescriptors(stub.workspace), envDescriptors = Object.getOwnPropertyDescriptors(stub.env);
const profileDescriptor = Object.getOwnPropertyDescriptor(requiredStub, "TerminalProfile"), platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
let directory: string, root: string, other: string, context: ReturnType<typeof stub.makeExtensionContext>;
let providers: Map<string, Provider>, controllers: Controller[], terminalOptions: Options[], output: string[], inputOptions: unknown[], inputs: Array<string | undefined>;
let reads: string[], filterCalls: number, revokes: number, pidCalls: number, nativeSends: number, fallbackCalls: number, shows: number, disposedTabs: number;
let globalWrites: Array<{ key: string; value: unknown }>, settingWrites: unknown[], configured: string[], restored: string[], folderPicks: number;
let readerEnabled: boolean, response: AccessResult, readHook: (() => Promise<void>) | undefined, reader: Reader;
let configuration: stub.EventEmitter<{ affectsConfiguration(section: string): boolean }>, folders: stub.EventEmitter<unknown>, closedTabs: stub.EventEmitter<unknown>;
let moduleValue: Module | undefined;
const uri = () => stub.Uri.file(root) as unknown as vscode.Uri;
const id = (index: number) => `f1051000-aabb-4cc0-8dd0-${String(index).padStart(12, "0")}`;
const record = (index: number, state = "RUNNING") => ({ id: id(index), state, pid: 400000 + index });
const tick = () => new Promise<void>(done => setImmediate(done));
async function bounded<T>(work: PromiseLike<T>, label = "Bounded synthetic command wait expired."): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([Promise.resolve(work), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(label)), 2000); })]); }
    finally { if (timer) clearTimeout(timer); }
}
async function wait(predicate: () => boolean): Promise<void> {
    const end = Date.now() + 1500; while (!predicate() && Date.now() < end) await new Promise<void>(done => setTimeout(done, 5));
    assert.ok(predicate(), "Expected native fixture stage was not reached.");
}
function restoreObject(object: object, descriptors: PropertyDescriptorMap): void {
    for (const key of Object.keys(object)) if (!Object.hasOwn(descriptors, key)) delete (object as Record<string, unknown>)[key];
    Object.defineProperties(object, descriptors);
}
function safe(value: unknown): void {
    const text = JSON.stringify(value) ?? ""; assert.ok(!text.includes(PRIVATE));
    assert.doesNotMatch(text, /"(?:rawValue|command|input|history|environment|registrations|ciphertext)"\s*:/);
}
function recovered(value: unknown): Array<Record<string, unknown>> {
    if (!value || typeof value !== "object") return [];
    const object = value as Record<string, unknown>;
    if (typeof object.id === "string" && typeof object.state === "string") return [object];
    return Object.values(object).flatMap(recovered);
}
async function register(...bridges: [] | [Reader | undefined]): Promise<Controller> {
    const bridge = bridges.length ? bridges[0] : reader;
    const loaded = await import("../terminal/gitBashCommands") as unknown as Module;
    assert.equal(typeof loaded.registerCheckedGitBash, "function"); assert.equal(typeof loaded.stopCheckedGitBash, "function"); moduleValue = loaded;
    const vault = { async createManagedOutputFilter(rootUri: vscode.Uri, enabled: () => boolean) {
        assert.equal(rootUri.toString(), uri().toString()); filterCalls++;
        const filter = new StreamingOutputRedactor([PRIVATE], { enabled }); return Object.assign(filter, { available: enabled, canRelease: enabled });
    } };
    const controller = loaded.registerCheckedGitBash(context as unknown as vscode.ExtensionContext, vault, bridge);
    assert.equal(typeof controller.status, "function"); assert.equal(typeof controller.shutdown, "function"); assert.equal(typeof controller.dispose, "function"); controllers.push(controller); return controller;
}
async function command(name: string, ...args: unknown[]): Promise<unknown> {
    const handler = stub.registeredCommands.get("soterai." + name); assert.equal(typeof handler, "function"); return bounded(Promise.resolve(handler!(...args)));
}
function latest(): Pty { const options = terminalOptions.at(-1); assert.ok(options?.pty); return options.pty; }
function attach(options: Options): void { assert.ok(options.pty); options.pty.onDidWrite(text => output.push(text)); }
async function nativeProfile(): Promise<Options | undefined> {
    const provider = providers.get(PROFILE); assert.ok(provider, "The contributed provider must be registered.");
    const result = await bounded(Promise.resolve(provider.provideTerminalProfile({ isCancellationRequested: false }))) as { options?: Options } | undefined;
    return result?.options;
}
function flag(name: string, value: boolean): void {
    stub.state.config.set("soterai." + name, value); stub.state.configInspect.set("soterai." + name, { globalValue: value, defaultValue: true });
    configuration.fire({ affectsConfiguration: section => section === "soterai" || section === "soterai." + name });
}
async function blocked(saved: unknown, failGet = false): Promise<void> {
    context._inspect.globalStore.set(OWNERSHIP, saved); const before = JSON.stringify(saved);
    if (failGet) { const get = context.globalState.get.bind(context.globalState);
        mock.method(context.globalState, "get", <T>(key: string, fallback?: T): T | undefined => { if (key === OWNERSHIP) throw new Error("Synthetic unreadable ownership."); return get<T>(key, fallback); }); }
    const controller = await register(); await command("openCheckedGitBash", uri());
    assert.equal(terminalOptions.length, 0); assert.equal(await nativeProfile(), undefined); assert.equal(filterCalls, 0); assert.equal(reads.length, 0);
    await bounded(controller.shutdown()); controller.dispose(); await tick();
    assert.equal(JSON.stringify(context._inspect.globalStore.get(OWNERSHIP)), before);
    assert.equal(globalWrites.filter(write => write.key === OWNERSHIP).length, 0); assert.equal(pidCalls, 0); safe(controller.status());
}

beforeEach(async () => {
    const base = process.platform === "win32" ? "D:\\SoterAI-Lite-test-profiles" : tmpdir(); await mkdir(base, { recursive: true });
    directory = await mkdtemp(join(await realpath(base), "f10-command-registration-")); root = join(directory, "project"); other = join(directory, "other"); await mkdir(root); await mkdir(other);
    await writeFile(join(root, ".env.synthetic"), "API_KEY=[SOTERAI_PROTECTED_A3427B3646BA4D8482E5C5DFB5BA5DD1_0]\n", { flag: "wx" });
    stub.resetState(root); context = stub.makeExtensionContext(join(directory, "storage")); initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load();
    providers = new Map(); controllers = []; terminalOptions = []; output = []; inputOptions = []; inputs = []; reads = []; globalWrites = []; settingWrites = []; configured = []; restored = [];
    filterCalls = revokes = pidCalls = nativeSends = fallbackCalls = shows = disposedTabs = folderPicks = 0; readerEnabled = true; readHook = undefined; moduleValue = undefined;
    response = { status: "ALLOWED_ONCE", kind: "environment-schema", text: "API_KEY=[MASKED]\n" };
    configuration = new stub.EventEmitter(); folders = new stub.EventEmitter(); closedTabs = new stub.EventEmitter();
    reader = { async read(target: vscode.Uri) { assert.equal(this, reader); reads.push(target.toString()); await readHook?.(); return response; }, revoke() { revokes++; }, isEnabled: () => readerEnabled };
    Object.defineProperty(requiredStub, "TerminalProfile", { configurable: true, enumerable: true, writable: true, value: class { constructor(readonly options: Options) {} } });
    Object.assign(stub.window, {
        registerTerminalProfileProvider(profile: string, provider: Provider) { assert.equal(profile, PROFILE); assert.ok(!providers.has(profile)); providers.set(profile, provider); return new stub.Disposable(() => providers.delete(profile)); },
        createTerminal(options: Options) {
            terminalOptions.push(options); attach(options); const terminal = { creationOptions: options, name: options.name ?? NAME,
                show() { shows++; }, sendText() { nativeSends++; }, dispose() { disposedTabs++; closedTabs.fire(terminal); } }; return terminal;
        },
        async showInputBox(options: unknown) { inputOptions.push(options); return inputs.shift(); },
        async showWorkspaceFolderPick() { folderPicks++; return stub.state.folders[0]; },
        async showWarningMessage() { return undefined; }, async showInformationMessage() { return undefined; }, async showErrorMessage() { return undefined; },
        onDidCloseTerminal: closedTabs.event,
    });
    Object.assign(stub.workspace, { registerTextDocumentContentProvider: () => new stub.Disposable(() => undefined) });
    mock.method(stub.workspace, "onDidChangeConfiguration", configuration.event as typeof stub.workspace.onDidChangeConfiguration);
    mock.method(stub.workspace, "onDidChangeWorkspaceFolders", folders.event as typeof stub.workspace.onDidChangeWorkspaceFolders);
    const getConfiguration = stub.workspace.getConfiguration.bind(stub.workspace);
    mock.method(stub.workspace, "getConfiguration", (section?: string) => { const config = getConfiguration(section), update = config.update.bind(config);
        return { ...config, async update(key: string, value: unknown) { settingWrites.push({ section, key, value }); return update(key, value); } }; });
    mock.method(CheckedGitBashProfile.prototype, "configure", async (target: vscode.Uri) => { configured.push(target.toString()); return { status: "CANCELLED" }; });
    mock.method(CheckedGitBashProfile.prototype, "restore", async (target: vscode.Uri) => { restored.push(target.toString()); return { status: "CANCELLED" }; });
    const update = context.globalState.update.bind(context.globalState);
    mock.method(context.globalState, "update", async (key: string, value: unknown) => { globalWrites.push({ key, value: structuredClone(value) }); await update(key, value); });
    const nativeExecute = stub.commands.executeCommand.bind(stub.commands);
    mock.method(stub.commands, "executeCommand", async (name: string, ...args: unknown[]) => {
        if (name === "soterai.readProjectFileSafely" || name === "soterai.readProjectFile") { fallbackCalls++; throw new Error("Public integration fallback is forbidden."); }
        return nativeExecute(name, ...args);
    });
    mock.method(process, "kill", (() => { pidCalls++; return true; }) as typeof process.kill);
    for (const name of ["lite.gitBashTerminal", "lite.vaultMode", "lite.secretMatching", "lite.outputRedactor"]) flag(name, true);
    stub.resetSinks();
});
afterEach(async () => {
    try {
        for (const controller of controllers) { await bounded(controller.shutdown()); controller.dispose(); }
        if (moduleValue) await bounded(moduleValue.stopCheckedGitBash());
        for (const subscription of context.subscriptions) subscription.dispose();
        assert.equal(pidCalls, 0); assert.equal(nativeSends, 0); assert.equal(fallbackCalls, 0);
        for (const write of globalWrites) safe(write); for (const sink of stub.sinks) assert.ok(!sink.text.includes(PRIVATE));
        assert.ok(!output.join("").includes(PRIVATE));
    } finally {
        mock.restoreAll(); restoreObject(stub.window, windowDescriptors); restoreObject(stub.workspace, workspaceDescriptors); restoreObject(stub.env, envDescriptors);
        if (profileDescriptor) Object.defineProperty(requiredStub, "TerminalProfile", profileDescriptor); else delete requiredStub.TerminalProfile;
        if (platformDescriptor) Object.defineProperty(process, "platform", platformDescriptor);
        configuration.dispose(); folders.dispose(); closedTabs.dispose(); stub.resetState();
    }
});

test("F13-C01 registration contributes one native provider and exactly the five declared routes", async () => {
    const controller = await register(); assert.deepEqual([...providers.keys()], [PROFILE]);
    assert.deepEqual([...stub.registeredCommands.keys()].filter(key => IDS.includes(key)).sort(), [...IDS].sort());
    assert.equal(terminalOptions.length, 0); assert.equal(settingWrites.length, 0); safe(controller.status());
});

test("F13-C02 contributed native profile supplies an owned pty without shellPath, args or inherited env", async () => {
    await register(); const options = await nativeProfile(); assert.ok(options?.pty); assert.equal(options.name, NAME);
    for (const key of ["env", "shellPath", "shellArgs", "strictEnv"]) assert.ok(!Object.hasOwn(options, key));
    attach(options); options.pty.open(); options.pty.handleInput("cat .env.synthetic\r\n");
    await wait(() => output.join("").includes("API_KEY=[MASKED]")); assert.deepEqual(reads, [stub.Uri.file(join(root, ".env.synthetic")).toString()]);
});

test("F13-C03 open command creates an ExtensionTerminalOptions tab and leaves project profile unchanged", async () => {
    await register(); const result = await command("openCheckedGitBash", uri()); safe(result);
    assert.equal(terminalOptions.length, 1); assert.ok(latest()); assert.ok(shows > 0); assert.equal(settingWrites.length, 0);
    assert.ok(!Object.hasOwn(terminalOptions[0], "env")); assert.equal(configured.length, 0);
});

test("F13-C04 run gets command text only from masked native input and ignores command-like caller arguments", async () => {
    await register(); inputs.push("cat .env.synthetic");
    const result = await command("runCheckedGitBash", "echo '" + PRIVATE + "'", { command: PRIVATE, root: uri() }); safe(result);
    assert.equal(inputOptions.length, 1); const options = inputOptions[0] as { password?: boolean; ignoreFocusOut?: boolean; value?: unknown };
    assert.equal(options.password, true); assert.equal(options.ignoreFocusOut, false); assert.ok(!JSON.stringify(options).includes(PRIVATE));
    await wait(() => reads.length === 1); await wait(() => output.join("").includes("API_KEY=[MASKED]")); assert.equal(filterCalls, 1);
});

test("F13-C05 cancelled native command input never becomes caller-provided command execution", async () => {
    await register(); inputs.push(undefined); safe(await command("runCheckedGitBash", PRIVATE));
    assert.equal(reads.length, 0); assert.equal(filterCalls, 0); assert.equal(nativeSends, 0);
});

test("F13-C06 run and pty share the exact bridge, preserving denial and reviewed masking", async () => {
    await register(); response = { status: "DENIED" }; inputs.push("cat .env.synthetic"); await command("runCheckedGitBash");
    await wait(() => reads.length === 1); await wait(() => output.join("").includes("Checked command withheld"));
    // A reader callback entering is not command completion; the PTY deliberately
    // discards typed submissions while that owned operation is still pending.
    await tick(); assert.equal(filterCalls, 0); assert.ok(!output.join("").includes("API_KEY="));
    response = { status: "ALLOWED_ONCE", kind: "environment-schema", text: "API_KEY=[MASKED]\n" };
    latest().handleInput("cat .env.synthetic\r"); await wait(() => filterCalls === 1); await wait(() => output.join("").includes("API_KEY=[MASKED]"));
    assert.equal(reads.length, 2);
});

test("F13-C07 an absent internal reader withholds instead of falling back to a public command", async () => {
    await register(undefined as unknown as Reader); await command("openCheckedGitBash", uri());
    assert.equal(terminalOptions.length, 0); assert.equal(await nativeProfile(), undefined); assert.equal(reads.length, 0); assert.equal(filterCalls, 0);
});

test("F13-C08 disabled bridge prevents profile creation and native command input", async () => {
    readerEnabled = false; await register(); await command("openCheckedGitBash", uri()); await command("runCheckedGitBash");
    assert.equal(terminalOptions.length, 0); assert.equal(inputOptions.length, 0); assert.equal(await nativeProfile(), undefined);
});

test("F13-C09 untrusted workspace cannot open or configure the checked terminal", async () => {
    stub.state.isTrusted = false; await register(); await command("openCheckedGitBash", uri()); await command("configureCheckedGitBash", uri());
    assert.equal(terminalOptions.length, 0); assert.equal(configured.length, 0); assert.equal(await nativeProfile(), undefined);
});

test("F13-C10 a remote extension host never creates a local PowerShell terminal", async () => {
    Object.defineProperty(stub.env, "remoteName", { configurable: true, enumerable: true, value: "synthetic-remote" }); await register();
    await command("openCheckedGitBash", uri()); assert.equal(terminalOptions.length, 0); assert.equal(await nativeProfile(), undefined);
});

for (const name of ["lite.gitBashTerminal", "lite.vaultMode", "lite.secretMatching", "lite.outputRedactor"]) {
    test(`F13-C11 ${name} withdrawal cancels live sessions and preserves saved profile metadata`, async () => {
        context._inspect.workspaceStore.set("soterai.lite.gitBash.profile.v1", { retained: "synthetic prior receipt" }); const before = JSON.stringify([...context._inspect.workspaceStore]);
        await register(); await command("openCheckedGitBash", uri()); assert.equal(terminalOptions.length, 1); flag(name, false);
        assert.ok(revokes > 0); await command("openCheckedGitBash", uri()); assert.equal(terminalOptions.length, 1);
        assert.equal(await nativeProfile(), undefined); assert.equal(settingWrites.length, 0); assert.equal(JSON.stringify([...context._inspect.workspaceStore]), before);
    });
}

test("F13-C12 workspace removal cancels its live session and blocks a new tab", async () => {
    await register(); await command("openCheckedGitBash", uri()); stub.state.folders = []; folders.fire({ removed: [{ uri: uri() }], added: [] });
    assert.ok(revokes > 0); await command("openCheckedGitBash", uri()); assert.equal(terminalOptions.length, 1); assert.equal(await nativeProfile(), undefined);
});

test("F13-C13 flag withdrawal during a native pending read cannot release late approved output", async () => {
    await register(); await command("openCheckedGitBash", uri()); let release!: () => void; const gate = new Promise<void>(done => { release = done; }); readHook = () => gate;
    latest().handleInput("cat .env.synthetic\r");
    try { await wait(() => reads.length === 1); flag("lite.gitBashTerminal", false); assert.ok(revokes > 0); }
    finally { release(); await tick(); await tick(); }
    assert.equal(filterCalls, 0); assert.ok(!output.join("").includes("API_KEY="));
});

test("F13-C14 configure and restore delegate only validated current root URIs to the owned profile manager", async () => {
    await register(); safe(await command("configureCheckedGitBash", uri())); safe(await command("restoreCheckedGitBash", uri()));
    assert.deepEqual(configured, [uri().toString()]); assert.deepEqual(restored, [uri().toString()]); assert.equal(terminalOptions.length, 0);
});

test("F13-C15 native folder selection resolves a root without accepting a caller command as a URI", async () => {
    await register(); await command("configureCheckedGitBash"); await command("restoreCheckedGitBash");
    assert.deepEqual(configured, [uri().toString()]); assert.deepEqual(restored, [uri().toString()]); assert.equal(settingWrites.length, 0);
});

test("F13-C16 invalid/outside/remote root arguments never become profile settings changes", async () => {
    await register(); for (const value of [stub.Uri.file(other), stub.Uri.file(join(root, "child")), stub.Uri.parse("vscode-remote://synthetic/project"), PRIVATE, { fsPath: root }]) {
        await command("configureCheckedGitBash", value); await command("restoreCheckedGitBash", value);
    }
    assert.deepEqual(configured, []); assert.deepEqual(restored, []); assert.equal(settingWrites.length, 0);
});

test("F13-C17 cancelled native folder choice does not mutate a profile", async () => {
    mock.method(stub.window, "showWorkspaceFolderPick", async () => undefined); stub.state.folders.push({ uri: stub.Uri.file(other), name: "other", index: 1 });
    await register(); await command("configureCheckedGitBash"); await command("restoreCheckedGitBash"); assert.deepEqual(configured, []); assert.deepEqual(restored, []);
});

test("F13-C18 status route returns metadata without native input, commands, values or raw input history", async () => {
    const controller = await register(); inputs.push("cat .env.synthetic"); await command("runCheckedGitBash", PRIVATE); await wait(() => filterCalls === 1);
    const before = inputOptions.length; safe(await command("checkedGitBashStatus")); safe(controller.status()); assert.equal(inputOptions.length, before);
});

test("F13-C19 controller disposal unregisters its contributed commands and profile", async () => {
    const controller = await register(); controller.dispose(); controller.dispose(); assert.equal(providers.has(PROFILE), false);
    assert.ok(IDS.every(command => !stub.registeredCommands.has(command)));
});

test("F13-C20 module stop and controller shutdown revoke owned idle sessions without signaling a PID", async () => {
    const controller = await register(); await command("openCheckedGitBash", uri()); await bounded(moduleValue!.stopCheckedGitBash());
    assert.ok(revokes > 0); await bounded(controller.shutdown()); assert.equal(pidCalls, 0); safe(controller.status());
});

for (const [label, saved] of [["null", null], ["object", { state: "unknown" }], ["string", "synthetic corrupt ownership"], ["number", 7]] as const) {
    test(`F13-C21 non-array ${label} ownership blocks launch without overwriting retained metadata`, async () => { await blocked(saved); });
}

test("F13-C22 more than 64 recovered workers withholds instead of discarding prior ownership", async () => {
    await blocked(Array.from({ length: 65 }, (_, index) => record(index)));
});

for (const [label, bad] of [["null row", null], ["unknown field", { ...record(0), env: PRIVATE }], ["invalid UUID", { ...record(0), id: "not-a-worker" }],
    ["unknown state", { ...record(0), state: "ADOPTED" }], ["zero PID", { ...record(0), pid: 0 }], ["fractional PID", { ...record(0), pid: 1.5 }],
    ["bad exit metadata", { ...record(0), exitCode: "0" }]] as const) {
    test(`F13-C23 ${label} ownership fails atomically and blocks before reader/filter admission`, async () => { await blocked([bad]); });
}

test("F13-C24 duplicate ownership identifiers do not silently collapse distinct prior records", async () => {
    await blocked([record(0), { ...record(0), pid: 400001 }]);
});

test("F13-C25 one malformed row cannot be dropped from otherwise valid recovered workers", async () => {
    await blocked([record(0), { ...record(1), pid: -1 }, record(2, "STOP_UNCONFIRMED")]);
});

test("F13-C26 a throwing ownership read preserves the saved bytes and withholds launches", async () => {
    await blocked([record(0)], true);
});

test("F13-C27 recovered native worker rows are always UNVERIFIED and never adopted or signaled", async () => {
    const saved = [record(0, "READY"), record(1), record(2, "CANCEL_PENDING"), record(3, "STOP_UNCONFIRMED")]; context._inspect.globalStore.set(OWNERSHIP, saved);
    const controller = await register(), rows = recovered(controller.status()); assert.equal(rows.length, saved.length);
    for (let index = 0; index < rows.length; index++) { assert.equal(rows[index].id, id(index)); assert.equal(rows[index].state, "UNVERIFIED"); safe(rows[index]); }
    await command("openCheckedGitBash", uri()); assert.equal(terminalOptions.length, 1); latest().handleInput("cat .env.synthetic\r");
    await wait(() => filterCalls === 1); await bounded(controller.shutdown()); assert.equal(pidCalls, 0);
    const retained = context._inspect.globalStore.get(OWNERSHIP) as Array<{ id: string; state: string }>;
    assert.equal(retained.length, saved.length); assert.ok(retained.every(row => row.state === "UNVERIFIED"));
});

test("F13-C28 exactly 64 valid recovered rows stay visible without adopting their PIDs", async () => {
    context._inspect.globalStore.set(OWNERSHIP, Array.from({ length: 64 }, (_, index) => record(index))); const controller = await register();
    const rows = recovered(controller.status()); assert.equal(rows.length, 64); assert.ok(rows.every(row => row.state === "UNVERIFIED"));
    await bounded(controller.shutdown()); assert.equal(pidCalls, 0);
});

test("F13-C29 unrelated global metadata is preserved through registration, use and shutdown", async () => {
    const key = "synthetic.unrelated.owner-metadata", value = { retained: ["public", "metadata"] }; context._inspect.globalStore.set(key, value);
    const controller = await register(); await command("openCheckedGitBash", uri()); await bounded(controller.shutdown());
    assert.deepEqual(context._inspect.globalStore.get(key), value); assert.ok(globalWrites.every(write => write.key !== key));
});

test("F13-C30 a non-Windows host keeps registration inert and cannot launch local PowerShell", async () => {
    Object.defineProperty(process, "platform", { configurable: true, enumerable: true, value: "linux" }); await register();
    await command("openCheckedGitBash", uri()); assert.equal(terminalOptions.length, 0); assert.equal(await nativeProfile(), undefined);
});
