/** F09: actual packaged owner commands, native CustomExecution tasks and an
 * owned inline debug session. Scripted native owner decisions, LOW. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

const TYPE = "soterai-vault", FLAG = "lite.vaultRuntime", MARKER = ".synthetic-lite-f09-host";
const RAW = "postgresql://native:synthetic-native-password-Q8@f09-runtime.invalid/synthetic-db";
const OMITTED = "sk-proj-" + "SYNTHETIC_F09_NATIVE_OMITTED_PRIVATE_VALUE".repeat(2);
const SOURCE = `DATABASE_URL='${RAW}'\nAPI_KEY=${OMITTED}\n`, MASK = "[REDACTED_SECRET_OUTPUT]";
const APP = String.raw`"use strict";
const fs = require("node:fs");
const phase = process.argv[2];
if (!["task-ok", "task-nonzero", "debug-ok", "debug-long", "task-long"].includes(phase)) throw new Error("Invalid synthetic phase.");
const value = process.env.DATABASE_URL;
let parsed; try { parsed = new URL(value); } catch {}
fs.writeFileSync(".synthetic-f09-" + phase + ".json", JSON.stringify({
  injected: !!parsed && parsed.protocol === "postgresql:" && parsed.username === "native" && parsed.password.length > 12 && parsed.hostname === "f09-runtime.invalid" && parsed.pathname === "/synthetic-db",
  excludedVariableAbsent: process.env.API_KEY === undefined,
  controlAbsent: process.env.SOTERAI_LITE_F09_AMBIENT === undefined,
  literalArgs: process.argv.length === 3 && process.argv[2] === phase
}), {flag:"wx"});
process.stdout.write("\x1b[32m" + value + "\x1b[0m"); process.stderr.write("public warning\n");
setTimeout(() => { if (phase === "task-nonzero") process.exitCode = 7; }, phase.endsWith("long") ? 1800 : 600);
`;
type Observation = { id: string; scope: string; status: "NOT_RUN" | "PASS" | "FAIL"; diagnostic?: string };
type PublicStatus = { descriptors: Array<{ id: string; args: string[]; program: string; selections: { name: string; placeholder: string }[]; [key: string]: unknown }>; jobs: Array<{ id: string; state: string; pid?: number; exitCode?: number }> };
type TaskRun = { descriptorId: string; writes: string[]; closed: boolean; exitCode?: number; taskEnded: boolean; execution?: vscode.TaskExecution };
type DebugRun = { session: vscode.DebugSession; messages: Record<string, unknown>[]; terminated: boolean };
const restores: (() => void)[] = [], listeners: vscode.Disposable[] = [], tasks: TaskRun[] = [], debugs: DebugRun[] = [];
let contextOwned: vscode.ExtensionContext | undefined, installed = false, setup: Record<string, unknown> = { phase: "initial" };
let cancelSetup = false, approveRun = true, openQueue: vscode.Uri[][] = [], argsText = "[]";
let taskProviderRegistered = false, sourceDocumentCalls = 0, sourceDocumentEvents = 0, keyGets = 0, keyStores = 0, leaked = false;
const reviews: { action: string; modal: boolean; detailBytes: number }[] = [];
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const within = (root: string, file: string) => { const part = relative(resolve(root), resolve(file)); return part === "" || !part.startsWith("..") && !isAbsolute(part); };
const folder = () => { const value = vscode.workspace.workspaceFolders?.[0]; assert.ok(value); return value; };
const source = () => vscode.Uri.joinPath(folder().uri, ".env.runtime");
const app = () => vscode.Uri.joinPath(folder().uri, "public-runtime.cjs");
const noValues = (value: unknown) => { const text = typeof value === "string" ? value : JSON.stringify(value); for (const raw of [RAW, OMITTED, SOURCE]) assert.ok(!text.includes(raw), "Native surface metadata must withhold synthetic original values."); };
function observe(value: unknown): void { try { noValues(value); } catch { leaked = true; } }
export function setupDiagnostic(): Record<string, unknown> { return { ...setup }; }
function replace(target: object, name: string, value: unknown): void {
    const own = Object.getOwnPropertyDescriptor(target, name); setup = { phase: "replace", name, frozen: Object.isFrozen(target), extensible: Object.isExtensible(target), own: !!own, configurable: own?.configurable, writable: own && "writable" in own ? own.writable : undefined };
    Object.defineProperty(target, name, { configurable: true, enumerable: own?.enumerable ?? false, writable: true, value });
    restores.push(() => { if (own) Object.defineProperty(target, name, own); else Reflect.deleteProperty(target, name); });
}
async function until(check: () => boolean | Promise<boolean>, label: string, ms = 10000): Promise<void> {
    const end = Date.now() + ms; while (Date.now() < end) { if (await check()) return; await new Promise<void>(done => setTimeout(done, 20)); } throw new Error(label);
}
async function proof(phase: string): Promise<void> {
    const file = join(folder().uri.fsPath, ".synthetic-f09-" + phase + ".json");
    await until(async () => { try { await readFile(file); return true; } catch { return false; } }, "Synthetic app readiness missing.");
    const value = JSON.parse(await readFile(file, "utf8"));
    assert.deepEqual(value, { injected: true, excludedVariableAbsent: true, controlAbsent: true, literalArgs: true }); noValues(value);
}
async function status(): Promise<PublicStatus> { const value = await vscode.commands.executeCommand<PublicStatus>("soterai.vaultAppStatus"); assert.ok(value); noValues(value); assert.ok(Array.isArray(value.descriptors) && Array.isArray(value.jobs)); return value; }
async function configure(phase: string): Promise<string> {
    openQueue = [[app()], [source()]]; argsText = JSON.stringify([phase]);
    const result = await vscode.commands.executeCommand<{ id: string; saved: boolean }>("soterai.configureVaultApp");
    assert.ok(result && result.saved); assert.match(result.id, /^[a-f0-9-]{36}$/); noValues(result); assert.equal(openQueue.length, 0); return result.id;
}
async function runTask(id: string, direct = false): Promise<TaskRun> {
    const before = tasks.length;
    if (direct) {
        const candidates = await vscode.tasks.fetchTasks({ type: TYPE }), task = candidates.find(item => item.definition.descriptorId === id); assert.ok(task);
        await vscode.tasks.executeTask(task);
    } else {
        const result = await vscode.commands.executeCommand<{ descriptorId: string; status: string }>("soterai.runVaultApp", id);
        assert.deepEqual(result, { descriptorId: id, status: "TASK_REQUESTED" }); noValues(result);
    }
    await until(() => tasks.length > before, "Native CustomExecution callback was not reached."); return tasks[before];
}
async function finishTask(run: TaskRun): Promise<void> { await until(() => run.closed && run.taskEnded, "Actual task completion event missing."); assert.equal(leaked, false); noValues(run.writes); }
async function startDebug(id: string): Promise<DebugRun> {
    const before = debugs.length, config = { type: TYPE, request: "launch", name: "F09 synthetic lifecycle", descriptorId: id, noDebug: true }; noValues(config);
    assert.equal(await vscode.debug.startDebugging(folder(), config), true); await until(() => debugs.length > before, "Native debug tracker was not reached."); return debugs[before];
}
const debugEvents = (run: DebugRun, event: string) => run.messages.filter(message => message.type === "event" && message.event === event);
async function finishDebug(run: DebugRun): Promise<void> { await until(() => run.terminated && debugEvents(run, "terminated").length === 1, "Actual debug termination missing."); assert.equal(leaked, false); noValues(run.messages); }

/** Native API plumbing capture; all task execution and debug traffic delegates
 * to VS Code and the actual packaged extension. No fake job or child exists. */
