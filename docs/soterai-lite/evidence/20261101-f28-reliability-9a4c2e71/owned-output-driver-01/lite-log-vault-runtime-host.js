"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/owned-output-confirmed-01.host.ts
var owned_output_confirmed_01_host_exports = {};
__export(owned_output_confirmed_01_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(owned_output_confirmed_01_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_node_child_process = __toESM(require("node:child_process"));
var import_node_fs = require("node:fs");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var TYPE = "soterai-vault";
var RUNTIME_FLAG = "lite.vaultRuntime";
var LOG_FLAG = "lite.logProtection";
var MARKER = ".synthetic-lite-f25-owned-output-host";
var SELECTED = "postgresql://native:synthetic-f25-password@f25-owned.invalid/database";
var OPAQUE = "elm river copper meadow lantern";
var SOURCE = "DATABASE_URL='" + SELECTED + "'\n";
var REGISTRY_SOURCE = "API_KEY='" + OPAQUE + "'\n";
var MASK = "[REDACTED_SECRET_OUTPUT]";
var WARNING = "Public F25 owned warning\n";
var PUBLIC_BODY = JSON.stringify({
  message: "Public caf\xE9 \u96EA assertion",
  code: 7,
  extra: ["C:\\public\\test\\build.cjs:12:7", false, null]
});
var ESCAPED = [...OPAQUE].map((char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0")).join("");
var SPLIT_BODY = JSON.stringify({ actual: OPAQUE.slice(0, 13), nested: { expected: OPAQUE.slice(13) } }).replace("elm", "\\u0065lm");
var PHASES = [
  "control",
  "task-raw",
  "debug-raw",
  "task-structured",
  "debug-structured",
  "task-arrival",
  "debug-arrival",
  "task-public",
  "debug-public",
  "task-provider",
  "debug-provider",
  "task-withdrawal",
  "debug-withdrawal"
];
var APP = String.raw`"use strict";
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
var restores = [];
var listeners = [];
var tasks2 = [];
var debugs = [];
var children = [];
var descriptorPhases = /* @__PURE__ */ new Map();
var reviews = [];
var contextOwned;
var installed = false;
var setup = { phase: "initial" };
var cancelSetup = false;
var openQueue = [];
var argsText = "[]";
var taskProviderRegistered = false;
var sourceDocumentCalls = 0;
var sourceDocumentEvents = 0;
var keyGets = 0;
var keyStores = 0;
var leaked = false;
var parentEnvironmentCheck = () => false;
var sha = (value) => (0, import_node_crypto.createHash)("sha256").update(value).digest("hex");
var within = (root, file) => {
  const part = (0, import_node_path.relative)((0, import_node_path.resolve)(root), (0, import_node_path.resolve)(file));
  return part === "" || !part.startsWith("..") && !(0, import_node_path.isAbsolute)(part);
};
var folder = () => {
  const value = vscode.workspace.workspaceFolders?.[0];
  import_strict.default.ok(value);
  return value;
};
var source = () => vscode.Uri.joinPath(folder().uri, ".env.runtime");
var registrySource = () => vscode.Uri.joinPath(folder().uri, "registration", ".env.runtime");
var app = () => vscode.Uri.joinPath(folder().uri, "public-log-runtime.cjs");
var isSource = (value) => value instanceof vscode.Uri && [source(), registrySource()].some((uri) => uri.toString() === value.toString());
function noValues(value, publicControl = false) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  for (const raw of [SELECTED, SOURCE, REGISTRY_SOURCE, ...publicControl ? [] : [OPAQUE, SPLIT_BODY, ESCAPED]])
    import_strict.default.ok(!text.includes(raw), "Native metadata or protected output disclosed synthetic original content.");
}
function observe(value, publicControl = false) {
  try {
    noValues(value, publicControl);
  } catch {
    leaked = true;
  }
}
function setupDiagnostic() {
  return { ...setup };
}
function replace(target, name, value) {
  const own = Object.getOwnPropertyDescriptor(target, name);
  setup = {
    phase: "replace",
    name,
    frozen: Object.isFrozen(target),
    extensible: Object.isExtensible(target),
    own: !!own,
    configurable: own?.configurable,
    writable: own && "writable" in own ? own.writable : void 0
  };
  Object.defineProperty(target, name, { configurable: true, enumerable: own?.enumerable ?? false, writable: true, value });
  restores.push(() => {
    if (own) Object.defineProperty(target, name, own);
    else Reflect.deleteProperty(target, name);
  });
}
async function until(check, label, ms = 1e4) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 20));
  }
  throw new Error(label);
}
async function proof(phase, natural = false) {
  const file = (0, import_node_path.join)(folder().uri.fsPath, ".synthetic-f25-" + phase + (natural ? "-natural" : "-ready") + ".json");
  await until(async () => {
    try {
      await (0, import_promises.readFile)(file);
      return true;
    } catch {
      return false;
    }
  }, "Synthetic readiness or natural completion missing.");
  const value = JSON.parse(await (0, import_promises.readFile)(file, "utf8"));
  noValues(value);
  if (!natural) import_strict.default.deepEqual(value, { selectedExact: true, unselectedAbsent: true, ambientAbsent: true, literalArgs: true });
  return value;
}
async function confirmPendingObservation(phase, check) {
  await check();
  await (0, import_promises.writeFile)((0, import_node_path.join)(folder().uri.fsPath, ".synthetic-f25-" + phase + "-observed.txt"), "observed", { flag: "wx" });
}
async function status() {
  const value = await vscode.commands.executeCommand("soterai.vaultAppStatus");
  import_strict.default.ok(value && Array.isArray(value.descriptors) && Array.isArray(value.jobs));
  noValues(value);
  return value;
}
async function configure(phase) {
  openQueue = [[app()], [source()]];
  argsText = JSON.stringify([phase]);
  const result = await vscode.commands.executeCommand("soterai.configureVaultApp");
  import_strict.default.ok(result?.saved);
  import_strict.default.match(result.id, /^[a-f0-9-]{36}$/);
  noValues(result);
  import_strict.default.equal(openQueue.length, 0);
  const descriptor = (await status()).descriptors.find((item) => item.id === result.id);
  import_strict.default.ok(descriptor);
  import_strict.default.deepEqual(descriptor.args, [phase]);
  import_strict.default.deepEqual(descriptor.selections.map((item) => item.name), ["DATABASE_URL"]);
  descriptorPhases.set(result.id, phase);
  return result.id;
}
async function runTask(id, direct = false) {
  const before = tasks2.length;
  if (direct) {
    const available = await vscode.tasks.fetchTasks({ type: TYPE }), task = available.find((item) => item.definition.descriptorId === id);
    import_strict.default.ok(task);
    await vscode.tasks.executeTask(task);
  } else {
    const value = await vscode.commands.executeCommand("soterai.runVaultApp", id);
    import_strict.default.deepEqual(value, { descriptorId: id, status: "TASK_REQUESTED" });
    noValues(value);
  }
  await until(() => tasks2.length > before, "Native CustomExecution callback missing.");
  return tasks2[before];
}
async function finishTask(run2) {
  await until(() => run2.closed && run2.taskEnded, "Actual native task completion missing.");
  import_strict.default.equal(leaked, false);
  noValues(run2.writes, run2.publicControl);
}
async function startDebug(id) {
  const before = debugs.length, config = { type: TYPE, request: "launch", name: "F25 synthetic lifecycle", descriptorId: id, noDebug: true };
  noValues(config);
  import_strict.default.equal(await vscode.debug.startDebugging(folder(), config), true);
  await until(() => debugs.length > before, "Native DAP tracker missing.");
  return debugs[before];
}
var events = (run2, event) => run2.messages.filter((message) => message.type === "event" && message.event === event);
var debugOutput = (run2) => events(run2, "output").map((message) => message.body?.output ?? "").join("");
async function finishDebug(run2) {
  await until(() => run2.terminated && events(run2, "terminated").length === 1, "Actual DAP termination missing.");
  import_strict.default.equal(leaked, false);
  noValues(run2.messages);
  import_strict.default.equal(events(run2, "exited").length, 1);
}
function childFor(phase) {
  const rows = children.filter((child) => child.receipt.phase === phase);
  import_strict.default.equal(rows.length, 1);
  return rows[0];
}
function capture(child, phase, spawnOptionsValid) {
  const row = {
    phase,
    closed: false,
    code: null,
    signal: null,
    stdoutEOF: false,
    stderrEOF: false,
    streamError: false,
    stdoutBytes: 0,
    stderrBytes: 0,
    signalsRequested: 0,
    startMessages: 0,
    stopMessages: 0,
    injectionValid: true,
    spawnOptionsValid,
    wireOutputVerified: false,
    interleavedArrivalObserved: false,
    naturalCompletionObserved: false,
    cooperativeAbortObserved: false,
    parentEnvironmentUnchanged: false,
    pendingCandidateBytesObserved: false
  };
  const value = { receipt: row, stdout: [], stderr: [], arrival: [] };
  children.push(value);
  const kill = child.kill;
  child.kill = (() => {
    row.signalsRequested++;
    throw Error("Synthetic owned output verification forbids process signals.");
  });
  restores.push(() => {
    child.kill = kill;
  });
  const send = child.send;
  child.send = function(...args) {
    const message = args[0];
    if (message?.type === "START") {
      row.startMessages++;
      if (Object.keys(message).sort().join(",") !== "type,values" || !message.values || Object.keys(message.values).join(",") !== "DATABASE_URL" || message.values.DATABASE_URL !== SELECTED || JSON.stringify(message).includes(OPAQUE)) row.injectionValid = false;
    } else if (message?.type === "STOP" && Object.keys(message).join(",") === "type") row.stopMessages++;
    else row.injectionValid = false;
    return Reflect.apply(send, child, args);
  };
  restores.push(() => {
    child.send = send;
  });
  child.once("error", () => {
    row.streamError = true;
  });
  child.once("close", (code, signal) => {
    row.closed = true;
    row.code = code;
    row.signal = signal;
  });
  for (const channel of ["stdout", "stderr"]) {
    const stream = child[channel];
    import_strict.default.ok(stream);
    stream.on("data", (bytes) => {
      row[channel === "stdout" ? "stdoutBytes" : "stderrBytes"] += bytes.length;
      value[channel].push(Buffer.from(bytes));
      value.arrival.push({ channel, text: bytes.toString("utf8") });
    });
    stream.once("end", () => {
      if (channel === "stdout") row.stdoutEOF = true;
      else row.stderrEOF = true;
    });
    stream.once("error", () => {
      row.streamError = true;
    });
  }
}
async function assertNatural(phase, code, withdrew = false) {
  const value = childFor(phase), row = value.receipt;
  await until(() => row.closed && row.stdoutEOF && row.stderrEOF, "Owned child actual close and both EOFs missing.");
  import_strict.default.equal(row.code, code);
  import_strict.default.equal(row.signal, null);
  import_strict.default.equal(row.streamError, false);
  import_strict.default.equal(row.signalsRequested, 0);
  import_strict.default.equal(row.startMessages, 1);
  import_strict.default.equal(row.injectionValid, true);
  import_strict.default.equal(row.spawnOptionsValid, true);
  row.parentEnvironmentUnchanged = parentEnvironmentCheck();
  import_strict.default.equal(row.parentEnvironmentUnchanged, true, "Every child must preserve the parent variables captured before the first owned launch.");
  const natural = await proof(phase, true);
  import_strict.default.deepEqual(natural, { completed: true, stopInvoked: withdrew, abortObserved: withdrew, exitCode: code });
  import_strict.default.equal(withdrew ? row.stopMessages >= 1 : row.stopMessages === 0, true);
  row.naturalCompletionObserved = true;
  row.cooperativeAbortObserved = natural.abortObserved === true;
  const stdout = Buffer.concat(value.stdout).toString("utf8"), stderr = Buffer.concat(value.stderr).toString("utf8");
  if (phase.endsWith("arrival")) {
    import_strict.default.equal(stdout, ESCAPED.slice(0, 60) + ESCAPED.slice(138) + "\n");
    import_strict.default.equal(stderr, ESCAPED.slice(60, 138));
    import_strict.default.equal(value.arrival.map((part) => part.text).join(""), ESCAPED + "\n");
    const order = value.arrival.map((part) => part.channel).filter((channel, index, channels) => index === 0 || channel !== channels[index - 1]);
    import_strict.default.deepEqual(order, ["stdout", "stderr", "stdout"]);
    row.interleavedArrivalObserved = true;
  } else if (phase.endsWith("structured")) {
    import_strict.default.equal(stdout, SPLIT_BODY + "\n");
    import_strict.default.equal(stdout.includes(OPAQUE), false);
    import_strict.default.equal(stderr, WARNING);
  } else if (phase.endsWith("public")) {
    import_strict.default.equal(stdout, "\x1B[32m" + PUBLIC_BODY + "\x1B[0m\r\n");
    import_strict.default.equal(stderr, "\x1B[33m" + WARNING.trimEnd() + "\x1B[0m\r\n");
  } else if (phase.endsWith("provider")) {
    import_strict.default.equal(stdout, "\x1B[32m" + JSON.stringify({ failure: { actual: SELECTED }, message: "public normalized failure" }) + "\x1B[0m\r\n");
    import_strict.default.equal(stderr, "\x1B[33m" + WARNING.trimEnd() + "\x1B[0m\r\n");
  } else if (phase.endsWith("withdrawal")) {
    import_strict.default.equal(stdout, PUBLIC_BODY + "\n");
    import_strict.default.equal(stderr, WARNING);
  } else {
    import_strict.default.equal(stdout, OPAQUE + "\n");
    import_strict.default.equal(stderr, WARNING);
  }
  row.wireOutputVerified = true;
  value.stdout.length = 0;
  value.stderr.length = 0;
  value.arrival.length = 0;
}
function beforeActivate(context) {
  import_strict.default.equal(installed, false);
  installed = true;
  contextOwned = context;
  const profile = process.env.SOTERAI_LITE_F25_OUTPUT_PROFILE;
  import_strict.default.ok(profile && (0, import_node_path.isAbsolute)(profile));
  import_strict.default.equal((0, import_node_path.resolve)(process.env.USERPROFILE ?? ""), (0, import_node_path.resolve)(profile));
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  import_strict.default.match((0, import_node_path.resolve)(folder().uri.fsPath), /^D:\\/i);
  import_strict.default.match((0, import_node_path.resolve)(profile), /^D:\\/i);
  import_strict.default.equal((0, import_node_fs.readFileSync)((0, import_node_path.join)(folder().uri.fsPath, MARKER), "utf8"), "synthetic-only-v1");
  import_strict.default.ok(within(profile, context.globalStorageUri.fsPath));
  import_strict.default.ok(!within(folder().uri.fsPath, context.globalStorageUri.fsPath));
  const get = context.secrets.get, store = context.secrets.store;
  replace(context.secrets, "get", async (key) => {
    if (key === "soterai.vaultKey") keyGets++;
    return get.call(context.secrets, key);
  });
  replace(context.secrets, "store", async (key, value) => {
    if (key === "soterai.vaultKey") keyStores++;
    return store.call(context.secrets, key, value);
  });
  const open = vscode.workspace.openTextDocument;
  replace(vscode.workspace, "openTextDocument", (...args) => {
    if (isSource(args[0])) sourceDocumentCalls++;
    return Reflect.apply(open, vscode.workspace, args);
  });
  listeners.push(vscode.workspace.onDidOpenTextDocument((document) => {
    if (isSource(document.uri)) sourceDocumentEvents++;
  }));
  replace(vscode.window, "showOpenDialog", async () => cancelSetup ? void 0 : openQueue.shift());
  replace(vscode.window, "showInputBox", async () => argsText);
  replace(vscode.window, "showQuickPick", async (items, options) => {
    const values = await items;
    if (options?.canPickMany) return values.filter((item) => item.label === "DATABASE_URL");
    return values[0];
  });
  replace(vscode.window, "showWarningMessage", async (message, ...items) => {
    noValues(message);
    const options = items[0];
    if (options?.detail) noValues(options.detail);
    const action = items.find((item) => ["Migrate securely", "Run selected app", "Allow safe read once"].includes(item));
    if (typeof action !== "string") return void 0;
    import_strict.default.equal(options?.modal, true);
    reviews.push({ action, modal: true, detailBytes: Buffer.byteLength(options.detail ?? "", "utf8") });
    return action;
  });
  for (const name of ["showInformationMessage", "showErrorMessage"])
    replace(vscode.window, name, async (message) => {
      noValues(message);
      return void 0;
    });
  const spawn = import_node_child_process.default.spawn;
  replace(import_node_child_process.default, "spawn", (...args) => {
    const executable = args[0], argv = args[1], options = args[2];
    if (!Array.isArray(argv) || argv[3] !== app().fsPath) return Reflect.apply(spawn, import_node_child_process.default, args);
    const phase = argv[4];
    import_strict.default.ok(PHASES.includes(phase));
    import_strict.default.equal(argv.length, 5);
    noValues(argv);
    noValues(options.env);
    import_strict.default.equal(executable, process.execPath);
    const allowedEnvironment = ["SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "TZ", "ELECTRON_RUN_AS_NODE"];
    const minimalEnvironment = !!options.env && Object.keys(options.env).every((name) => allowedEnvironment.includes(name)) && options.env.ELECTRON_RUN_AS_NODE === (process.versions.electron ? "1" : void 0);
    const valid = options.shell === false && options.windowsHide === true && options.timeout === void 0 && options.signal === void 0 && options.killSignal === void 0 && options.env?.DATABASE_URL === void 0 && options.env?.API_KEY === void 0 && options.env?.SOTERAI_LITE_F25_AMBIENT === void 0 && minimalEnvironment && JSON.stringify(options.stdio) === JSON.stringify(["ignore", "pipe", "pipe", "ipc"]);
    const child = Reflect.apply(spawn, import_node_child_process.default, args);
    capture(child, phase, valid);
    return child;
  });
  const register = vscode.tasks.registerTaskProvider;
  replace(vscode.tasks, "registerTaskProvider", (type, provider) => {
    if (type === TYPE) taskProviderRegistered = true;
    return register.call(vscode.tasks, type, provider);
  });
  const execute = vscode.tasks.executeTask;
  replace(vscode.tasks, "executeTask", async (task) => {
    if (task.definition.type !== TYPE) return execute.call(vscode.tasks, task);
    import_strict.default.deepEqual(Object.keys(task.definition).sort(), ["descriptorId", "type"]);
    noValues(task.definition);
    import_strict.default.ok(task.execution instanceof vscode.CustomExecution);
    import_strict.default.equal(task.execution.options, void 0);
    const execution = task.execution;
    const original = execution.callback;
    import_strict.default.equal(typeof original, "function");
    const run2 = {
      descriptorId: task.definition.descriptorId,
      publicControl: descriptorPhases.get(task.definition.descriptorId) === "control",
      writes: [],
      closed: false,
      taskEnded: false
    };
    task.execution = new vscode.CustomExecution(async (definition) => {
      const terminal = await original.call(execution, definition);
      tasks2.push(run2);
      listeners.push(terminal.onDidWrite((text) => {
        observe(text, run2.publicControl);
        run2.writes.push(text);
      }));
      if (terminal.onDidClose) listeners.push(terminal.onDidClose((code) => {
        run2.closed = true;
        if (typeof code === "number") run2.exitCode = code;
      }));
      return terminal;
    });
    const result = await execute.call(vscode.tasks, task);
    run2.execution = result;
    return result;
  });
  listeners.push(vscode.tasks.onDidEndTask((event) => {
    const run2 = tasks2.find((item) => item.execution === event.execution);
    if (run2) run2.taskEnded = true;
  }));
  listeners.push(vscode.debug.registerDebugAdapterTrackerFactory(TYPE, { createDebugAdapterTracker(session) {
    const run2 = { session, messages: [], terminated: false };
    debugs.push(run2);
    observe(session.configuration);
    return { onDidSendMessage(message) {
      observe(message);
      run2.messages.push(message);
    }, onWillReceiveMessage(message) {
      observe(message);
    } };
  } }));
  listeners.push(vscode.debug.onDidTerminateDebugSession((session) => {
    const run2 = debugs.find((item) => item.session.id === session.id);
    if (run2) run2.terminated = true;
  }));
}
async function run(context) {
  const output = process.env.SOTERAI_LITE_F25_OUTPUT_EVIDENCE, profile = process.env.SOTERAI_LITE_F25_OUTPUT_PROFILE;
  if (!output || !(0, import_node_path.isAbsolute)(output)) throw new Error("New absolute F25 owned-output evidence path required.");
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
    "Every actual owned child has selected-only IPC, minimal spawn environment, exact wire-form evidence, natural completion, both EOFs and zero signals."
  ];
  const observations = scopes.map((scope, index) => ({ id: "F25-OH" + String(index + 1).padStart(2, "0"), scope, status: "NOT_RUN" }));
  let bundle = "", runtime = "", root = "", driverFailure, config;
  let oldRuntimeFlag, oldLogFlag, controlId = "", rawId = "";
  let withdrawalTask, withdrawalDebug;
  let retainedCipher = "", retainedSource = "", retainedRegistry = "", withdrawalJobsBefore = 0;
  const oldAmbient = process.env.SOTERAI_LITE_F25_AMBIENT;
  const parentSelected = process.env.DATABASE_URL, parentUnselected = process.env.API_KEY;
  let parentEnvironmentUnchanged = true;
  parentEnvironmentCheck = () => {
    if (process.env.DATABASE_URL !== parentSelected || process.env.API_KEY !== parentUnselected) parentEnvironmentUnchanged = false;
    return parentEnvironmentUnchanged;
  };
  const check = async (index, action) => {
    const row = observations[index - 1];
    try {
      await action();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      row.diagnostic = (error instanceof Error ? error.name : "UnknownFailure") + " at " + row.id;
    }
    console.log("LITE_LOG_VAULT_RUNTIME_HOST " + row.id + " " + row.status);
  };
  const nativeTask = async (phase, expectedCode, publicText = false) => {
    const id = await configure(phase), before = process.env.DATABASE_URL, task = await runTask(id, phase.endsWith("public"));
    if (phase === "task-raw") rawId = id;
    await proof(phase);
    await confirmPendingObservation(phase, () => {
      import_strict.default.equal(task.closed, false);
      import_strict.default.equal(task.writes.length, 0);
    });
    await finishTask(task);
    await assertNatural(phase, expectedCode);
    import_strict.default.equal(task.exitCode, expectedCode);
    const text = task.writes.join("").replace(/\r\n/g, "\n");
    import_strict.default.equal(text, publicText ? PUBLIC_BODY + "\n" + WARNING : MASK + MASK);
    import_strict.default.equal(process.env.DATABASE_URL, before);
    return task;
  };
  const nativeDebug = async (phase, expectedCode, publicText = false) => {
    const id = await configure(phase), debug2 = await startDebug(id);
    await proof(phase);
    await confirmPendingObservation(phase, async () => {
      import_strict.default.equal(debug2.terminated, false);
      import_strict.default.equal(events(debug2, "output").length, 0);
      if (phase === "debug-raw") {
        let rejected = false;
        try {
          await debug2.session.customRequest("evaluate", { expression: "process.env.DATABASE_URL" });
        } catch {
          rejected = true;
        }
        import_strict.default.equal(rejected, true);
      }
    });
    await finishDebug(debug2);
    await assertNatural(phase, expectedCode);
    import_strict.default.equal(events(debug2, "exited")[0].body.exitCode, expectedCode);
    import_strict.default.equal(debugOutput(debug2), publicText ? PUBLIC_BODY + "\n" + WARNING : MASK + MASK);
    return debug2;
  };
  try {
    import_strict.default.equal(contextOwned, context);
    import_strict.default.equal(context.extensionMode, vscode.ExtensionMode.Development);
    import_strict.default.equal(process.env.SOTERAI_LITE_F25_OUTPUT_DRIVER_KIND, "native-bootstrap");
    import_strict.default.ok(profile && (0, import_node_path.isAbsolute)(profile));
    import_strict.default.equal(process.platform, "win32");
    import_strict.default.ok(vscode.workspace.isTrusted);
    root = folder().uri.fsPath;
    process.env.SOTERAI_LITE_F25_AMBIENT = "TEST_ONLY_F25_AMBIENT_EXCLUSION_CONTROL";
    bundle = (0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js");
    runtime = sha(await (0, import_promises.readFile)(bundle));
    import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F25_OUTPUT_BUNDLE_SHA256);
    config = vscode.workspace.getConfiguration("soterai");
    oldRuntimeFlag = config.inspect(RUNTIME_FLAG)?.globalValue;
    oldLogFlag = config.inspect(LOG_FLAG)?.globalValue;
    await config.update(RUNTIME_FLAG, true, vscode.ConfigurationTarget.Global);
    await config.update(LOG_FLAG, true, vscode.ConfigurationTarget.Global);
    await (0, import_promises.writeFile)(source().fsPath, SOURCE, { flag: "wx" });
    await (0, import_promises.mkdir)((0, import_node_path.join)(root, "registration"));
    await (0, import_promises.writeFile)(registrySource().fsPath, REGISTRY_SOURCE, { flag: "wx" });
    await (0, import_promises.writeFile)(app().fsPath, APP, { flag: "wx" });
    await check(1, async () => {
      const names = await vscode.commands.getCommands(true);
      for (const name of ["configureVaultApp", "runVaultApp", "vaultAppStatus", "migrateSecretsToVault", "logProtectionStatus"]) import_strict.default.ok(names.includes("soterai." + name));
      import_strict.default.equal(taskProviderRegistered, true);
      import_strict.default.equal((await status()).descriptors.length, 0);
      const manifest = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "package.json"), "utf8"));
      const sections = Array.isArray(manifest.contributes.configuration) ? manifest.contributes.configuration : [manifest.contributes.configuration];
      const property = sections.map((section) => section.properties?.["soterai." + LOG_FLAG]).find(Boolean);
      import_strict.default.ok(property);
      import_strict.default.equal(property.type, "boolean");
      import_strict.default.equal(property.default, true);
      import_strict.default.equal(property.scope, "machine");
      import_strict.default.ok(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai." + LOG_FLAG));
      cancelSetup = true;
      const value = await vscode.commands.executeCommand("soterai.configureVaultApp");
      cancelSetup = false;
      import_strict.default.equal(value, void 0);
      import_strict.default.equal((await status()).descriptors.length, 0);
      import_strict.default.equal(children.length, 0);
    });
    await check(2, async () => {
      await vscode.commands.executeCommand("soterai.migrateSecretsToVault", source());
      const text = await (0, import_promises.readFile)(source().fsPath, "utf8");
      noValues(text);
      import_strict.default.equal((text.match(/\[SOTERAI_PROTECTED_[A-F0-9]{32}_[0-9]+\]/g) ?? []).length, 1);
      noValues((await (0, import_promises.readFile)((0, import_node_path.join)(context.globalStorageUri.fsPath, "soterai-vault.enc"))).toString("utf8"));
      import_strict.default.ok(keyGets > 0 && keyStores > 0);
      import_strict.default.equal(sourceDocumentCalls, 0);
      import_strict.default.equal(sourceDocumentEvents, 0);
    });
    await check(3, async () => {
      controlId = await configure("control");
      const descriptor = (await status()).descriptors.find((item) => item.id === controlId);
      import_strict.default.ok(descriptor);
      import_strict.default.deepEqual(descriptor.selections.map((item) => item.name), ["DATABASE_URL"]);
      const task = (await vscode.tasks.fetchTasks({ type: TYPE })).find((item) => item.definition.descriptorId === controlId);
      import_strict.default.ok(task);
      import_strict.default.deepEqual(Object.keys(task.definition).sort(), ["descriptorId", "type"]);
      import_strict.default.ok(task.execution instanceof vscode.CustomExecution);
      noValues(task.definition);
    });
    await check(4, async () => {
      const task = await runTask(controlId);
      await proof("control");
      await confirmPendingObservation("control", () => {
        import_strict.default.equal(task.writes.length, 0);
      });
      await finishTask(task);
      await assertNatural("control", 0);
      import_strict.default.equal(task.exitCode, 0);
      import_strict.default.equal(task.writes.join("").replace(/\r\n/g, "\n"), OPAQUE + "\n" + WARNING);
      import_strict.default.equal(task.writes.join("").includes(MASK), false);
    });
    await check(5, async () => {
      const before = sha(await (0, import_promises.readFile)((0, import_node_path.join)(context.globalStorageUri.fsPath, "soterai-vault.enc")));
      await vscode.commands.executeCommand("soterai.migrateSecretsToVault", registrySource());
      const text = await (0, import_promises.readFile)(registrySource().fsPath, "utf8");
      noValues(text);
      import_strict.default.equal((text.match(/\[SOTERAI_PROTECTED_[A-F0-9]{32}_[0-9]+\]/g) ?? []).length, 1);
      const cipher = await (0, import_promises.readFile)((0, import_node_path.join)(context.globalStorageUri.fsPath, "soterai-vault.enc"));
      noValues(cipher.toString("utf8"));
      import_strict.default.notEqual(sha(cipher), before);
      import_strict.default.equal(await (0, import_promises.readFile)((0, import_node_path.join)(root, "registration", ".env.example"), "utf8"), "API_KEY=\n");
      import_strict.default.equal(sourceDocumentCalls, 0);
      import_strict.default.equal(sourceDocumentEvents, 0);
    });
    await check(6, async () => {
      await nativeTask("task-raw", 0);
    });
    await check(7, async () => {
      await nativeDebug("debug-raw", 0);
    });
    await check(8, async () => {
      await nativeTask("task-structured", 0);
    });
    await check(9, async () => {
      await nativeDebug("debug-structured", 0);
    });
    await check(10, async () => {
      await nativeTask("task-arrival", 29);
    });
    await check(11, async () => {
      await nativeDebug("debug-arrival", 29);
    });
    await check(12, async () => {
      await nativeTask("task-public", 23, true);
    });
    await check(13, async () => {
      await nativeDebug("debug-public", 23, true);
    });
    await check(14, async () => {
      await nativeTask("task-provider", 31);
    });
    await check(15, async () => {
      await nativeDebug("debug-provider", 31);
    });
    await check(16, async () => {
      const taskId = await configure("task-withdrawal"), debugId = await configure("debug-withdrawal");
      retainedCipher = sha(await (0, import_promises.readFile)((0, import_node_path.join)(context.globalStorageUri.fsPath, "soterai-vault.enc")));
      retainedSource = sha(await (0, import_promises.readFile)(source().fsPath));
      retainedRegistry = sha(await (0, import_promises.readFile)(registrySource().fsPath));
      withdrawalJobsBefore = (await status()).jobs.length;
      withdrawalTask = await runTask(taskId);
      withdrawalDebug = await startDebug(debugId);
      await proof("task-withdrawal");
      await proof("debug-withdrawal");
      await until(() => ["task-withdrawal", "debug-withdrawal"].every((phase) => {
        const row = childFor(phase).receipt;
        return row.stdoutBytes > 0 && row.stderrBytes > 0;
      }), "Both owned withdrawal candidates must have arrived before log authority is withdrawn.");
      childFor("task-withdrawal").receipt.pendingCandidateBytesObserved = true;
      childFor("debug-withdrawal").receipt.pendingCandidateBytesObserved = true;
      import_strict.default.equal(withdrawalTask.closed, false);
      import_strict.default.equal(withdrawalDebug.terminated, false);
      import_strict.default.equal(withdrawalTask.writes.length, 0);
      import_strict.default.equal(events(withdrawalDebug, "output").length, 0);
      import_strict.default.equal(childFor("task-withdrawal").receipt.closed, false);
      import_strict.default.equal(childFor("debug-withdrawal").receipt.closed, false);
      await config.update(LOG_FLAG, false, vscode.ConfigurationTarget.Global);
      import_strict.default.equal(config.inspect(LOG_FLAG)?.globalValue, false);
      await until(() => children.filter((child) => child.receipt.phase.endsWith("withdrawal")).every((child) => child.receipt.stopMessages >= 1), "Cooperative withdrawal notifications missing.");
      import_strict.default.equal(withdrawalTask.closed, false);
      import_strict.default.equal(withdrawalDebug.terminated, false);
      await finishTask(withdrawalTask);
      await finishDebug(withdrawalDebug);
      await assertNatural("task-withdrawal", 0, true);
      await assertNatural("debug-withdrawal", 0, true);
      const taskText = withdrawalTask.writes.join("");
      import_strict.default.equal(taskText.includes(MASK) || taskText.includes(PUBLIC_BODY) || taskText.includes(WARNING.trim()), false);
      import_strict.default.ok(taskText.includes("Managed application output withheld."));
      import_strict.default.equal(debugOutput(withdrawalDebug), "");
      import_strict.default.equal((await status()).jobs.length, withdrawalJobsBefore + 2);
    });
    await check(17, async () => {
      import_strict.default.equal(config.inspect(LOG_FLAG)?.globalValue, false);
      import_strict.default.ok(rawId);
      const before = children.length, jobsBefore = (await status()).jobs.length, storesBefore = keyStores;
      const task = await runTask(rawId);
      await finishTask(task);
      import_strict.default.equal(task.exitCode, 1);
      import_strict.default.equal(task.writes.length, 0);
      const debug2 = await startDebug(rawId);
      await finishDebug(debug2);
      import_strict.default.equal(events(debug2, "process").length, 0);
      import_strict.default.equal(debugOutput(debug2), "");
      import_strict.default.equal(events(debug2, "exited")[0].body.exitCode, 1);
      import_strict.default.equal(children.length, before);
      import_strict.default.equal((await status()).jobs.length, jobsBefore);
      import_strict.default.equal(keyStores, storesBefore);
    });
    await check(18, async () => {
      import_strict.default.ok(retainedCipher && retainedSource && retainedRegistry);
      import_strict.default.equal(sha(await (0, import_promises.readFile)((0, import_node_path.join)(context.globalStorageUri.fsPath, "soterai-vault.enc"))), retainedCipher);
      import_strict.default.equal(sha(await (0, import_promises.readFile)(source().fsPath)), retainedSource);
      import_strict.default.equal(sha(await (0, import_promises.readFile)(registrySource().fsPath)), retainedRegistry);
      const restrictions = JSON.stringify(context.workspaceState.get("soterai.aiForbidden.v1", {}));
      noValues(restrictions);
      import_strict.default.ok(restrictions.includes(".env.runtime") && restrictions.includes("registration/.env.runtime"));
      const read = await vscode.commands.executeCommand("soterai.readProjectFileSafely", source());
      import_strict.default.ok(read && typeof read.text === "string" && read.text.includes("DATABASE_URL=[MASKED]"));
      noValues(read);
      import_strict.default.equal(sourceDocumentCalls, 0);
      import_strict.default.equal(sourceDocumentEvents, 0);
      import_strict.default.equal(vscode.workspace.textDocuments.some((document) => isSource(document.uri)), false);
      import_strict.default.equal(leaked, false);
    });
    await check(19, async () => {
      import_strict.default.equal(children.length, PHASES.length);
      for (const value of children) {
        const row = value.receipt;
        import_strict.default.ok(row.closed && row.stdoutEOF && row.stderrEOF && row.signal === null && !row.streamError && row.signalsRequested === 0 && row.startMessages === 1 && row.injectionValid && row.spawnOptionsValid && row.wireOutputVerified && row.naturalCompletionObserved && row.parentEnvironmentUnchanged);
        if (row.phase.endsWith("arrival")) import_strict.default.equal(row.interleavedArrivalObserved, true);
        if (row.phase.endsWith("withdrawal")) {
          import_strict.default.equal(row.cooperativeAbortObserved, true);
          import_strict.default.equal(row.pendingCandidateBytesObserved, true);
        }
      }
      import_strict.default.equal(parentEnvironmentCheck(), true);
      import_strict.default.ok((await status()).jobs.every((job) => !["READY", "RUNNING", "STOP_REQUESTED", "STOP_UNCONFIRMED"].includes(job.state)));
    });
  } catch (error) {
    driverFailure = error instanceof Error ? error.name : "UnknownFailure";
  } finally {
    cancelSetup = false;
    try {
      await until(() => tasks2.every((task) => task.closed) && debugs.every((debug2) => debug2.terminated) && children.every((child) => child.receipt.closed && child.receipt.stdoutEOF && child.receipt.stderrEOF), "Synthetic owned lifecycle cleanup incomplete.", 6e3);
    } catch {
      driverFailure = "OwnedSyntheticLifecycleIncomplete";
    }
    if (config) {
      try {
        await config.update(LOG_FLAG, oldLogFlag, vscode.ConfigurationTarget.Global);
        await config.update(RUNTIME_FLAG, oldRuntimeFlag, vscode.ConfigurationTarget.Global);
      } catch {
        driverFailure = "IsolatedFlagRestoreFailure";
      }
    }
    for (const listener of listeners.reverse()) listener.dispose();
    for (const restore of restores.reverse()) restore();
    if (oldAmbient === void 0) delete process.env.SOTERAI_LITE_F25_AMBIENT;
    else process.env.SOTERAI_LITE_F25_AMBIENT = oldAmbient;
  }
  if (!parentEnvironmentCheck()) driverFailure = "ParentEnvironmentChanged";
  const current = bundle ? sha(await (0, import_promises.readFile)(bundle)) : "";
  if (current !== runtime) driverFailure = "RuntimeIdentityChanged";
  const result = {
    schemaVersion: 1,
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    phase: "single",
    syntheticOnly: true,
    workspace: root,
    declaredProfilePath: (0, import_node_path.resolve)(profile ?? ""),
    hostVersion: vscode.version,
    extensionMode: "Development",
    extensionBundleSha256: runtime,
    currentDeveloperBundleSha256: current,
    hostProbeSha256: sha(await (0, import_promises.readFile)(__filename)),
    observations,
    passed: observations.filter((item) => item.status === "PASS").length,
    failed: observations.filter((item) => item.status === "FAIL").length,
    notRun: observations.filter((item) => item.status === "NOT_RUN").length,
    ...driverFailure ? { driverFailure } : {},
    reviews,
    sourceDocumentCalls,
    sourceDocumentEvents,
    secretStorageApi: { keyGets, keyStores },
    children: children.map((child) => child.receipt),
    parentEnvironmentUnchanged,
    processSignalsRequested: children.reduce((sum, child) => sum + child.receipt.signalsRequested, 0),
    taskRuns: tasks2.map((task) => ({
      descriptorId: task.descriptorId,
      publicControl: task.publicControl,
      closed: task.closed,
      taskEnded: task.taskEnded,
      exitCode: task.exitCode,
      outputBytes: Buffer.byteLength(task.writes.join(""), "utf8"),
      safe: !leaked
    })),
    debugRuns: debugs.map((debug2) => ({
      descriptorId: debug2.session.configuration.descriptorId,
      terminated: debug2.terminated,
      outputEvents: events(debug2, "output").length,
      exitedEvents: events(debug2, "exited").length,
      safe: !leaked
    })),
    independence: "LOW",
    ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
    identityScope: "Exact packaged runtime in one unique isolated native developer window; no installed-VSIX lifecycle or independent custody claim.",
    finalDeliveryRaceCoverage: "UNIT_ONLY_AFTER_COMPLETE_AND_BETWEEN_CHANNELS_NOT_SCHEDULED_OR_CLAIMED_BY_THIS_NATIVE_FIXTURE",
    limitation: "Owned finite Node app/task/inline lifecycle DAP only. Native differential covers an unselected current-window opaque registration, not arbitrary transformations or unrelated output. Actual send observation proves selected-only IPC for these runs; same-user app memory remains inspectable. Application receipts contain only booleans and exit codes, never values or value hashes. No OS confinement, external adapter, shell, arbitrary test runner or universal masking claim."
  };
  noValues(result);
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || result.notRun || driverFailure) throw new Error("F25 owned native fixture failed or incomplete; inspect safe observations.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
