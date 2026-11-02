/** F25: actual packaged vault tasks and inline lifecycle DAP over synthetic
 * complete-window registrations. Native owner decisions are scripted (LOW).
 * F09's separate fixture is preserved. This fixture neither creates a fake
 * child nor substitutes runtime/collector logic. Children self-complete; every
 * observation delegates spawn and IPC and requires real close plus both EOFs.
 */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import childProcess, { type ChildProcess, type SpawnOptions } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

const TYPE = "soterai-vault", RUNTIME_FLAG = "lite.vaultRuntime", LOG_FLAG = "lite.logProtection";
const MARKER = ".synthetic-lite-f25-owned-output-host";
const SELECTED = "postgresql://native:synthetic-f25-password@f25-owned.invalid/database";
// Deliberately plain, low-entropy prose: neither a provider credential nor a
// sensitive assignment in the emitted payload. The actual pre-registration
// native control proves that the same raw output survives heuristic filtering.
const OPAQUE = "elm river copper meadow lantern";
const SOURCE = "DATABASE_URL='" + SELECTED + "'\n", REGISTRY_SOURCE = "API_KEY='" + OPAQUE + "'\n";
const MASK = "[REDACTED_SECRET_OUTPUT]", WARNING = "Public F25 owned warning\n";
const PUBLIC_BODY = JSON.stringify({ message: "Public caf\u00e9 \u96ea assertion", code: 7,
    extra: ["C:\\public\\test\\build.cjs:12:7", false, null] });
