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

// packages/vscode-extension/src/__tests__/host/liteCmd.host.ts
var liteCmd_host_exports = {};
__export(liteCmd_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(liteCmd_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_node_fs = require("node:fs");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var PROFILE_ID = "soterai.cmd.checked";
var PROFILE_NAME = "SoterAI cmd (checked commands)";
var OWNERSHIP = "soterai.lite.cmd.ownership.v1";
var PROFILE_RECEIPT = "soterai.lite.cmd.profile.v1";
var RAW = "postgresql://native:synthetic-f12-password-Q8@f12-runtime.invalid/synthetic-db";
var OMITTED = "sk-proj-" + "SYNTHETIC_F12_NATIVE_OMITTED_PRIVATE_VALUE".repeat(2);
var SOURCE = `DATABASE_URL='${RAW}'
API_KEY=${OMITTED}
`;
var MASK = "[REDACTED_SECRET_OUTPUT]";
var NOTE = "first public\nsecond public\nthird public\n";
var APP = String.raw`"use strict";
const fs = require("node:fs");
let parsed; try { parsed = new URL(process.env.DATABASE_URL); } catch {}
fs.writeFileSync(".synthetic-f12-app-proof.json", JSON.stringify({
 injected: !!parsed && parsed.protocol === "postgresql:" && parsed.hostname === "f12-runtime.invalid" && parsed.pathname === "/synthetic-db" && parsed.password.length > 12,
 excludedAbsent: process.env.API_KEY === undefined,
 ambientAbsent: process.env.SOTERAI_LITE_F12_AMBIENT === undefined
}), {flag:"wx"});
process.stdout.write(process.env.DATABASE_URL || "missing"); process.stderr.write("public app warning\n");
setTimeout(() => {}, 200);
`;
var sha = (value) => (0, import_node_crypto.createHash)("sha256").update(value).digest("hex");
var folder = () => {
  const value = vscode.workspace.workspaceFolders?.[0];
  import_strict.default.ok(value);
  return value;
};
var source = () => vscode.Uri.joinPath(folder().uri, ".env.f12");
var note = () => vscode.Uri.joinPath(folder().uri, "note.txt");
var app = () => vscode.Uri.joinPath(folder().uri, "public-f12-app.cjs");
var within = (root, file) => {
  const part = (0, import_node_path.relative)((0, import_node_path.resolve)(root), (0, import_node_path.resolve)(file));
  return part === "" || !part.startsWith("..") && !(0, import_node_path.isAbsolute)(part);
};
var noValues = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const raw of [RAW, OMITTED, SOURCE]) import_strict.default.ok(!text.includes(raw), "Synthetic originals must not enter native output metadata.");
};
var restores = [];
var listeners = [];
var terminals = [];
var tasks2 = [];
var contextOwned;
var provider;
var setup = { phase: "initial" };
var installed = false;
var leaked = false;
var sourceDocumentCalls = 0;
var sourceDocumentEvents = 0;
var diffCount = 0;
var safeReviews = 0;
var gitSetup;
var nativeSubchecks = {};
var nativeLocationIdentity;
var approveRead = true;
var approveProfile = true;
var inputAnswer = "";
var openQueue = [];
var holdRead = false;
var releaseRead;
var reviews = [];
function setupDiagnostic() {
  return { ...setup };
}
function replace(target, name, value) {
  const own = Object.getOwnPropertyDescriptor(target, name);
  setup = { phase: "replace", name, own: !!own, frozen: Object.isFrozen(target), configurable: own?.configurable };
  Object.defineProperty(target, name, { configurable: true, enumerable: own?.enumerable ?? false, writable: true, value });
  restores.push(() => {
    if (own) Object.defineProperty(target, name, own);
    else Reflect.deleteProperty(target, name);
  });
}
function observe(value) {
  try {
    noValues(value);
  } catch {
    leaked = true;
  }
}
async function until(check, label, ms = 1e4) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 20));
  }
  throw new Error(label);
}
async function status() {
  const value = await vscode.commands.executeCommand("soterai.checkedCmdStatus");
  import_strict.default.ok(value);
  noValues(value);
  import_strict.default.ok(Array.isArray(value.recovered) && Array.isArray(value.workers));
  return value;
}
function withheld(result) {
  import_strict.default.equal(result.status, "WITHHELD");
  import_strict.default.equal(result.stdout, "");
  import_strict.default.equal(result.stderr, "");
  noValues(result);
}
async function checked(run2, input) {
  const result = await run2.pty.run(input);
  noValues(result);
  import_strict.default.equal(leaked, false);
  return result;
}
async function open() {
  const before = terminals.length, result = await vscode.commands.executeCommand("soterai.openCheckedCmd", folder().uri);
  import_strict.default.deepEqual(result, { status: "OPENED" });
  await until(() => terminals.length > before, "Native checked terminal creation missing.");
  return terminals[before];
}
async function finishTask(task) {
  await until(() => task.closed && task.ended, "Native affected task did not complete.");
  noValues(task.writes);
}
function beforeActivate(context) {
  import_strict.default.equal(installed, false);
  installed = true;
  contextOwned = context;
  const profile = process.env.SOTERAI_LITE_F12_PROFILE;
  import_strict.default.ok(profile && (0, import_node_path.isAbsolute)(profile));
  import_strict.default.equal((0, import_node_path.resolve)(process.env.USERPROFILE ?? ""), (0, import_node_path.resolve)(profile));
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  import_strict.default.match((0, import_node_path.resolve)(folder().uri.fsPath), /^D:\\/i);
  import_strict.default.match((0, import_node_path.resolve)(profile), /^D:\\/i);
  import_strict.default.equal((0, import_node_fs.readFileSync)((0, import_node_path.join)(folder().uri.fsPath, ".synthetic-lite-f12-host"), "utf8"), "synthetic-only-v1");
  import_strict.default.ok(within(profile, context.globalStorageUri.fsPath));
  import_strict.default.ok(!within(folder().uri.fsPath, context.globalStorageUri.fsPath));
  const openDocument = vscode.workspace.openTextDocument;
  replace(vscode.workspace, "openTextDocument", (...args) => {
    if (args[0] instanceof vscode.Uri && [source().toString(), note().toString()].includes(args[0].toString())) sourceDocumentCalls++;
    return Reflect.apply(openDocument, vscode.workspace, args);
  });
  listeners.push(vscode.workspace.onDidOpenTextDocument((document) => {
    if ([source().toString(), note().toString()].includes(document.uri.toString())) sourceDocumentEvents++;
  }));
  replace(vscode.window, "showOpenDialog", async () => openQueue.shift());
  replace(vscode.window, "showInputBox", async (options) => {
    if (options?.title === "Run a checked cmd command") {
      import_strict.default.equal(options.password, true);
      import_strict.default.equal(options.ignoreFocusOut, false);
    }
    return inputAnswer;
  });
  replace(vscode.window, "showQuickPick", async (items, options) => {
    const values = await items;
    return options?.canPickMany ? values.filter((value) => value.label === "DATABASE_URL") : values[0];
  });
  replace(vscode.window, "showWarningMessage", async (message, ...items) => {
    noValues(message);
    const options = items[0];
    if (options?.detail) noValues(options.detail);
    const action = items.find((value) => ["Migrate securely", "Run selected app", "Allow safe read once", "Create safe copy", "Use checked cmd profile", "Restore previous terminal profile"].includes(value));
    if (typeof action !== "string") return void 0;
    import_strict.default.equal(options?.modal, true);
    reviews.push({ action, modal: true, detailBytes: Buffer.byteLength(options.detail ?? "", "utf8") });
    if (action === "Allow safe read once") {
      safeReviews++;
      import_strict.default.match(message, /managed-read-terminal|integration-command/);
      if (holdRead) {
        holdRead = false;
        return new Promise((done) => {
          releaseRead = done;
        });
      }
      return approveRead ? action : void 0;
    }
    if (["Use checked cmd profile", "Restore previous terminal profile"].includes(action) && !approveProfile) return void 0;
    return action;
  });
  for (const name of ["showInformationMessage", "showErrorMessage"]) replace(vscode.window, name, async (message) => {
    noValues(message);
    return void 0;
  });
  const execute = vscode.commands.executeCommand;
  replace(vscode.commands, "executeCommand", (...args) => {
    if (args[0] === "vscode.diff") {
      diffCount++;
      for (const uri of args.slice(1, 3)) import_strict.default.ok(uri instanceof vscode.Uri && uri.scheme.startsWith("soterai-cmd-profile-"));
    }
    return Reflect.apply(execute, vscode.commands, args);
  });
  const register = vscode.window.registerTerminalProfileProvider;
  replace(vscode.window, "registerTerminalProfileProvider", (id, value) => {
    if (id === PROFILE_ID) {
      import_strict.default.equal(provider, void 0);
      provider = value;
    }
    return register.call(vscode.window, id, value);
  });
  const create = vscode.window.createTerminal;
  replace(vscode.window, "createTerminal", (...args) => {
    const options = args[0];
    let run2;
    if (options?.name === PROFILE_NAME) {
      import_strict.default.ok(options.pty && typeof options.pty.run === "function");
      import_strict.default.deepEqual(Object.keys(options).sort(), ["name", "pty"]);
      run2 = { pty: options.pty, writes: [], closed: false };
      terminals.push(run2);
      const captured = run2;
      listeners.push(captured.pty.onDidWrite((text) => {
        observe(text);
        captured.writes.push(text);
      }));
      if (captured.pty.onDidClose) listeners.push(captured.pty.onDidClose(() => {
        captured.closed = true;
      }));
    }
    const terminal = Reflect.apply(create, vscode.window, args);
    if (run2) run2.terminal = terminal;
    return terminal;
  });
  const executeTask = vscode.tasks.executeTask;
  replace(vscode.tasks, "executeTask", async (task) => {
    if (task.definition.type !== "soterai-vault") return executeTask.call(vscode.tasks, task);
    import_strict.default.ok(task.execution instanceof vscode.CustomExecution);
    noValues(task.definition);
    const execution = task.execution;
    const callback = execution.callback;
    import_strict.default.equal(typeof callback, "function");
    const run2 = { writes: [], closed: false, ended: false };
    task.execution = new vscode.CustomExecution(async (definition) => {
      const pty = await callback.call(execution, definition);
      tasks2.push(run2);
      listeners.push(pty.onDidWrite((text) => {
        observe(text);
        run2.writes.push(text);
      }));
      if (pty.onDidClose) listeners.push(pty.onDidClose(() => {
        run2.closed = true;
      }));
      return pty;
    });
    const result = await executeTask.call(vscode.tasks, task);
    run2.execution = result;
    return result;
  });
  listeners.push(vscode.tasks.onDidEndTask((event) => {
    const run2 = tasks2.find((value) => value.execution === event.execution);
    if (run2) run2.ended = true;
  }));
}
async function run(context) {
  const output = process.env.SOTERAI_LITE_F12_EVIDENCE, profile = process.env.SOTERAI_LITE_F12_PROFILE, phase = process.env.SOTERAI_LITE_F12_PHASE;
  if (!output || !(0, import_node_path.isAbsolute)(output) || !["primary", "restart"].includes(phase ?? "")) throw new Error("Absolute new F12 result and explicit phase required.");
  const scopes = phase === "primary" ? [
    "Packaged native activation contributes the checked profile, machine flag and five registered commands.",
    "Native private profile diff cancellation changes no setting or receipt.",
    "Native configure persists reviewed project-only profile, preserving unrelated workspace settings.",
    "The captured actual registered profile callback returns ExtensionTerminalOptions used by a real native terminal.",
    "Actual installed finite cmd returns Windows version, location and public directory names through the native PTY and completed registered output filter.",
    "Unsupported whole input and hidden native command arguments are refused without raw echo or caller command execution.",
    "Ordinary file consent denial withholds; fresh native one-time approval returns only the ordinary safe text.",
    "Actual vault migration plus checked file/env routes expose variable names and masks without original TextDocuments.",
    "Actual cmd worker output containing both synthetic registered values is masked before native terminal publication.",
    "Approved literal find and reviewed exclusive copy use the actual safe reader and public results.",
    "Pending native safe-read approval revoked by Ctrl+C remains withheld after the scripted owner eventually approves.",
    "Cancellation of actual finite cmd wait retains live ownership until natural completion and withholds output.",
    "Machine withdrawal during actual finite cmd wait withholds, blocks admission and preserves ciphertext and source.",
    "Actual affected F09 native CustomExecution task still injects only selected fake value and masks completed output.",
    "Native profile restore removes its receipt, preserves unrelated settings and leaves managed safe reads/no-original-doc behavior intact.",
    "Git/interpreters/expansions are unsupported whole input and never admit an unchecked worker."
  ] : [
    "Restart in the same isolated profile reports prior durable rows UNVERIFIED with no currently owned workers.",
    "Restart retains ciphertext/source bytes and completed profile restoration without original source documents.",
    "A deliberate fresh native terminal command owns a new worker id, distinct from recovered rows, and completes actual cmd."
  ];
  const observations = scopes.map((scope, index) => ({ id: "F12-H" + String(index + (phase === "restart" ? 17 : 1)).padStart(2, "0"), scope, status: "NOT_RUN" }));
  let bundle = "", runtime = "", driverFailure, activeTerminal, nativeTerminalsAfterClose;
  const config = vscode.workspace.getConfiguration("soterai"), terminalConfig = vscode.workspace.getConfiguration("terminal.integrated", folder().uri);
  const originalFlag = config.inspect("lite.cmdTerminal")?.globalValue;
  const originalPowerShellFlag = config.inspect("lite.ps51Terminal")?.globalValue;
  const check = async (index, action) => {
    const row = observations[index - 1];
    try {
      await action();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      row.diagnostic = (error instanceof Error ? error.name : "UnknownFailure") + " at " + row.id;
      if (nativeSubchecks[row.id]) row.subcheck = nativeSubchecks[row.id];
    }
    console.log("LITE_CMD_HOST " + row.id + " " + row.status);
  };
  try {
    import_strict.default.equal(contextOwned, context);
    import_strict.default.equal(context.extensionMode, vscode.ExtensionMode.Development);
    await config.update("lite.ps51Terminal", false, vscode.ConfigurationTarget.Global);
    import_strict.default.equal(process.env.SOTERAI_LITE_F12_DRIVER_KIND, "native-bootstrap");
    import_strict.default.ok(profile && (0, import_node_path.isAbsolute)(profile));
    import_strict.default.ok(vscode.workspace.isTrusted);
    bundle = (0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js");
    runtime = sha(await (0, import_promises.readFile)(bundle));
    import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F12_BUNDLE_SHA256);
    const ciphertext = (0, import_node_path.join)(context.globalStorageUri.fsPath, "soterai-vault.enc"), restartBinding = (0, import_node_path.join)(folder().uri.fsPath, ".synthetic-f12-restart-binding.json");
    if (phase === "restart") {
      await check(1, async () => {
        const current2 = await status();
        import_strict.default.equal(current2.available, true);
        import_strict.default.ok(current2.recovered.length > 0);
        import_strict.default.ok(current2.recovered.every((row) => row.state === "UNVERIFIED"));
        import_strict.default.deepEqual(current2.workers, []);
        import_strict.default.equal(current2.terminals, 0);
        noValues(context.globalState.get(OWNERSHIP));
      });
      await check(2, async () => {
        const binding = JSON.parse(await (0, import_promises.readFile)(restartBinding, "utf8"));
        import_strict.default.equal(sha(await (0, import_promises.readFile)(ciphertext)), binding.ciphertextSha256);
        import_strict.default.equal(sha(await (0, import_promises.readFile)(source().fsPath)), binding.placeholderFileSha256);
        import_strict.default.equal(terminalConfig.inspect("defaultProfile.windows")?.workspaceValue, binding.originalProfile ?? void 0);
        import_strict.default.equal(context.workspaceState.get(PROFILE_RECEIPT), void 0);
        import_strict.default.equal(sourceDocumentCalls, 0);
        import_strict.default.equal(sourceDocumentEvents, 0);
      });
      await check(3, async () => {
        const recovered = (await status()).recovered.map((row) => row.id);
        activeTerminal = await open();
        const result2 = await checked(activeTerminal, "ver");
        import_strict.default.equal(result2.status, "COMPLETE");
        import_strict.default.match(result2.stdout.trim(), /Windows.*Version/);
        const current2 = await status();
        import_strict.default.equal(current2.workers.length, 1);
        import_strict.default.ok(!recovered.includes(current2.workers[0].id));
        import_strict.default.equal(current2.workers[0].state, "EXITED");
        import_strict.default.equal(current2.terminals, terminals.length);
      });
    } else {
      await config.update("lite.cmdTerminal", true, vscode.ConfigurationTarget.Global);
      const prior = terminalConfig.inspect("defaultProfile.windows")?.workspaceValue;
      import_strict.default.equal(prior, void 0, "Fresh isolated project must have no preexisting profile override.");
      await vscode.workspace.getConfiguration("files", folder().uri).update("trimTrailingWhitespace", true, vscode.ConfigurationTarget.Workspace);
      await (0, import_promises.writeFile)(source().fsPath, SOURCE, { flag: "wx" });
      await (0, import_promises.writeFile)(note().fsPath, NOTE, { flag: "wx" });
      await (0, import_promises.writeFile)(app().fsPath, APP, { flag: "wx" });
      await check(1, async () => {
        const names = await vscode.commands.getCommands(true);
        for (const id of ["configureCheckedCmd", "openCheckedCmd", "runCheckedCmd", "restoreCheckedCmd", "checkedCmdStatus"]) import_strict.default.ok(names.includes("soterai." + id));
        import_strict.default.ok(provider);
        const packageJson = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "package.json"), "utf8"));
        import_strict.default.ok(packageJson.contributes.terminal.profiles.some((item) => item.id === PROFILE_ID));
        import_strict.default.equal(packageJson.contributes.configuration.properties["soterai.lite.cmdTerminal"].scope, "machine");
        import_strict.default.equal((await status()).available, true);
      });
      await check(2, async () => {
        approveProfile = false;
        const before = diffCount;
        const result2 = await vscode.commands.executeCommand("soterai.configureCheckedCmd", folder().uri);
        approveProfile = true;
        import_strict.default.deepEqual(result2, { status: "CANCELLED" });
        import_strict.default.equal(diffCount, before + 1);
        import_strict.default.equal(terminalConfig.inspect("defaultProfile.windows")?.workspaceValue, prior);
        import_strict.default.equal(context.workspaceState.get(PROFILE_RECEIPT), void 0);
      });
      await check(3, async () => {
        const result2 = await vscode.commands.executeCommand("soterai.configureCheckedCmd", folder().uri);
        import_strict.default.deepEqual(result2, { status: "SAVED" });
        import_strict.default.equal(terminalConfig.inspect("defaultProfile.windows")?.workspaceValue, PROFILE_NAME);
        const receipt = context.workspaceState.get(PROFILE_RECEIPT);
        import_strict.default.equal(receipt?.phase, "APPLIED");
        import_strict.default.equal(vscode.workspace.getConfiguration("files", folder().uri).inspect("trimTrailingWhitespace")?.workspaceValue, true);
      });
      await check(4, async () => {
        import_strict.default.ok(provider);
        const token = new vscode.CancellationTokenSource();
        try {
          const profileResult = await provider.provideTerminalProfile(token.token);
          import_strict.default.ok(profileResult instanceof vscode.TerminalProfile);
          const options = profileResult.options;
          import_strict.default.ok("pty" in options);
          import_strict.default.equal(options.name, PROFILE_NAME);
          const before = terminals.length;
          const terminal = vscode.window.createTerminal(options);
          terminal.show();
          await until(() => terminals.length > before && terminals[before].writes.some((text) => text.includes("Managed checks")), "Actual provider PTY did not open.");
          activeTerminal = terminals[before];
          import_strict.default.equal((await status()).terminals, terminals.length);
        } finally {
          token.dispose();
        }
      });
      await check(5, async () => {
        import_strict.default.ok(activeTerminal);
        nativeSubchecks["F12-H05"] = "VERSION";
        const version2 = await checked(activeTerminal, "ver");
        import_strict.default.equal(version2.status, "COMPLETE");
        import_strict.default.match(version2.stdout, /Windows.*Version/);
        nativeSubchecks["F12-H05"] = "LOCATION";
        const location = await checked(activeTerminal, "cd");
        import_strict.default.equal(location.status, "COMPLETE");
        const actual = (0, import_node_path.resolve)(location.stdout.trim()), expected = (0, import_node_path.resolve)(folder().uri.fsPath);
        nativeLocationIdentity = { exact: actual === expected, platformEquivalent: actual.toLowerCase() === expected.toLowerCase() };
        import_strict.default.equal(nativeLocationIdentity.platformEquivalent, true);
        nativeSubchecks["F12-H05"] = "LISTING";
        const listing = await checked(activeTerminal, "dir .");
        import_strict.default.equal(listing.status, "COMPLETE");
        import_strict.default.ok(listing.stdout.split("\n").includes("note.txt"));
        nativeSubchecks["F12-H05"] = "OWNERSHIP";
        const current2 = await status();
        import_strict.default.ok(current2.workers.some((row) => row.state === "EXITED" && row.exitCode === 0));
        const durable = context.globalState.get(OWNERSHIP);
        import_strict.default.ok(durable?.some((row) => row.id === current2.workers.at(-1)?.id));
      });
      await check(6, async () => {
        import_strict.default.ok(activeTerminal);
        const before = (await status()).workers.length;
        withheld(await checked(activeTerminal, "ver&type .env.f12"));
        import_strict.default.equal((await status()).workers.length, before);
        inputAnswer = "ver&type .env.f12";
        const terminalCount = terminals.length;
        const result2 = await vscode.commands.executeCommand("soterai.runCheckedCmd", { command: "Write-Output '" + RAW + "'", env: { API_KEY: RAW } });
        import_strict.default.deepEqual(result2, { status: "RUN_REQUESTED" });
        await until(() => terminals.length > terminalCount && terminals.at(-1).writes.some((text) => /withheld/.test(text)), "Native hidden-input whole refusal missing.");
        import_strict.default.equal((await status()).workers.length, before);
        noValues(terminals.map((item) => item.writes));
      });
      await check(7, async () => {
        import_strict.default.ok(activeTerminal);
        const before = safeReviews;
        approveRead = false;
        withheld(await checked(activeTerminal, "type note.txt"));
        approveRead = true;
        const result2 = await checked(activeTerminal, "type note.txt");
        import_strict.default.equal(result2.status, "COMPLETE");
        import_strict.default.equal(result2.stdout, NOTE);
        import_strict.default.equal(safeReviews, before + 2);
      });
      await check(8, async () => {
        import_strict.default.ok(activeTerminal);
        await vscode.commands.executeCommand("soterai.migrateSecretsToVault", source());
        const text = await (0, import_promises.readFile)(source().fsPath, "utf8");
        noValues(text);
        import_strict.default.equal((text.match(/\[SOTERAI_PROTECTED_[A-F0-9]{32}_[0-9]+\]/g) ?? []).length, 2);
        const result2 = await checked(activeTerminal, "type .env.f12");
        import_strict.default.equal(result2.status, "COMPLETE");
        import_strict.default.ok(result2.stdout.includes("DATABASE_URL=[MASKED]") && result2.stdout.includes("API_KEY=[MASKED]"));
        const names = await checked(activeTerminal, "set");
        import_strict.default.equal(names.status, "COMPLETE");
        import_strict.default.match(names.stdout, /SystemRoot=\[MASKED\]/);
        import_strict.default.ok(!names.stdout.includes("Windows") && !names.stdout.includes("SOTERAI_LITE_F12_AMBIENT"));
        import_strict.default.equal(sourceDocumentCalls, 0);
        import_strict.default.equal(sourceDocumentEvents, 0);
      });
      await check(9, async () => {
        import_strict.default.ok(activeTerminal);
        for (const value of [RAW, OMITTED]) {
          const result2 = await checked(activeTerminal, 'echo "' + value + '"');
          import_strict.default.equal(result2.status, "COMPLETE");
          import_strict.default.equal(result2.stdout, MASK);
        }
      });
      await check(10, async () => {
        import_strict.default.ok(activeTerminal);
        const found = await checked(activeTerminal, 'find "second" note.txt');
        import_strict.default.equal(found.status, "COMPLETE");
        import_strict.default.equal(found.stdout, "second public\n");
        const result2 = await checked(activeTerminal, "copy note.txt approved-copy.txt");
        import_strict.default.equal(result2.status, "COMPLETE");
        import_strict.default.equal(result2.stdout, "");
        import_strict.default.equal(await (0, import_promises.readFile)((0, import_node_path.join)(folder().uri.fsPath, "approved-copy.txt"), "utf8"), NOTE);
        withheld(await checked(activeTerminal, "copy note.txt approved-copy.txt"));
      });
      await check(11, async () => {
        import_strict.default.ok(activeTerminal);
        holdRead = true;
        const result2 = activeTerminal.pty.run("type note.txt");
        await until(() => !!releaseRead, "Native safe-read approval did not become pending.");
        activeTerminal.pty.handleInput("");
        releaseRead("Allow safe read once");
        releaseRead = void 0;
        withheld(await result2);
      });
      await check(12, async () => {
        import_strict.default.ok(activeTerminal);
        const count = (await status()).workers.length, run2 = activeTerminal.pty.run("timeout /t 2 /nobreak");
        await until(async () => (await status()).workers.length > count && (await status()).workers.some((row) => row.state === "RUNNING"), "Actual finite PS worker readiness missing.");
        let done = false;
        void run2.then(() => {
          done = true;
        });
        activeTerminal.pty.handleInput("");
        import_strict.default.equal(done, false);
        import_strict.default.ok((await status()).workers.some((row) => ["RUNNING", "CANCEL_PENDING", "STOP_UNCONFIRMED"].includes(row.state)));
        withheld(await run2);
        import_strict.default.ok((await status()).workers.some((row) => row.state === "CANCELLED"));
      });
      await check(13, async () => {
        import_strict.default.ok(activeTerminal);
        const encrypted = sha(await (0, import_promises.readFile)(ciphertext)), original = sha(await (0, import_promises.readFile)(source().fsPath)), count = (await status()).workers.length;
        const run2 = activeTerminal.pty.run("timeout /t 2 /nobreak");
        await until(async () => (await status()).workers.length > count && (await status()).workers.some((row) => row.state === "RUNNING"), "Actual withdrawal worker readiness missing.");
        await config.update("lite.cmdTerminal", false, vscode.ConfigurationTarget.Global);
        withheld(await run2);
        import_strict.default.equal((await status()).available, false);
        import_strict.default.deepEqual(await vscode.commands.executeCommand("soterai.openCheckedCmd", folder().uri), { status: "UNAVAILABLE" });
        import_strict.default.equal(sha(await (0, import_promises.readFile)(ciphertext)), encrypted);
        import_strict.default.equal(sha(await (0, import_promises.readFile)(source().fsPath)), original);
        await config.update("lite.cmdTerminal", true, vscode.ConfigurationTarget.Global);
      });
      await check(14, async () => {
        openQueue = [[app()], [source()]];
        inputAnswer = "[]";
        const configured = await vscode.commands.executeCommand("soterai.configureVaultApp");
        import_strict.default.ok(configured?.saved);
        const before = tasks2.length;
        const result2 = await vscode.commands.executeCommand("soterai.runVaultApp", configured.id);
        import_strict.default.deepEqual(result2, { descriptorId: configured.id, status: "TASK_REQUESTED" });
        await until(() => tasks2.length > before, "Native affected F09 task callback missing.");
        await finishTask(tasks2[before]);
        import_strict.default.ok(tasks2[before].writes.join("").includes(MASK));
        import_strict.default.deepEqual(JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(folder().uri.fsPath, ".synthetic-f12-app-proof.json"), "utf8")), { injected: true, excludedAbsent: true, ambientAbsent: true });
      });
      await check(15, async () => {
        const result2 = await vscode.commands.executeCommand("soterai.restoreCheckedCmd", folder().uri);
        import_strict.default.deepEqual(result2, { status: "SAVED" });
        import_strict.default.equal(terminalConfig.inspect("defaultProfile.windows")?.workspaceValue, prior);
        import_strict.default.equal(context.workspaceState.get(PROFILE_RECEIPT), void 0);
        import_strict.default.equal(vscode.workspace.getConfiguration("files", folder().uri).inspect("trimTrailingWhitespace")?.workspaceValue, true);
        const read = await vscode.commands.executeCommand("soterai.readProjectFileSafely", source());
        import_strict.default.ok(read?.text?.includes("DATABASE_URL=[MASKED]"));
        noValues(read);
        import_strict.default.equal(sourceDocumentCalls, 0);
        import_strict.default.equal(sourceDocumentEvents, 0);
        import_strict.default.equal(leaked, false);
        await (0, import_promises.writeFile)(restartBinding, JSON.stringify({ ciphertextSha256: sha(await (0, import_promises.readFile)(ciphertext)), placeholderFileSha256: sha(await (0, import_promises.readFile)(source().fsPath)), originalProfile: prior ?? null }) + "\n", { flag: "wx" });
      });
      await check(16, async () => {
        import_strict.default.ok(activeTerminal);
        const count = (await status()).workers.length;
        for (const input of ["git status", "cmd /c type .env.f12", "echo %PATH%", "set TOKEN=value", "ver|set"]) withheld(await checked(activeTerminal, input));
        import_strict.default.equal((await status()).workers.length, count);
      });
    }
  } catch (error) {
    driverFailure = error instanceof Error ? error.name : "UnknownFailure";
  } finally {
    if (releaseRead) {
      releaseRead(void 0);
      releaseRead = void 0;
    }
    approveRead = true;
    approveProfile = true;
    try {
      await config.update("lite.cmdTerminal", originalFlag, vscode.ConfigurationTarget.Global);
    } catch {
      driverFailure = "IsolatedFlagRestoreFailure";
    }
    try {
      await config.update("lite.ps51Terminal", originalPowerShellFlag, vscode.ConfigurationTarget.Global);
    } catch {
      driverFailure = "IsolatedOtherShellFlagRestoreFailure";
    }
    for (const terminal of terminals) terminal.pty.close();
    try {
      await until(() => terminals.every((terminal) => terminal.closed) && tasks2.every((task) => task.closed), "Owned finite synthetic cleanup incomplete.", 6e3);
    } catch {
      driverFailure = "OwnedSyntheticLifecycleIncomplete";
    }
    try {
      nativeTerminalsAfterClose = (await status()).terminals;
      import_strict.default.equal(nativeTerminalsAfterClose, 0);
    } catch {
      driverFailure = "OwnedTerminalCountNotCleared";
    }
    for (const listener of listeners.reverse()) listener.dispose();
    for (const restore of restores.reverse()) restore();
  }
  const current = bundle ? sha(await (0, import_promises.readFile)(bundle)) : "";
  if (current !== runtime) driverFailure = "RuntimeIdentityChanged";
  const result = {
    schemaVersion: 1,
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    phase,
    syntheticOnly: true,
    workspace: folder().uri.fsPath,
    declaredProfilePath: (0, import_node_path.resolve)(profile ?? ""),
    hostVersion: vscode.version,
    extensionBundleSha256: runtime,
    currentDeveloperBundleSha256: current,
    hostProbeSha256: sha(await (0, import_promises.readFile)(__filename)),
    observations,
    passed: observations.filter((row) => row.status === "PASS").length,
    failed: observations.filter((row) => row.status === "FAIL").length,
    notRun: observations.filter((row) => row.status === "NOT_RUN").length,
    ...driverFailure ? { driverFailure } : {},
    reviews,
    diffCount,
    safeReviews,
    sourceDocumentCalls,
    sourceDocumentEvents,
    nativeTerminalsAfterClose,
    nativeSubchecks,
    ...nativeLocationIdentity ? { nativeLocationIdentity } : {},
    ...gitSetup ? { gitSetup } : {},
    terminalRuns: terminals.map((terminal) => ({ closed: terminal.closed, outputBytes: Buffer.byteLength(terminal.writes.join(""), "utf8"), safe: !leaked })),
    taskRuns: tasks2.map((task) => ({ closed: task.closed, taskEnded: task.ended, outputBytes: Buffer.byteLength(task.writes.join(""), "utf8"), safe: !leaked })),
    independence: "LOW",
    ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
    identityScope: "Unchanged packaged runtime, captured actual registered profile callback and real native PTY/cmd/task in two isolated native developer windows sharing one new profile.",
    notTested: ["Native profile picker UX", "Human usability/accessibility", "Clean installed-VSIX lifecycle", "Unmanaged terminals/native reads/uploads", "External agents", "OS confinement"]
  };
  noValues(result);
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || result.notRun || driverFailure) throw new Error("F12 native fixture failed/incomplete; inspect safe observations.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