export function beforeActivate(context: vscode.ExtensionContext): void {
    assert.equal(installed, false); installed = true; contextOwned = context;
    const profile = process.env.SOTERAI_LITE_F09_PROFILE; assert.ok(profile && isAbsolute(profile));
    assert.equal(resolve(process.env.USERPROFILE ?? ""), resolve(profile)); assert.equal(vscode.workspace.workspaceFolders?.length, 1);
    assert.match(resolve(folder().uri.fsPath), /^D:\\/i); assert.match(resolve(profile), /^D:\\/i);
    assert.equal(readFileSync(join(folder().uri.fsPath, MARKER), "utf8"), "synthetic-only-v1");
    assert.ok(within(profile, context.globalStorageUri.fsPath)); assert.ok(!within(folder().uri.fsPath, context.globalStorageUri.fsPath));
    const get = context.secrets.get, store = context.secrets.store;
    replace(context.secrets, "get", async (key: string) => { if (key === "soterai.vaultKey") keyGets++; return get.call(context.secrets, key); });
    replace(context.secrets, "store", async (key: string, value: string) => { if (key === "soterai.vaultKey") keyStores++; return store.call(context.secrets, key, value); });
    const open = vscode.workspace.openTextDocument;
    replace(vscode.workspace, "openTextDocument", (...args: unknown[]) => { if (args[0] instanceof vscode.Uri && args[0].toString() === source().toString()) sourceDocumentCalls++; return Reflect.apply(open as (...args: unknown[]) => unknown, vscode.workspace, args); });
    listeners.push(vscode.workspace.onDidOpenTextDocument(document => { if (document.uri.toString() === source().toString()) sourceDocumentEvents++; }));
    replace(vscode.window, "showOpenDialog", async () => cancelSetup ? undefined : openQueue.shift());
    replace(vscode.window, "showInputBox", async () => argsText);
    replace(vscode.window, "showQuickPick", async (items: readonly { label: string }[] | Thenable<readonly { label: string }[]>, options?: vscode.QuickPickOptions) => {
        const values = await items; if (options?.canPickMany) return values.filter(item => item.label === "DATABASE_URL"); return values[0];
    });
    replace(vscode.window, "showWarningMessage", async (message: string, ...items: unknown[]) => {
        noValues(message); const options = items[0] as vscode.MessageOptions; if (options?.detail) noValues(options.detail);
        const action = items.find(item => ["Migrate securely", "Run selected app", "Allow safe read once"].includes(item as string));
        if (typeof action !== "string") return undefined; assert.equal(options?.modal, true);
        reviews.push({ action, modal: true, detailBytes: Buffer.byteLength(options.detail ?? "", "utf8") }); return action === "Run selected app" && !approveRun ? undefined : action;
    });
    for (const name of ["showInformationMessage", "showErrorMessage"]) replace(vscode.window, name, async (message: string) => { noValues(message); return undefined; });
    const register = vscode.tasks.registerTaskProvider;
    replace(vscode.tasks, "registerTaskProvider", (type: string, provider: vscode.TaskProvider) => { if (type === TYPE) taskProviderRegistered = true; return register.call(vscode.tasks, type, provider); });
    const execute = vscode.tasks.executeTask;
    replace(vscode.tasks, "executeTask", async (task: vscode.Task) => {
        if (task.definition.type !== TYPE) return execute.call(vscode.tasks, task);
        assert.deepEqual(Object.keys(task.definition).sort(), ["descriptorId", "type"]); noValues(task.definition);
        assert.ok(task.execution instanceof vscode.CustomExecution); assert.equal((task.execution as unknown as { options?: unknown }).options, undefined);
        // The real API's CustomExecution stores its callback internally; this
        // capture delegates that native callback without replacing job logic.
        const execution = task.execution as vscode.CustomExecution & { readonly callback: (definition: vscode.TaskDefinition) => Thenable<vscode.Pseudoterminal> };
        const original = execution.callback; assert.equal(typeof original, "function");
        const run: TaskRun = { descriptorId: task.definition.descriptorId, writes: [], closed: false, taskEnded: false };
        task.execution = new vscode.CustomExecution(async definition => {
            const terminal = await original.call(execution, definition); tasks.push(run);
            listeners.push(terminal.onDidWrite(text => { observe(text); run.writes.push(text); }));
            if (terminal.onDidClose) listeners.push(terminal.onDidClose(code => { run.closed = true; if (typeof code === "number") run.exitCode = code; })); return terminal;
        });
        const result = await execute.call(vscode.tasks, task); run.execution = result; return result;
    });
    listeners.push(vscode.tasks.onDidEndTask(event => { const run = tasks.find(item => item.execution === event.execution); if (run) run.taskEnded = true; }));
    listeners.push(vscode.debug.registerDebugAdapterTrackerFactory(TYPE, { createDebugAdapterTracker(session) {
        const run: DebugRun = { session, messages: [], terminated: false }; debugs.push(run); observe(session.configuration);
        return { onDidSendMessage(message) { observe(message); run.messages.push(message as Record<string, unknown>); }, onWillReceiveMessage(message) { observe(message); } };
    } }));
    listeners.push(vscode.debug.onDidTerminateDebugSession(session => { const run = debugs.find(item => item.session.id === session.id); if (run) run.terminated = true; }));
}