const ESCAPED = [...OPAQUE].map(char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0")).join("");
const SPLIT_BODY = JSON.stringify({ actual: OPAQUE.slice(0, 13), nested: { expected: OPAQUE.slice(13) } }).replace("elm", "\\u0065lm");
const PHASES = ["control", "task-raw", "debug-raw", "task-structured", "debug-structured", "task-arrival", "debug-arrival",
    "task-public", "debug-public", "task-provider", "debug-provider", "task-withdrawal", "debug-withdrawal"] as const;
type Phase = typeof PHASES[number];

const APP = String.raw`"use strict";
const fs = require("node:fs");
const phase = process.argv[2];
if (!${JSON.stringify(PHASES)}.includes(phase)) throw new Error("Invalid synthetic phase.");
const opaque = ${JSON.stringify(OPAQUE)}, selected = ${JSON.stringify(SELECTED)};
let stopInvoked = false, abortObserved = false;
const put = (suffix, value) => fs.writeFileSync(".synthetic-f25-" + phase + suffix + ".json", JSON.stringify(value), {flag:"wx"});
const pause = milliseconds => new Promise(done => setTimeout(done, milliseconds));
// F28_OBSERVATION_WAIT_BEGIN: extracted component tests execute this exact helper.
async function waitForObservation(read, pause, now, file, budgetMs = 5000) {
  const deadline = now() + budgetMs;
  while (now() < deadline) {
    try { if (read(file, "utf8") === "observed") return true; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    await pause(Math.min(25, Math.max(1, deadline - now())));
  }
  return false;
}
// F28_OBSERVATION_WAIT_END
exports.stop = () => { stopInvoked = true; };
exports.start = async signal => {
  signal.addEventListener("abort", () => { abortObserved = true; }, {once:true});
  put("-ready", {selectedExact: process.env.DATABASE_URL === selected, unselectedAbsent: process.env.API_KEY === undefined,
    ambientAbsent: process.env.SOTERAI_LITE_F25_AMBIENT === undefined, literalArgs: process.argv.length === 3 && process.argv[2] === phase});
  if (phase.endsWith("arrival")) {
    const body = [...opaque].map(char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0")).join("");
    process.stdout.write(body.slice(0, 10 * 6)); await pause(100);
    process.stderr.write(body.slice(10 * 6, 23 * 6)); await pause(100);
    process.stdout.write(body.slice(23 * 6) + "\n");
  } else if (phase.endsWith("structured")) {
    const body = JSON.stringify({actual: opaque.slice(0, 13), nested: {expected: opaque.slice(13)}}).replace("elm", "\\u0065lm");
    // Strict semantic parsing must reconstruct the two decoded leaves. No
    // complete registration occurs in either wire JSON string or raw body.
    process.stdout.write(body + "\n"); process.stderr.write(${JSON.stringify(WARNING)});
  } else if (phase.endsWith("public")) {
    process.stdout.write("\x1b[32m" + ${JSON.stringify(PUBLIC_BODY)} + "\x1b[0m\r\n");
    process.stderr.write("\x1b[33m" + ${JSON.stringify(WARNING.trimEnd())} + "\x1b[0m\r\n");
  } else if (phase.endsWith("provider")) {
    process.stdout.write("\x1b[32m" + JSON.stringify({failure:{actual:process.env.DATABASE_URL},message:"public normalized failure"}) + "\x1b[0m\r\n");
    process.stderr.write("\x1b[33m" + ${JSON.stringify(WARNING.trimEnd())} + "\x1b[0m\r\n");
  } else if (phase.endsWith("withdrawal")) {
    // The same useful public JSON already checked by the public phases is a
    // releasable candidate without withdrawal; admission cannot cause refusal.
    process.stdout.write(${JSON.stringify(PUBLIC_BODY)} + "\n");
    process.stderr.write(${JSON.stringify(WARNING)});
  } else {
    process.stdout.write(opaque + "\n"); process.stderr.write(${JSON.stringify(WARNING)});
  }
  // STOP only records cooperative notification. The finite app completes its
  // own timer and writes a value-free receipt, including after withdrawal.
  // The observer must inspect pending output before the finite app completes.
  // Only synthetic scheduling changes: no extra IPC or product capabilities.
  // Missing acknowledgement fails finitely within 5s; withdrawal retains 2600ms.
  if (!phase.endsWith("withdrawal") && !await waitForObservation(fs.readFileSync, pause, Date.now,
      ".synthetic-f25-" + phase + "-observed.txt")) throw new Error("Synthetic observation deadline.");
  await pause(phase.endsWith("withdrawal") ? 2600 : 650);
  const code = phase.endsWith("public") ? 23 : phase.endsWith("provider") ? 31 : phase.endsWith("arrival") ? 29 : 0;
  put("-natural", {completed:true, stopInvoked, abortObserved, exitCode:code});
  process.exitCode = code;
};
`;

type Observation = { id: string; scope: string; status: "NOT_RUN" | "PASS" | "FAIL"; diagnostic?: string };
type PublicStatus = { descriptors: Array<{ id: string; args: string[]; selections: Array<{ name: string; placeholder: string }> }>;
    jobs: Array<{ id: string; state: string; pid?: number; exitCode?: number }> };
type TaskRun = { descriptorId: string; publicControl: boolean; writes: string[]; closed: boolean; exitCode?: number;
    taskEnded: boolean; execution?: vscode.TaskExecution };
type DebugRun = { session: vscode.DebugSession; messages: Record<string, unknown>[]; terminated: boolean };
type ChildReceipt = { phase: Phase; closed: boolean; code: number | null; signal: NodeJS.Signals | null;
    stdoutEOF: boolean; stderrEOF: boolean; streamError: boolean; stdoutBytes: number; stderrBytes: number;
    signalsRequested: number; startMessages: number; stopMessages: number; injectionValid: boolean;
    spawnOptionsValid: boolean; wireOutputVerified: boolean; interleavedArrivalObserved: boolean;
    naturalCompletionObserved: boolean; cooperativeAbortObserved: boolean; parentEnvironmentUnchanged: boolean;
    pendingCandidateBytesObserved: boolean };
type ChildCapture = { receipt: ChildReceipt; stdout: Buffer[]; stderr: Buffer[]; arrival: Array<{ channel: "stdout" | "stderr"; text: string }> };
const restores: Array<() => void> = [], listeners: vscode.Disposable[] = [], tasks: TaskRun[] = [], debugs: DebugRun[] = [];
const children: ChildCapture[] = [], descriptorPhases = new Map<string, Phase>();
const reviews: Array<{ action: string; modal: boolean; detailBytes: number }> = [];
let contextOwned: vscode.ExtensionContext | undefined, installed = false, setup: Record<string, unknown> = { phase: "initial" };
let cancelSetup = false, openQueue: vscode.Uri[][] = [], argsText = "[]", taskProviderRegistered = false;
let sourceDocumentCalls = 0, sourceDocumentEvents = 0, keyGets = 0, keyStores = 0, leaked = false;
let parentEnvironmentCheck: () => boolean = () => false;
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const within = (root: string, file: string) => { const part = relative(resolve(root), resolve(file)); return part === "" || !part.startsWith("..") && !isAbsolute(part); };
const folder = () => { const value = vscode.workspace.workspaceFolders?.[0]; assert.ok(value); return value; };
const source = () => vscode.Uri.joinPath(folder().uri, ".env.runtime");
const registrySource = () => vscode.Uri.joinPath(folder().uri, "registration", ".env.runtime");
const app = () => vscode.Uri.joinPath(folder().uri, "public-log-runtime.cjs");
const isSource = (value: unknown) => value instanceof vscode.Uri && [source(), registrySource()].some(uri => uri.toString() === value.toString());
function noValues(value: unknown, publicControl = false): void {
    const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    for (const raw of [SELECTED, SOURCE, REGISTRY_SOURCE, ...(publicControl ? [] : [OPAQUE, SPLIT_BODY, ESCAPED])])
        assert.ok(!text.includes(raw), "Native metadata or protected output disclosed synthetic original content.");
}
function observe(value: unknown, publicControl = false): void { try { noValues(value, publicControl); } catch { leaked = true; } }
export function setupDiagnostic(): Record<string, unknown> { return { ...setup }; }
function replace(target: object, name: string, value: unknown): void {
    const own = Object.getOwnPropertyDescriptor(target, name);
    setup = { phase: "replace", name, frozen: Object.isFrozen(target), extensible: Object.isExtensible(target), own: !!own,
        configurable: own?.configurable, writable: own && "writable" in own ? own.writable : undefined };
    Object.defineProperty(target, name, { configurable: true, enumerable: own?.enumerable ?? false, writable: true, value });
    restores.push(() => { if (own) Object.defineProperty(target, name, own); else Reflect.deleteProperty(target, name); });
}
async function until(check: () => boolean | Promise<boolean>, label: string, ms = 10000): Promise<void> {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await check()) return; await new Promise<void>(done => setTimeout(done, 20)); }
    throw new Error(label);
}
async function proof(phase: Phase, natural = false): Promise<Record<string, unknown>> {
    const file = join(folder().uri.fsPath, ".synthetic-f25-" + phase + (natural ? "-natural" : "-ready") + ".json");
    await until(async () => { try { await readFile(file); return true; } catch { return false; } }, "Synthetic readiness or natural completion missing.");
    const value = JSON.parse(await readFile(file, "utf8")); noValues(value);
    if (!natural) assert.deepEqual(value, { selectedExact: true, unselectedAbsent: true, ambientAbsent: true, literalArgs: true });
    return value;
}
// F28_OBSERVATION_CONFIRM_BEGIN: extracted component tests execute this exact helper.
async function confirmPendingObservation(phase: Phase, check: () => void | Promise<void>): Promise<void> {
    await check();
    await writeFile(join(folder().uri.fsPath, ".synthetic-f25-" + phase + "-observed.txt"), "observed", { flag: "wx" });
}
// F28_OBSERVATION_CONFIRM_END
async function status(): Promise<PublicStatus> {
    const value = await vscode.commands.executeCommand<PublicStatus>("soterai.vaultAppStatus");
    assert.ok(value && Array.isArray(value.descriptors) && Array.isArray(value.jobs)); noValues(value); return value;
}
async function configure(phase: Phase): Promise<string> {
    openQueue = [[app()], [source()]]; argsText = JSON.stringify([phase]);
    const result = await vscode.commands.executeCommand<{ id: string; saved: boolean }>("soterai.configureVaultApp");
    assert.ok(result?.saved); assert.match(result.id, /^[a-f0-9-]{36}$/); noValues(result); assert.equal(openQueue.length, 0);
    const descriptor = (await status()).descriptors.find(item => item.id === result.id); assert.ok(descriptor);
    assert.deepEqual(descriptor.args, [phase]); assert.deepEqual(descriptor.selections.map(item => item.name), ["DATABASE_URL"]);
    descriptorPhases.set(result.id, phase); return result.id;
}
async function runTask(id: string, direct = false): Promise<TaskRun> {
    const before = tasks.length;
    if (direct) {
        const available = await vscode.tasks.fetchTasks({ type: TYPE }), task = available.find(item => item.definition.descriptorId === id); assert.ok(task);
        await vscode.tasks.executeTask(task);
    } else {
        const value = await vscode.commands.executeCommand("soterai.runVaultApp", id);
        assert.deepEqual(value, { descriptorId: id, status: "TASK_REQUESTED" }); noValues(value);
    }
    await until(() => tasks.length > before, "Native CustomExecution callback missing."); return tasks[before];
}
async function finishTask(run: TaskRun): Promise<void> {
    await until(() => run.closed && run.taskEnded, "Actual native task completion missing.");
    assert.equal(leaked, false); noValues(run.writes, run.publicControl);
}
async function startDebug(id: string): Promise<DebugRun> {
    const before = debugs.length, config = { type: TYPE, request: "launch", name: "F25 synthetic lifecycle", descriptorId: id, noDebug: true };
    noValues(config); assert.equal(await vscode.debug.startDebugging(folder(), config), true);
    await until(() => debugs.length > before, "Native DAP tracker missing."); return debugs[before];
}
const events = (run: DebugRun, event: string) => run.messages.filter(message => message.type === "event" && message.event === event);
const debugOutput = (run: DebugRun) => events(run, "output").map(message => (message.body as { output?: string })?.output ?? "").join("");
async function finishDebug(run: DebugRun): Promise<void> {
    await until(() => run.terminated && events(run, "terminated").length === 1, "Actual DAP termination missing.");
    assert.equal(leaked, false); noValues(run.messages); assert.equal(events(run, "exited").length, 1);
}
function childFor(phase: Phase): ChildCapture {
    const rows = children.filter(child => child.receipt.phase === phase); assert.equal(rows.length, 1); return rows[0];
}
function capture(child: ChildProcess, phase: Phase, spawnOptionsValid: boolean): void {
    const row: ChildReceipt = { phase, closed: false, code: null, signal: null, stdoutEOF: false, stderrEOF: false,
        streamError: false, stdoutBytes: 0, stderrBytes: 0, signalsRequested: 0, startMessages: 0, stopMessages: 0,
        injectionValid: true, spawnOptionsValid, wireOutputVerified: false, interleavedArrivalObserved: false,
        naturalCompletionObserved: false, cooperativeAbortObserved: false, parentEnvironmentUnchanged: false,
        pendingCandidateBytesObserved: false };
    const value: ChildCapture = { receipt: row, stdout: [], stderr: [], arrival: [] }; children.push(value);
    // A forbidden signal attempt is counted and refused; no signal is delegated.
    const kill = child.kill;
    child.kill = (() => { row.signalsRequested++; throw Error("Synthetic owned output verification forbids process signals."); }) as typeof child.kill;
    restores.push(() => { child.kill = kill; });
    const send = child.send;
    child.send = function (...args: unknown[]) {
        const message = args[0] as { type?: unknown; values?: Record<string, unknown> } | undefined;
        if (message?.type === "START") {
            row.startMessages++;
            if (Object.keys(message).sort().join(",") !== "type,values" || !message.values
                || Object.keys(message.values).join(",") !== "DATABASE_URL" || message.values.DATABASE_URL !== SELECTED
                || JSON.stringify(message).includes(OPAQUE)) row.injectionValid = false;
        } else if (message?.type === "STOP" && Object.keys(message).join(",") === "type") row.stopMessages++;
        else row.injectionValid = false;
        return Reflect.apply(send, child, args);
    } as typeof child.send;
    restores.push(() => { child.send = send; });
    child.once("error", () => { row.streamError = true; });
    child.once("close", (code, signal) => { row.closed = true; row.code = code; row.signal = signal; });
    for (const channel of ["stdout", "stderr"] as const) {
        const stream = child[channel]; assert.ok(stream);
        stream.on("data", (bytes: Buffer) => {
            row[channel === "stdout" ? "stdoutBytes" : "stderrBytes"] += bytes.length;
            value[channel].push(Buffer.from(bytes)); value.arrival.push({ channel, text: bytes.toString("utf8") });
        });
        stream.once("end", () => { if (channel === "stdout") row.stdoutEOF = true; else row.stderrEOF = true; });
        stream.once("error", () => { row.streamError = true; });
    }
}
async function assertNatural(phase: Phase, code: number, withdrew = false): Promise<void> {
    const value = childFor(phase), row = value.receipt;
    await until(() => row.closed && row.stdoutEOF && row.stderrEOF, "Owned child actual close and both EOFs missing.");
    assert.equal(row.code, code); assert.equal(row.signal, null); assert.equal(row.streamError, false); assert.equal(row.signalsRequested, 0);
    assert.equal(row.startMessages, 1); assert.equal(row.injectionValid, true); assert.equal(row.spawnOptionsValid, true);
    row.parentEnvironmentUnchanged = parentEnvironmentCheck();
    assert.equal(row.parentEnvironmentUnchanged, true, "Every child must preserve the parent variables captured before the first owned launch.");
    const natural = await proof(phase, true);
    assert.deepEqual(natural, { completed: true, stopInvoked: withdrew, abortObserved: withdrew, exitCode: code });
    assert.equal(withdrew ? row.stopMessages >= 1 : row.stopMessages === 0, true);
    row.naturalCompletionObserved = true; row.cooperativeAbortObserved = natural.abortObserved === true;
    const stdout = Buffer.concat(value.stdout).toString("utf8"), stderr = Buffer.concat(value.stderr).toString("utf8");
    if (phase.endsWith("arrival")) {
        assert.equal(stdout, ESCAPED.slice(0, 60) + ESCAPED.slice(138) + "\n");
        assert.equal(stderr, ESCAPED.slice(60, 138));
        assert.equal(value.arrival.map(part => part.text).join(""), ESCAPED + "\n");
        const order = value.arrival.map(part => part.channel).filter((channel, index, channels) => index === 0 || channel !== channels[index - 1]);
        assert.deepEqual(order, ["stdout", "stderr", "stdout"]); row.interleavedArrivalObserved = true;
    } else if (phase.endsWith("structured")) {
        assert.equal(stdout, SPLIT_BODY + "\n"); assert.equal(stdout.includes(OPAQUE), false); assert.equal(stderr, WARNING);
    } else if (phase.endsWith("public")) {
        assert.equal(stdout, "\x1b[32m" + PUBLIC_BODY + "\x1b[0m\r\n");
        assert.equal(stderr, "\x1b[33m" + WARNING.trimEnd() + "\x1b[0m\r\n");
    } else if (phase.endsWith("provider")) {
        assert.equal(stdout, "\x1b[32m" + JSON.stringify({ failure: { actual: SELECTED }, message: "public normalized failure" }) + "\x1b[0m\r\n");
        assert.equal(stderr, "\x1b[33m" + WARNING.trimEnd() + "\x1b[0m\r\n");
    } else if (phase.endsWith("withdrawal")) {
        assert.equal(stdout, PUBLIC_BODY + "\n"); assert.equal(stderr, WARNING);
    } else { assert.equal(stdout, OPAQUE + "\n"); assert.equal(stderr, WARNING); }
    row.wireOutputVerified = true;
    // Never serialize private wire buffers or hashes. Receipts expose only the
    // boolean observations above and byte counts, not original output.
    value.stdout.length = 0; value.stderr.length = 0; value.arrival.length = 0;
}

