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

// packages/vscode-extension/src/__tests__/host/liteVaultRuntime.host.ts
var liteVaultRuntime_host_exports = {};
__export(liteVaultRuntime_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(liteVaultRuntime_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_node_fs = require("node:fs");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var TYPE = "soterai-vault";
var FLAG = "lite.vaultRuntime";
var MARKER = ".synthetic-lite-f09-host";
var RAW = "postgresql://native:synthetic-native-password-Q8@f09-runtime.invalid/synthetic-db";
var OMITTED = "sk-proj-" + "SYNTHETIC_F09_NATIVE_OMITTED_PRIVATE_VALUE".repeat(2);
var SOURCE = `DATABASE_URL='${RAW}'
API_KEY=${OMITTED}
`;
var MASK = "[REDACTED_SECRET_OUTPUT]";
var APP = String.raw`"use strict";
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
var restores = [];
var listeners = [];
var tasks2 = [];
var debugs = [];
var contextOwned;
var installed = false;
var setup = { phase: "initial" };
var cancelSetup = false;
var approveRun = true;
var openQueue = [];
var argsText = "[]";
var taskProviderRegistered = false;
var sourceDocumentCalls = 0;
var sourceDocumentEvents = 0;
var keyGets = 0;
var keyStores = 0;
var leaked = false;
var reviews = [];
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
var app = () => vscode.Uri.joinPath(folder().uri, "public-runtime.cjs");
var noValues = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const raw of [RAW, OMITTED, SOURCE]) import_strict.default.ok(!text.includes(raw), "Native surface metadata must withhold synthetic original values.");
};
function observe(value) {
  try {
    noValues(value);
  } catch {
    leaked = true;
  }
}
function setupDiagnostic() {
  return { ...setup };
}
function replace(target, name, value) {
  const own = Object.getOwnPropertyDescriptor(target, name);
  setup = { phase: "replace", name, frozen: Object.isFrozen(target), extensible: Object.isExtensible(target), own: !!own, configurable: own?.configurable, writable: own && "writable" in own ? own.writable : void 0 };
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
async function proof(phase) {
  const file = (0, import_node_path.join)(folder().uri.fsPath, ".synthetic-f09-" + phase + ".json");
  await until(async () => {
    try {
      await (0, import_promises.readFile)(file);
      return true;
    } catch {
      return false;
    }
  }, "Synthetic app readiness missing.");
  const value = JSON.parse(await (0, import_promises.readFile)(file, "utf8"));
  import_strict.default.deepEqual(value, { injected: true, excludedVariableAbsent: true, controlAbsent: true, literalArgs: true });
  noValues(value);
}
async function status() {
  const value = await vscode.commands.executeCommand("soterai.vaultAppStatus");
  import_strict.default.ok(value);
  noValues(value);
  import_strict.default.ok(Array.isArray(value.descriptors) && Array.isArray(value.jobs));
  return value;
}
async function configure(phase) {
  openQueue = [[app()], [source()]];
  argsText = JSON.stringify([phase]);
  const result = await vscode.commands.executeCommand("soterai.configureVaultApp");
  import_strict.default.ok(result && result.saved);
  import_strict.default.match(result.id, /^[a-f0-9-]{36}$/);
  noValues(result);
  import_strict.default.equal(openQueue.length, 0);
  return result.id;
}
async function runTask(id, direct = false) {
  const before = tasks2.length;
  if (direct) {
    const candidates = await vscode.tasks.fetchTasks({ type: TYPE }), task = candidates.find((item) => item.definition.descriptorId === id);
    import_strict.default.ok(task);
    await vscode.tasks.executeTask(task);
  } else {
    const result = await vscode.commands.executeCommand("soterai.runVaultApp", id);
    import_strict.default.deepEqual(result, { descriptorId: id, status: "TASK_REQUESTED" });
    noValues(result);
  }
  await until(() => tasks2.length > before, "Native CustomExecution callback was not reached.");
  return tasks2[before];
}
async function finishTask(run2) {
  await until(() => run2.closed && run2.taskEnded, "Actual task completion event missing.");
  import_strict.default.equal(leaked, false);
  noValues(run2.writes);
}
async function startDebug(id) {
  const before = debugs.length, config = { type: TYPE, request: "launch", name: "F09 synthetic lifecycle", descriptorId: id, noDebug: true };
  noValues(config);
  import_strict.default.equal(await vscode.debug.startDebugging(folder(), config), true);
  await until(() => debugs.length > before, "Native debug tracker was not reached.");
  return debugs[before];
}
var debugEvents = (run2, event) => run2.messages.filter((message) => message.type === "event" && message.event === event);
async function finishDebug(run2) {
  await until(() => run2.terminated && debugEvents(run2, "terminated").length === 1, "Actual debug termination missing.");
  import_strict.default.equal(leaked, false);
  noValues(run2.messages);
}
function beforeActivate(context) {
  import_strict.default.equal(installed, false);
  installed = true;
  contextOwned = context;
  const profile = process.env.SOTERAI_LITE_F09_PROFILE;
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
    if (args[0] instanceof vscode.Uri && args[0].toString() === source().toString()) sourceDocumentCalls++;
    return Reflect.apply(open, vscode.workspace, args);
  });
  listeners.push(vscode.workspace.onDidOpenTextDocument((document) => {
    if (document.uri.toString() === source().toString()) sourceDocumentEvents++;
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
    return action === "Run selected app" && !approveRun ? void 0 : action;
  });
  for (const name of ["showInformationMessage", "showErrorMessage"]) replace(vscode.window, name, async (message) => {
    noValues(message);
    return void 0;
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
    const run2 = { descriptorId: task.definition.descriptorId, writes: [], closed: false, taskEnded: false };
    task.execution = new vscode.CustomExecution(async (definition) => {
      const terminal = await original.call(execution, definition);
      tasks2.push(run2);
      listeners.push(terminal.onDidWrite((text) => {
        observe(text);
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
  const output = process.env.SOTERAI_LITE_F09_EVIDENCE, profile = process.env.SOTERAI_LITE_F09_PROFILE;
  if (!output || !(0, import_node_path.isAbsolute)(output)) throw new Error("New absolute F09 evidence path required.");
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
    "Managed safe read and status retain masking and value-free metadata after native task/debug lifecycles; no original source document opens."
  ];
  const observations = scopes.map((scope, index) => ({ id: "F09-H" + String(index + 1).padStart(2, "0"), scope, status: "NOT_RUN" }));
  let runtime = "", bundle = "", root = "", driverFailure, firstId = "", oldFlag, config;
  const check = async (index, action) => {
    const row = observations[index - 1];
    try {
      await action();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      row.diagnostic = (error instanceof Error ? error.name : "UnknownFailure") + " at " + row.id;
    }
    console.log("LITE_VAULT_RUNTIME_HOST " + row.id + " " + row.status);
  };
  try {
    import_strict.default.equal(contextOwned, context);
    import_strict.default.equal(context.extensionMode, vscode.ExtensionMode.Development);
    import_strict.default.equal(process.env.SOTERAI_LITE_F09_DRIVER_KIND, "native-bootstrap");
    import_strict.default.ok(profile && (0, import_node_path.isAbsolute)(profile));
    import_strict.default.ok(vscode.workspace.isTrusted);
    root = folder().uri.fsPath;
    bundle = (0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js");
    runtime = sha(await (0, import_promises.readFile)(bundle));
    import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F09_BUNDLE_SHA256);
    config = vscode.workspace.getConfiguration("soterai");
    oldFlag = config.inspect(FLAG)?.globalValue;
    await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
    await (0, import_promises.writeFile)(source().fsPath, SOURCE, { flag: "wx" });
    await (0, import_promises.writeFile)(app().fsPath, APP, { flag: "wx" });
    await check(1, async () => {
      const names = await vscode.commands.getCommands(true);
      for (const name of ["configureVaultApp", "runVaultApp", "stopVaultApp", "vaultAppStatus", "migrateSecretsToVault"]) import_strict.default.ok(names.includes("soterai." + name));
      import_strict.default.equal(taskProviderRegistered, true);
      import_strict.default.equal((await status()).descriptors.length, 0);
    });
    await check(2, async () => {
      cancelSetup = true;
      const value = await vscode.commands.executeCommand("soterai.configureVaultApp");
      cancelSetup = false;
      import_strict.default.equal(value, void 0);
      import_strict.default.equal((await status()).descriptors.length, 0);
      import_strict.default.equal(tasks2.length, 0);
    });
    await check(3, async () => {
      await vscode.commands.executeCommand("soterai.migrateSecretsToVault", source());
      const text = await (0, import_promises.readFile)(source().fsPath, "utf8");
      noValues(text);
      import_strict.default.equal((text.match(/\[SOTERAI_PROTECTED_[A-F0-9]{32}_[0-9]+\]/g) ?? []).length, 2);
      import_strict.default.ok(keyGets > 0 && keyStores > 0);
      const encrypted = await (0, import_promises.readFile)((0, import_node_path.join)(context.globalStorageUri.fsPath, "soterai-vault.enc"));
      noValues(encrypted.toString("utf8"));
      import_strict.default.equal(sourceDocumentCalls, 0);
      import_strict.default.equal(sourceDocumentEvents, 0);
    });
    await check(4, async () => {
      firstId = await configure("task-ok");
      const current2 = (await status()).descriptors.find((item) => item.id === firstId);
      import_strict.default.ok(current2);
      import_strict.default.deepEqual(current2.args, ["task-ok"]);
      import_strict.default.deepEqual(current2.selections.map((item) => item.name), ["DATABASE_URL"]);
      import_strict.default.ok(current2.selections.every((item) => /^\[SOTERAI_PROTECTED_[A-F0-9]{32}_[0-9]+\]$/.test(item.placeholder)));
    });
    await check(5, async () => {
      const available = await vscode.tasks.fetchTasks({ type: TYPE }), task = available.find((item) => item.definition.descriptorId === firstId);
      import_strict.default.ok(task);
      import_strict.default.ok(task.execution instanceof vscode.CustomExecution);
      import_strict.default.deepEqual(Object.keys(task.definition).sort(), ["descriptorId", "type"]);
      noValues(task.definition);
    });
    await check(6, async () => {
      const before = (await status()).jobs.length;
      approveRun = false;
      const task = await runTask(firstId);
      await finishTask(task);
      approveRun = true;
      import_strict.default.equal((await status()).jobs.length, before);
      import_strict.default.ok(!task.writes.join("").includes(MASK));
    });
    await check(7, async () => {
      const before = process.env.DATABASE_URL, task = await runTask(firstId);
      await proof("task-ok");
      import_strict.default.equal(task.closed, false);
      import_strict.default.equal(task.writes.length, 0);
      await finishTask(task);
      import_strict.default.ok(task.writes.join("").includes(MASK));
      import_strict.default.equal(task.exitCode, 0);
      import_strict.default.ok(process.env.DATABASE_URL === before, "The editor's parent environment must remain unchanged.");
    });
    await check(8, async () => {
      const id = await configure("task-nonzero"), task = await runTask(id, true);
      await proof("task-nonzero");
      await finishTask(task);
      import_strict.default.equal(task.exitCode, 7);
      import_strict.default.ok(task.writes.join("").includes(MASK));
    });
    await check(9, async () => {
      const id = await configure("debug-ok"), debug2 = await startDebug(id);
      await proof("debug-ok");
      let rejected = false;
      try {
        await debug2.session.customRequest("evaluate", { expression: "process.env.DATABASE_URL" });
      } catch {
        rejected = true;
      }
      import_strict.default.equal(rejected, true);
      await finishDebug(debug2);
      const outputText = debugEvents(debug2, "output").map((message) => message.body?.output ?? "").join("");
      import_strict.default.ok(outputText.includes(MASK));
      const initialized = debug2.messages.find((message) => message.type === "response" && message.command === "initialize");
      const capabilities = initialized?.body;
      import_strict.default.equal(capabilities?.supportsConfigurationDoneRequest, true);
      import_strict.default.notEqual(capabilities?.supportsEvaluateForHovers, true);
      import_strict.default.notEqual(capabilities?.supportsReadMemoryRequest, true);
    });
    await check(10, async () => {
      const id = await configure("debug-long"), debug2 = await startDebug(id);
      await proof("debug-long");
      await debug2.session.customRequest("terminate");
      import_strict.default.equal(debugEvents(debug2, "terminated").length, 0);
      import_strict.default.equal(debug2.terminated, false);
      import_strict.default.ok((await status()).jobs.some((job) => ["RUNNING", "STOP_REQUESTED", "STOP_UNCONFIRMED"].includes(job.state)));
      await finishDebug(debug2);
      import_strict.default.equal(debugEvents(debug2, "exited").length, 1);
      import_strict.default.ok(!debugEvents(debug2, "output").some((message) => message.body?.output?.includes(MASK)));
    });
    await check(11, async () => {
      const id = await configure("task-long"), task = await runTask(id);
      await proof("task-long");
      const encrypted = sha(await (0, import_promises.readFile)((0, import_node_path.join)(context.globalStorageUri.fsPath, "soterai-vault.enc"))), original = sha(await (0, import_promises.readFile)(source().fsPath));
      await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
      await finishTask(task);
      import_strict.default.ok(!task.writes.join("").includes(MASK));
      import_strict.default.equal(await vscode.commands.executeCommand("soterai.configureVaultApp"), void 0);
      import_strict.default.equal(sha(await (0, import_promises.readFile)((0, import_node_path.join)(context.globalStorageUri.fsPath, "soterai-vault.enc"))), encrypted);
      import_strict.default.equal(sha(await (0, import_promises.readFile)(source().fsPath)), original);
      import_strict.default.ok(JSON.stringify(context.workspaceState.get("soterai.aiForbidden.v1", {})).includes(".env.runtime"));
    });
    await check(12, async () => {
      const read = await vscode.commands.executeCommand("soterai.readProjectFileSafely", source());
      import_strict.default.ok(read && typeof read.text === "string");
      noValues(read);
      import_strict.default.ok(read.text.includes("DATABASE_URL=[MASKED]"));
      const current2 = await status();
      import_strict.default.ok(current2.jobs.length >= 5);
      import_strict.default.ok(current2.jobs.every((job) => !["RUNNING", "STOP_REQUESTED", "STOP_UNCONFIRMED"].includes(job.state)));
      import_strict.default.equal(sourceDocumentCalls, 0);
      import_strict.default.equal(sourceDocumentEvents, 0);
      import_strict.default.equal(vscode.workspace.textDocuments.some((document) => document.uri.toString() === source().toString()), false);
      import_strict.default.equal(leaked, false);
    });
  } catch (error) {
    driverFailure = error instanceof Error ? error.name : "UnknownFailure";
  } finally {
    approveRun = true;
    cancelSetup = false;
    if (config) try {
      await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global);
    } catch {
      driverFailure = "IsolatedFlagRestoreFailure";
    }
    try {
      await until(() => tasks2.every((task) => task.closed) && debugs.every((debug2) => debug2.terminated), "Synthetic lifecycle cleanup incomplete.", 5e3);
    } catch {
      driverFailure = "OwnedSyntheticLifecycleIncomplete";
    }
    for (const listener of listeners.reverse()) listener.dispose();
    for (const restore of restores.reverse()) restore();
  }
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
    taskRuns: tasks2.map((task) => ({ descriptorId: task.descriptorId, closed: task.closed, taskEnded: task.taskEnded, exitCode: task.exitCode, outputBytes: Buffer.byteLength(task.writes.join(""), "utf8"), safe: !leaked })),
    debugRuns: debugs.map((debug2) => ({ descriptorId: debug2.session.configuration.descriptorId, terminated: debug2.terminated, outputEvents: debugEvents(debug2, "output").length, exitedEvents: debugEvents(debug2, "exited").length, safe: !leaked })),
    independence: "LOW",
    ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
    identityScope: "Unchanged packaged runtime in a unique isolated native developer window; no installed-VSIX lifecycle claim.",
    limitation: "Owned finite Node app/task/inline debug lifecycle only. Application proof receipts contain constant booleans, not values or value hashes. Selected app can inspect/transmit/write its values; no OS confinement, source debugger, external agent, native shell or gateway interception proof."
  };
  noValues(result);
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || result.notRun || driverFailure) throw new Error("F09 native fixture failed or incomplete; inspect safe observations.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