export async function run(context: vscode.ExtensionContext): Promise<void> {
    const output = process.env.SOTERAI_LITE_F09_EVIDENCE, profile = process.env.SOTERAI_LITE_F09_PROFILE;
    if (!output || !isAbsolute(output)) throw new Error("New absolute F09 evidence path required.");
    const scopes = [
        "Actual packaged native activation, registered commands and task provider are present in the owned isolated profile.",
        "Native owner configuration cancellation stores no descriptor and starts no application.",
        "Existing F06 native migration creates real SecretStorage-backed ciphertext and on-disk placeholders without source TextDocuments.",
        "Native setup stores strict public descriptor metadata selecting only DATABASE_URL with literal public arguments.",
        "VS Code fetchTasks invokes the actual provider and returns ID-only CustomExecution tasks without process/env options.",
        "Fresh owner run cancellation completes the actual task without spawning an owned job.",
        "Actual registered task injects a fake selected value, excludes unselected/ambient values and releases only finalized masked output.",
        "An actual provider task preserves natural nonzero exit through native task completion.",
        "An actual inline debug session injects the selected value, masks output and rejects source evaluation capabilities.",
        "Native terminate acknowledges cooperative stop while the finite app still lives and emits termination only after actual close.",
        "Machine withdrawal stops an owned finite task, withholds pending output, blocks setup and preserves ciphertext and saved restrictions.",
        "Managed safe read and status retain masking and value-free metadata after native task/debug lifecycles; no original source document opens.",
    ];
    const observations: Observation[] = scopes.map((scope, index) => ({ id: "F09-H" + String(index + 1).padStart(2, "0"), scope, status: "NOT_RUN" }));
    let runtime = "", bundle = "", root = "", driverFailure: string | undefined, firstId = "", oldFlag: boolean | undefined, config: vscode.WorkspaceConfiguration | undefined;
    const check = async (index: number, action: () => Promise<void>) => { const row = observations[index - 1]; try { await action(); row.status = "PASS"; } catch (error) { row.status = "FAIL"; row.diagnostic = (error instanceof Error ? error.name : "UnknownFailure") + " at " + row.id; } console.log("LITE_VAULT_RUNTIME_HOST " + row.id + " " + row.status); };
    try {
        assert.equal(contextOwned, context); assert.equal(context.extensionMode, vscode.ExtensionMode.Development); assert.equal(process.env.SOTERAI_LITE_F09_DRIVER_KIND, "native-bootstrap");
        assert.ok(profile && isAbsolute(profile)); assert.ok(vscode.workspace.isTrusted); root = folder().uri.fsPath;
        bundle = join(context.extensionUri.fsPath, "dist/extension.js"); runtime = sha(await readFile(bundle)); assert.equal(runtime, process.env.SOTERAI_LITE_F09_BUNDLE_SHA256);
        config = vscode.workspace.getConfiguration("soterai"); oldFlag = config.inspect<boolean>(FLAG)?.globalValue; await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        await writeFile(source().fsPath, SOURCE, { flag: "wx" }); await writeFile(app().fsPath, APP, { flag: "wx" });
        await check(1, async () => { const names = await vscode.commands.getCommands(true); for (const name of ["configureVaultApp", "runVaultApp", "stopVaultApp", "vaultAppStatus", "migrateSecretsToVault"]) assert.ok(names.includes("soterai." + name)); assert.equal(taskProviderRegistered, true); assert.equal((await status()).descriptors.length, 0); });
        await check(2, async () => { cancelSetup = true; const value = await vscode.commands.executeCommand("soterai.configureVaultApp"); cancelSetup = false; assert.equal(value, undefined); assert.equal((await status()).descriptors.length, 0); assert.equal(tasks.length, 0); });
        await check(3, async () => { await vscode.commands.executeCommand("soterai.migrateSecretsToVault", source()); const text = await readFile(source().fsPath, "utf8"); noValues(text); assert.equal((text.match(/\[SOTERAI_PROTECTED_[A-F0-9]{32}_[0-9]+\]/g) ?? []).length, 2); assert.ok(keyGets > 0 && keyStores > 0); const encrypted = await readFile(join(context.globalStorageUri.fsPath, "soterai-vault.enc")); noValues(encrypted.toString("utf8")); assert.equal(sourceDocumentCalls, 0); assert.equal(sourceDocumentEvents, 0); });
        await check(4, async () => { firstId = await configure("task-ok"); const current = (await status()).descriptors.find(item => item.id === firstId); assert.ok(current); assert.deepEqual(current.args, ["task-ok"]); assert.deepEqual(current.selections.map(item => item.name), ["DATABASE_URL"]); assert.ok(current.selections.every(item => /^\[SOTERAI_PROTECTED_[A-F0-9]{32}_[0-9]+\]$/.test(item.placeholder))); });
        await check(5, async () => { const available = await vscode.tasks.fetchTasks({ type: TYPE }), task = available.find(item => item.definition.descriptorId === firstId); assert.ok(task); assert.ok(task.execution instanceof vscode.CustomExecution); assert.deepEqual(Object.keys(task.definition).sort(), ["descriptorId", "type"]); noValues(task.definition); });
        await check(6, async () => { const before = (await status()).jobs.length; approveRun = false; const task = await runTask(firstId); await finishTask(task); approveRun = true; assert.equal((await status()).jobs.length, before); assert.ok(!task.writes.join("").includes(MASK)); });
        await check(7, async () => { const before = process.env.DATABASE_URL, task = await runTask(firstId); await proof("task-ok"); assert.equal(task.closed, false); assert.equal(task.writes.length, 0); await finishTask(task); assert.ok(task.writes.join("").includes(MASK)); assert.equal(task.exitCode, 0); assert.ok(process.env.DATABASE_URL === before, "The editor's parent environment must remain unchanged."); });
        await check(8, async () => { const id = await configure("task-nonzero"), task = await runTask(id, true); await proof("task-nonzero"); await finishTask(task); assert.equal(task.exitCode, 7); assert.ok(task.writes.join("").includes(MASK)); });
        await check(9, async () => { const id = await configure("debug-ok"), debug = await startDebug(id); await proof("debug-ok"); let rejected = false; try { await debug.session.customRequest("evaluate", { expression: "process.env.DATABASE_URL" }); } catch { rejected = true; } assert.equal(rejected, true); await finishDebug(debug); const outputText = debugEvents(debug, "output").map(message => (message.body as { output?: string })?.output ?? "").join(""); assert.ok(outputText.includes(MASK)); const initialized = debug.messages.find(message => message.type === "response" && message.command === "initialize"); const capabilities = initialized?.body as Record<string, unknown> | undefined; assert.equal(capabilities?.supportsConfigurationDoneRequest, true); assert.notEqual(capabilities?.supportsEvaluateForHovers, true); assert.notEqual(capabilities?.supportsReadMemoryRequest, true); });
        await check(10, async () => { const id = await configure("debug-long"), debug = await startDebug(id); await proof("debug-long"); await debug.session.customRequest("terminate"); assert.equal(debugEvents(debug, "terminated").length, 0); assert.equal(debug.terminated, false); assert.ok((await status()).jobs.some(job => ["RUNNING", "STOP_REQUESTED", "STOP_UNCONFIRMED"].includes(job.state))); await finishDebug(debug); assert.equal(debugEvents(debug, "exited").length, 1); assert.ok(!debugEvents(debug, "output").some(message => (message.body as { output?: string })?.output?.includes(MASK))); });
        await check(11, async () => { const id = await configure("task-long"), task = await runTask(id); await proof("task-long"); const encrypted = sha(await readFile(join(context.globalStorageUri.fsPath, "soterai-vault.enc"))), original = sha(await readFile(source().fsPath)); await config!.update(FLAG, false, vscode.ConfigurationTarget.Global); await finishTask(task); assert.ok(!task.writes.join("").includes(MASK)); assert.equal(await vscode.commands.executeCommand("soterai.configureVaultApp"), undefined); assert.equal(sha(await readFile(join(context.globalStorageUri.fsPath, "soterai-vault.enc"))), encrypted); assert.equal(sha(await readFile(source().fsPath)), original); assert.ok(JSON.stringify(context.workspaceState.get("soterai.aiForbidden.v1", {})).includes(".env.runtime")); });
        await check(12, async () => { const read = await vscode.commands.executeCommand<{ text?: string }>("soterai.readProjectFileSafely", source()); assert.ok(read && typeof read.text === "string"); noValues(read); assert.ok(read.text.includes("DATABASE_URL=[MASKED]")); const current = await status(); assert.ok(current.jobs.length >= 5); assert.ok(current.jobs.every(job => !["RUNNING", "STOP_REQUESTED", "STOP_UNCONFIRMED"].includes(job.state))); assert.equal(sourceDocumentCalls, 0); assert.equal(sourceDocumentEvents, 0); assert.equal(vscode.workspace.textDocuments.some(document => document.uri.toString() === source().toString()), false); assert.equal(leaked, false); });
    } catch (error) { driverFailure = error instanceof Error ? error.name : "UnknownFailure"; }
    finally {
        approveRun = true; cancelSetup = false;
        if (config) try { await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global); } catch { driverFailure = "IsolatedFlagRestoreFailure"; }
        // Finite synthetic apps self-exit in <=1.8s; never terminate a task or PID.
        try { await until(() => tasks.every(task => task.closed) && debugs.every(debug => debug.terminated), "Synthetic lifecycle cleanup incomplete.", 5000); } catch { driverFailure = "OwnedSyntheticLifecycleIncomplete"; }
        for (const listener of listeners.reverse()) listener.dispose(); for (const restore of restores.reverse()) restore();
    }
    const current = bundle ? sha(await readFile(bundle)) : ""; if (current !== runtime) driverFailure = "RuntimeIdentityChanged";
    const result = { schemaVersion: 1, observedAt: new Date().toISOString(), phase: "single", syntheticOnly: true, workspace: root, declaredProfilePath: resolve(profile ?? ""), hostVersion: vscode.version, extensionMode: "Development",
        extensionBundleSha256: runtime, currentDeveloperBundleSha256: current, hostProbeSha256: sha(await readFile(__filename)), observations,
        passed: observations.filter(item => item.status === "PASS").length, failed: observations.filter(item => item.status === "FAIL").length, notRun: observations.filter(item => item.status === "NOT_RUN").length,
        ...(driverFailure ? { driverFailure } : {}), reviews, sourceDocumentCalls, sourceDocumentEvents, secretStorageApi: { keyGets, keyStores },
        taskRuns: tasks.map(task => ({ descriptorId: task.descriptorId, closed: task.closed, taskEnded: task.taskEnded, exitCode: task.exitCode, outputBytes: Buffer.byteLength(task.writes.join(""), "utf8"), safe: !leaked })),
        debugRuns: debugs.map(debug => ({ descriptorId: debug.session.configuration.descriptorId, terminated: debug.terminated, outputEvents: debugEvents(debug, "output").length, exitedEvents: debugEvents(debug, "exited").length, safe: !leaked })),
        independence: "LOW", ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW", identityScope: "Unchanged packaged runtime in a unique isolated native developer window; no installed-VSIX lifecycle claim.",
        limitation: "Owned finite Node app/task/inline debug lifecycle only. Application proof receipts contain constant booleans, not values or value hashes. Selected app can inspect/transmit/write its values; no OS confinement, source debugger, external agent, native shell or gateway interception proof." };
    noValues(result); await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    if (result.failed || result.notRun || driverFailure) throw new Error("F09 native fixture failed or incomplete; inspect safe observations.");
}