/** Native capture delegates the actual provider, CustomExecution callback,
 * child spawn/IPC and VS Code DAP tracker. No completed job is fabricated. */
export function beforeActivate(context: vscode.ExtensionContext): void {
    assert.equal(installed, false); installed = true; contextOwned = context;
    const profile = process.env.SOTERAI_LITE_F25_OUTPUT_PROFILE; assert.ok(profile && isAbsolute(profile));
    assert.equal(resolve(process.env.USERPROFILE ?? ""), resolve(profile)); assert.equal(vscode.workspace.workspaceFolders?.length, 1);
    assert.match(resolve(folder().uri.fsPath), /^D:\\/i); assert.match(resolve(profile), /^D:\\/i);
    assert.equal(readFileSync(join(folder().uri.fsPath, MARKER), "utf8"), "synthetic-only-v1");
    assert.ok(within(profile, context.globalStorageUri.fsPath)); assert.ok(!within(folder().uri.fsPath, context.globalStorageUri.fsPath));
    const get = context.secrets.get, store = context.secrets.store;
    replace(context.secrets, "get", async (key: string) => { if (key === "soterai.vaultKey") keyGets++; return get.call(context.secrets, key); });
    replace(context.secrets, "store", async (key: string, value: string) => { if (key === "soterai.vaultKey") keyStores++; return store.call(context.secrets, key, value); });
    const open = vscode.workspace.openTextDocument;
    replace(vscode.workspace, "openTextDocument", (...args: unknown[]) => {
        if (isSource(args[0])) sourceDocumentCalls++;
        return Reflect.apply(open as (...args: unknown[]) => unknown, vscode.workspace, args);
    });
    listeners.push(vscode.workspace.onDidOpenTextDocument(document => { if (isSource(document.uri)) sourceDocumentEvents++; }));
    replace(vscode.window, "showOpenDialog", async () => cancelSetup ? undefined : openQueue.shift());
    replace(vscode.window, "showInputBox", async () => argsText);
    replace(vscode.window, "showQuickPick", async (items: readonly { label: string }[] | Thenable<readonly { label: string }[]>, options?: vscode.QuickPickOptions) => {
        const values = await items; if (options?.canPickMany) return values.filter(item => item.label === "DATABASE_URL"); return values[0];
    });
    replace(vscode.window, "showWarningMessage", async (message: string, ...items: unknown[]) => {
        noValues(message); const options = items[0] as vscode.MessageOptions; if (options?.detail) noValues(options.detail);
        const action = items.find(item => ["Migrate securely", "Run selected app", "Allow safe read once"].includes(item as string));
        if (typeof action !== "string") return undefined; assert.equal(options?.modal, true);
        reviews.push({ action, modal: true, detailBytes: Buffer.byteLength(options.detail ?? "", "utf8") }); return action;
    });
    for (const name of ["showInformationMessage", "showErrorMessage"])
        replace(vscode.window, name, async (message: string) => { noValues(message); return undefined; });
    const spawn = childProcess.spawn;
    replace(childProcess, "spawn", (...args: unknown[]) => {
        const executable = args[0], argv = args[1] as string[], options = args[2] as SpawnOptions;
        // Other extension work remains delegated and outside this collector.
        if (!Array.isArray(argv) || argv[3] !== app().fsPath) return Reflect.apply(spawn, childProcess, args);
        const phase = argv[4]; assert.ok(PHASES.includes(phase as Phase)); assert.equal(argv.length, 5);
        noValues(argv); noValues(options.env); assert.equal(executable, process.execPath);
        const allowedEnvironment = ["SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "TZ", "ELECTRON_RUN_AS_NODE"];
        const minimalEnvironment = !!options.env && Object.keys(options.env).every(name => allowedEnvironment.includes(name))
            && options.env.ELECTRON_RUN_AS_NODE === (process.versions.electron ? "1" : undefined);
        const valid = options.shell === false && options.windowsHide === true && options.timeout === undefined
            && options.signal === undefined && options.killSignal === undefined
            && options.env?.DATABASE_URL === undefined && options.env?.API_KEY === undefined
            && options.env?.SOTERAI_LITE_F25_AMBIENT === undefined
            && minimalEnvironment
            && JSON.stringify(options.stdio) === JSON.stringify(["ignore", "pipe", "pipe", "ipc"]);
        const child = Reflect.apply(spawn, childProcess, args) as ChildProcess; capture(child, phase as Phase, valid); return child;
    });
    const register = vscode.tasks.registerTaskProvider;
    replace(vscode.tasks, "registerTaskProvider", (type: string, provider: vscode.TaskProvider) => {
        if (type === TYPE) taskProviderRegistered = true; return register.call(vscode.tasks, type, provider);
    });
    const execute = vscode.tasks.executeTask;
    replace(vscode.tasks, "executeTask", async (task: vscode.Task) => {
        if (task.definition.type !== TYPE) return execute.call(vscode.tasks, task);
        assert.deepEqual(Object.keys(task.definition).sort(), ["descriptorId", "type"]); noValues(task.definition);
        assert.ok(task.execution instanceof vscode.CustomExecution);
        assert.equal((task.execution as unknown as { options?: unknown }).options, undefined);
        const execution = task.execution as vscode.CustomExecution & { readonly callback: (definition: vscode.TaskDefinition) => Thenable<vscode.Pseudoterminal> };
        const original = execution.callback; assert.equal(typeof original, "function");
        const run: TaskRun = { descriptorId: task.definition.descriptorId, publicControl: descriptorPhases.get(task.definition.descriptorId) === "control",
            writes: [], closed: false, taskEnded: false };
        task.execution = new vscode.CustomExecution(async definition => {
            const terminal = await original.call(execution, definition); tasks.push(run);
            listeners.push(terminal.onDidWrite(text => { observe(text, run.publicControl); run.writes.push(text); }));
            if (terminal.onDidClose) listeners.push(terminal.onDidClose(code => { run.closed = true; if (typeof code === "number") run.exitCode = code; }));
            return terminal;
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
    const output = process.env.SOTERAI_LITE_F25_OUTPUT_EVIDENCE, profile = process.env.SOTERAI_LITE_F25_OUTPUT_PROFILE;
    if (!output || !isAbsolute(output)) throw new Error("New absolute F25 owned-output evidence path required.");
    const scopes = [
        "Actual packaged activation registers the native vault task provider and strict machine log protection; setup cancellation creates no app.",
        "Real native migration creates selected-value ciphertext, placeholders and a SecretStorage key without source TextDocuments.",
        "Native descriptor and provider task carry only DATABASE_URL selection, literal public phase arguments and opaque descriptor identity.",
        "Before opaque registration the actual selected-only task preserves identical plain opaque output, establishing the heuristic-negative native control.",
        "A separate current-window source is actually migrated into the encrypted vault as an unselected opaque API_KEY registration.",
        "Actual native task masks raw unselected opaque output while real START injection remains selected-only and child closes naturally with both EOFs.",
        "Actual lifecycle DAP masks raw unselected opaque output and provides no environment evaluation capability.",
        "Actual native task masks an unselected opaque registration reconstructed from separate decoded JSON leaves.",
        "Actual lifecycle DAP masks an unselected opaque registration reconstructed from separate decoded JSON leaves.",
        "Actual native task observes stdout/stderr/stdout Unicode-escape arrival ending in newline and masks both channels.",
        "Actual lifecycle DAP observes stdout/stderr/stdout Unicode-escape arrival ending in newline and masks both channels.",
        "Actual native task preserves useful ANSI-normalized public structured Unicode failure text, Windows stack location and natural nonzero exit23.",
        "Actual lifecycle DAP preserves useful ANSI-normalized public structured Unicode failure text and natural nonzero exit23.",
        "Actual native task admits valid ANSI/CRLF provider JSON before heuristic replacement, masks it and preserves natural nonzero exit31.",
        "Actual lifecycle DAP admits valid ANSI/CRLF provider JSON before heuristic replacement, masks it and preserves natural nonzero exit31.",
        "Machine log withdrawal while a finite task and DAP app run withholds pending candidates and waits for natural owned close plus both EOFs.",
        "While log protection is disabled the next actual task and DAP attempts refuse before child creation without output or selected-only fallback.",
        "Ciphertext, placeholders, saved sensitive restrictions and masked safe reads survive log withdrawal; original source TextDocuments remain unopened.",
        "Every actual owned child has selected-only IPC, minimal spawn environment, exact wire-form evidence, natural completion, both EOFs and zero signals.",
    ];
    const observations: Observation[] = scopes.map((scope, index) => ({ id: "F25-OH" + String(index + 1).padStart(2, "0"), scope, status: "NOT_RUN" }));
    let bundle = "", runtime = "", root = "", driverFailure: string | undefined, config: vscode.WorkspaceConfiguration | undefined;
    let oldRuntimeFlag: boolean | undefined, oldLogFlag: boolean | undefined, controlId = "", rawId = "";
    let withdrawalTask: TaskRun | undefined, withdrawalDebug: DebugRun | undefined;
    let retainedCipher = "", retainedSource = "", retainedRegistry = "", withdrawalJobsBefore = 0;
    const oldAmbient = process.env.SOTERAI_LITE_F25_AMBIENT;
    // Capture once before the first control or protected child. A later child
    // cannot silently adopt a parent mutation by an earlier owned launch.
    const parentSelected = process.env.DATABASE_URL, parentUnselected = process.env.API_KEY;
    let parentEnvironmentUnchanged = true;
    parentEnvironmentCheck = () => {
        if (process.env.DATABASE_URL !== parentSelected || process.env.API_KEY !== parentUnselected) parentEnvironmentUnchanged = false;
        return parentEnvironmentUnchanged;
    };
    const check = async (index: number, action: () => Promise<void>) => {
        const row = observations[index - 1];
        try { await action(); row.status = "PASS"; }
        catch (error) { row.status = "FAIL"; row.diagnostic = (error instanceof Error ? error.name : "UnknownFailure") + " at " + row.id; }
        console.log("LITE_LOG_VAULT_RUNTIME_HOST " + row.id + " " + row.status);
    };
    const nativeTask = async (phase: Phase, expectedCode: number, publicText = false) => {
        const id = await configure(phase), before = process.env.DATABASE_URL, task = await runTask(id, phase.endsWith("public"));
        if (phase === "task-raw") rawId = id;
        await proof(phase);
        await confirmPendingObservation(phase, () => { assert.equal(task.closed, false); assert.equal(task.writes.length, 0); });
        await finishTask(task); await assertNatural(phase, expectedCode); assert.equal(task.exitCode, expectedCode);
        const text = task.writes.join("").replace(/\r\n/g, "\n");
        assert.equal(text, publicText ? PUBLIC_BODY + "\n" + WARNING : MASK + MASK);
        assert.equal(process.env.DATABASE_URL, before); return task;
    };
    const nativeDebug = async (phase: Phase, expectedCode: number, publicText = false) => {
        const id = await configure(phase), debug = await startDebug(id); await proof(phase);
        await confirmPendingObservation(phase, async () => {
            assert.equal(debug.terminated, false); assert.equal(events(debug, "output").length, 0);
            if (phase === "debug-raw") {
                let rejected = false;
                try { await debug.session.customRequest("evaluate", { expression: "process.env.DATABASE_URL" }); } catch { rejected = true; }
                assert.equal(rejected, true);
            }
        });
        await finishDebug(debug); await assertNatural(phase, expectedCode);
        assert.equal((events(debug, "exited")[0].body as { exitCode?: number }).exitCode, expectedCode);
        assert.equal(debugOutput(debug), publicText ? PUBLIC_BODY + "\n" + WARNING : MASK + MASK);
        return debug;
    };
    try {
        assert.equal(contextOwned, context); assert.equal(context.extensionMode, vscode.ExtensionMode.Development);
        assert.equal(process.env.SOTERAI_LITE_F25_OUTPUT_DRIVER_KIND, "native-bootstrap"); assert.ok(profile && isAbsolute(profile));
        assert.equal(process.platform, "win32"); assert.ok(vscode.workspace.isTrusted); root = folder().uri.fsPath;
        process.env.SOTERAI_LITE_F25_AMBIENT = "TEST_ONLY_F25_AMBIENT_EXCLUSION_CONTROL";
        bundle = join(context.extensionUri.fsPath, "dist/extension.js"); runtime = sha(await readFile(bundle));
        assert.equal(runtime, process.env.SOTERAI_LITE_F25_OUTPUT_BUNDLE_SHA256);
        config = vscode.workspace.getConfiguration("soterai"); oldRuntimeFlag = config.inspect<boolean>(RUNTIME_FLAG)?.globalValue;
        oldLogFlag = config.inspect<boolean>(LOG_FLAG)?.globalValue;
        await config.update(RUNTIME_FLAG, true, vscode.ConfigurationTarget.Global); await config.update(LOG_FLAG, true, vscode.ConfigurationTarget.Global);
        await writeFile(source().fsPath, SOURCE, { flag: "wx" });
        await mkdir(join(root, "registration")); await writeFile(registrySource().fsPath, REGISTRY_SOURCE, { flag: "wx" });
        await writeFile(app().fsPath, APP, { flag: "wx" });
        await check(1, async () => {
            const names = await vscode.commands.getCommands(true);
            for (const name of ["configureVaultApp", "runVaultApp", "vaultAppStatus", "migrateSecretsToVault", "logProtectionStatus"]) assert.ok(names.includes("soterai." + name));
            assert.equal(taskProviderRegistered, true); assert.equal((await status()).descriptors.length, 0);
            const manifest = JSON.parse(await readFile(join(context.extensionUri.fsPath, "package.json"), "utf8"));
            const sections = Array.isArray(manifest.contributes.configuration) ? manifest.contributes.configuration : [manifest.contributes.configuration];
            const property = sections.map((section: { properties?: Record<string, unknown> }) => section.properties?.["soterai." + LOG_FLAG]).find(Boolean) as Record<string, unknown>;
            assert.ok(property); assert.equal(property.type, "boolean"); assert.equal(property.default, true); assert.equal(property.scope, "machine");
            assert.ok(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai." + LOG_FLAG));
            cancelSetup = true; const value = await vscode.commands.executeCommand("soterai.configureVaultApp"); cancelSetup = false;
            assert.equal(value, undefined); assert.equal((await status()).descriptors.length, 0); assert.equal(children.length, 0);
        });
        await check(2, async () => {
            await vscode.commands.executeCommand("soterai.migrateSecretsToVault", source());
            const text = await readFile(source().fsPath, "utf8"); noValues(text);
            assert.equal((text.match(/\[SOTERAI_PROTECTED_[A-F0-9]{32}_[0-9]+\]/g) ?? []).length, 1);
            noValues((await readFile(join(context.globalStorageUri.fsPath, "soterai-vault.enc"))).toString("utf8"));
            assert.ok(keyGets > 0 && keyStores > 0); assert.equal(sourceDocumentCalls, 0); assert.equal(sourceDocumentEvents, 0);
        });
        await check(3, async () => {
            controlId = await configure("control"); const descriptor = (await status()).descriptors.find(item => item.id === controlId); assert.ok(descriptor);
            assert.deepEqual(descriptor.selections.map(item => item.name), ["DATABASE_URL"]);
            const task = (await vscode.tasks.fetchTasks({ type: TYPE })).find(item => item.definition.descriptorId === controlId); assert.ok(task);
            assert.deepEqual(Object.keys(task.definition).sort(), ["descriptorId", "type"]); assert.ok(task.execution instanceof vscode.CustomExecution); noValues(task.definition);
        });
        await check(4, async () => {
            const task = await runTask(controlId); await proof("control");
            await confirmPendingObservation("control", () => { assert.equal(task.writes.length, 0); });
            await finishTask(task); await assertNatural("control", 0); assert.equal(task.exitCode, 0);
            assert.equal(task.writes.join("").replace(/\r\n/g, "\n"), OPAQUE + "\n" + WARNING);
            assert.equal(task.writes.join("").includes(MASK), false);
        });
        await check(5, async () => {
            const before = sha(await readFile(join(context.globalStorageUri.fsPath, "soterai-vault.enc")));
            await vscode.commands.executeCommand("soterai.migrateSecretsToVault", registrySource());
            const text = await readFile(registrySource().fsPath, "utf8"); noValues(text);
            assert.equal((text.match(/\[SOTERAI_PROTECTED_[A-F0-9]{32}_[0-9]+\]/g) ?? []).length, 1);
            const cipher = await readFile(join(context.globalStorageUri.fsPath, "soterai-vault.enc")); noValues(cipher.toString("utf8")); assert.notEqual(sha(cipher), before);
            assert.equal(await readFile(join(root, "registration", ".env.example"), "utf8"), "API_KEY=\n");
            assert.equal(sourceDocumentCalls, 0); assert.equal(sourceDocumentEvents, 0);
        });
        await check(6, async () => { await nativeTask("task-raw", 0); });
        await check(7, async () => { await nativeDebug("debug-raw", 0); });
        await check(8, async () => { await nativeTask("task-structured", 0); });
        await check(9, async () => { await nativeDebug("debug-structured", 0); });
        await check(10, async () => { await nativeTask("task-arrival", 29); });
        await check(11, async () => { await nativeDebug("debug-arrival", 29); });
        await check(12, async () => { await nativeTask("task-public", 23, true); });
        await check(13, async () => { await nativeDebug("debug-public", 23, true); });
        await check(14, async () => { await nativeTask("task-provider", 31); });
        await check(15, async () => { await nativeDebug("debug-provider", 31); });
        await check(16, async () => {
            // Configure both before starting either: all soterai configuration
            // changes revoke existing jobs, so setup must not introduce drift.
            const taskId = await configure("task-withdrawal"), debugId = await configure("debug-withdrawal");
            retainedCipher = sha(await readFile(join(context.globalStorageUri.fsPath, "soterai-vault.enc")));
            retainedSource = sha(await readFile(source().fsPath)); retainedRegistry = sha(await readFile(registrySource().fsPath));
            withdrawalJobsBefore = (await status()).jobs.length;
            withdrawalTask = await runTask(taskId); withdrawalDebug = await startDebug(debugId);
            await proof("task-withdrawal"); await proof("debug-withdrawal");
            await until(() => ["task-withdrawal", "debug-withdrawal"].every(phase => {
                const row = childFor(phase as Phase).receipt; return row.stdoutBytes > 0 && row.stderrBytes > 0;
            }), "Both owned withdrawal candidates must have arrived before log authority is withdrawn.");
            childFor("task-withdrawal").receipt.pendingCandidateBytesObserved = true;
            childFor("debug-withdrawal").receipt.pendingCandidateBytesObserved = true;
            assert.equal(withdrawalTask.closed, false); assert.equal(withdrawalDebug.terminated, false);
            assert.equal(withdrawalTask.writes.length, 0); assert.equal(events(withdrawalDebug, "output").length, 0);
            assert.equal(childFor("task-withdrawal").receipt.closed, false); assert.equal(childFor("debug-withdrawal").receipt.closed, false);
            await config!.update(LOG_FLAG, false, vscode.ConfigurationTarget.Global);
            assert.equal(config!.inspect<boolean>(LOG_FLAG)?.globalValue, false);
            await until(() => children.filter(child => child.receipt.phase.endsWith("withdrawal")).every(child => child.receipt.stopMessages >= 1), "Cooperative withdrawal notifications missing.");
            assert.equal(withdrawalTask.closed, false); assert.equal(withdrawalDebug.terminated, false);
            await finishTask(withdrawalTask); await finishDebug(withdrawalDebug);
            await assertNatural("task-withdrawal", 0, true); await assertNatural("debug-withdrawal", 0, true);
            const taskText = withdrawalTask.writes.join("");
            assert.equal(taskText.includes(MASK) || taskText.includes(PUBLIC_BODY) || taskText.includes(WARNING.trim()), false);
            assert.ok(taskText.includes("Managed application output withheld.")); assert.equal(debugOutput(withdrawalDebug), "");
            assert.equal((await status()).jobs.length, withdrawalJobsBefore + 2);
        });
        await check(17, async () => {
            assert.equal(config!.inspect<boolean>(LOG_FLAG)?.globalValue, false); assert.ok(rawId);
            const before = children.length, jobsBefore = (await status()).jobs.length, storesBefore = keyStores;
            const task = await runTask(rawId); await finishTask(task); assert.equal(task.exitCode, 1); assert.equal(task.writes.length, 0);
            const debug = await startDebug(rawId); await finishDebug(debug); assert.equal(events(debug, "process").length, 0); assert.equal(debugOutput(debug), "");
            assert.equal((events(debug, "exited")[0].body as { exitCode?: number }).exitCode, 1);
            assert.equal(children.length, before); assert.equal((await status()).jobs.length, jobsBefore); assert.equal(keyStores, storesBefore);
        });
        await check(18, async () => {
            assert.ok(retainedCipher && retainedSource && retainedRegistry);
            assert.equal(sha(await readFile(join(context.globalStorageUri.fsPath, "soterai-vault.enc"))), retainedCipher);
            assert.equal(sha(await readFile(source().fsPath)), retainedSource); assert.equal(sha(await readFile(registrySource().fsPath)), retainedRegistry);
            const restrictions = JSON.stringify(context.workspaceState.get("soterai.aiForbidden.v1", {})); noValues(restrictions);
            assert.ok(restrictions.includes(".env.runtime") && restrictions.includes("registration/.env.runtime"));
            const read = await vscode.commands.executeCommand<{ text?: string }>("soterai.readProjectFileSafely", source());
            assert.ok(read && typeof read.text === "string" && read.text.includes("DATABASE_URL=[MASKED]")); noValues(read);
            assert.equal(sourceDocumentCalls, 0); assert.equal(sourceDocumentEvents, 0);
            assert.equal(vscode.workspace.textDocuments.some(document => isSource(document.uri)), false); assert.equal(leaked, false);
        });
        await check(19, async () => {
            assert.equal(children.length, PHASES.length);
            for (const value of children) {
                const row = value.receipt;
                assert.ok(row.closed && row.stdoutEOF && row.stderrEOF && row.signal === null && !row.streamError && row.signalsRequested === 0
                    && row.startMessages === 1 && row.injectionValid && row.spawnOptionsValid && row.wireOutputVerified && row.naturalCompletionObserved
                    && row.parentEnvironmentUnchanged);
                if (row.phase.endsWith("arrival")) assert.equal(row.interleavedArrivalObserved, true);
                if (row.phase.endsWith("withdrawal")) { assert.equal(row.cooperativeAbortObserved, true); assert.equal(row.pendingCandidateBytesObserved, true); }
            }
            assert.equal(parentEnvironmentCheck(), true);
            assert.ok((await status()).jobs.every(job => !["READY", "RUNNING", "STOP_REQUESTED", "STOP_UNCONFIRMED"].includes(job.state)));
        });
    } catch (error) { driverFailure = error instanceof Error ? error.name : "UnknownFailure"; }
    finally {
        cancelSetup = false;
        // Finite synthetic apps retain ownership until their own timers finish.
        // No terminal termination, debug stop, process signal or pipe destroy.
        try { await until(() => tasks.every(task => task.closed) && debugs.every(debug => debug.terminated)
            && children.every(child => child.receipt.closed && child.receipt.stdoutEOF && child.receipt.stderrEOF), "Synthetic owned lifecycle cleanup incomplete.", 6000); }
        catch { driverFailure = "OwnedSyntheticLifecycleIncomplete"; }
        if (config) {
            try { await config.update(LOG_FLAG, oldLogFlag, vscode.ConfigurationTarget.Global); await config.update(RUNTIME_FLAG, oldRuntimeFlag, vscode.ConfigurationTarget.Global); }
            catch { driverFailure = "IsolatedFlagRestoreFailure"; }
        }
        for (const listener of listeners.reverse()) listener.dispose();
        for (const restore of restores.reverse()) restore();
        if (oldAmbient === undefined) delete process.env.SOTERAI_LITE_F25_AMBIENT;
        else process.env.SOTERAI_LITE_F25_AMBIENT = oldAmbient;
    }
    if (!parentEnvironmentCheck()) driverFailure = "ParentEnvironmentChanged";
    const current = bundle ? sha(await readFile(bundle)) : ""; if (current !== runtime) driverFailure = "RuntimeIdentityChanged";
    const result = { schemaVersion: 1, observedAt: new Date().toISOString(), phase: "single", syntheticOnly: true,
        workspace: root, declaredProfilePath: resolve(profile ?? ""), hostVersion: vscode.version, extensionMode: "Development",
        extensionBundleSha256: runtime, currentDeveloperBundleSha256: current, hostProbeSha256: sha(await readFile(__filename)), observations,
        passed: observations.filter(item => item.status === "PASS").length, failed: observations.filter(item => item.status === "FAIL").length,
        notRun: observations.filter(item => item.status === "NOT_RUN").length, ...(driverFailure ? { driverFailure } : {}), reviews,
        sourceDocumentCalls, sourceDocumentEvents, secretStorageApi: { keyGets, keyStores }, children: children.map(child => child.receipt),
        parentEnvironmentUnchanged,
        processSignalsRequested: children.reduce((sum, child) => sum + child.receipt.signalsRequested, 0),
        taskRuns: tasks.map(task => ({ descriptorId: task.descriptorId, publicControl: task.publicControl, closed: task.closed, taskEnded: task.taskEnded,
            exitCode: task.exitCode, outputBytes: Buffer.byteLength(task.writes.join(""), "utf8"), safe: !leaked })),
        debugRuns: debugs.map(debug => ({ descriptorId: debug.session.configuration.descriptorId, terminated: debug.terminated,
            outputEvents: events(debug, "output").length, exitedEvents: events(debug, "exited").length, safe: !leaked })),
        independence: "LOW", ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
        identityScope: "Exact packaged runtime in one unique isolated native developer window; no installed-VSIX lifecycle or independent custody claim.",
        finalDeliveryRaceCoverage: "UNIT_ONLY_AFTER_COMPLETE_AND_BETWEEN_CHANNELS_NOT_SCHEDULED_OR_CLAIMED_BY_THIS_NATIVE_FIXTURE",
        limitation: "Owned finite Node app/task/inline lifecycle DAP only. Native differential covers an unselected current-window opaque registration, not arbitrary transformations or unrelated output. Actual send observation proves selected-only IPC for these runs; same-user app memory remains inspectable. Application receipts contain only booleans and exit codes, never values or value hashes. No OS confinement, external adapter, shell, arbitrary test runner or universal masking claim." };
    noValues(result); await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    if (result.failed || result.notRun || driverFailure) throw new Error("F25 owned native fixture failed or incomplete; inspect safe observations.");
}
