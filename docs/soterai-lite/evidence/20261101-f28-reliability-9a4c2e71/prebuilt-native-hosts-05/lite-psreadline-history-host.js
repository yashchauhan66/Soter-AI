"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target2, all) => {
  for (var name in all)
    __defProp(target2, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target2) => (target2 = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target2, "default", { value: mod, enumerable: true }) : target2,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/litePSReadLineHistory.proposal06.host.ts
var litePSReadLineHistory_proposal06_host_exports = {};
__export(litePSReadLineHistory_proposal06_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(litePSReadLineHistory_proposal06_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_node_os = require("node:os");
var import_node_fs = __toESM(require("node:fs"));
var import_promises = __toESM(require("node:fs/promises"));
var import_node_path = require("node:path");
var PRIMARY_IDS = ["Exact runtime/commands/default-off machine flag; idle profile/history/key activity absent", "Disabled install ignores caller authority before selection", "Actual native machine setting refuses repository override", "Explicit global opt-in does not initiate profile/key activity", "Native selection cancellation preserves original and key absence", "Modal cancellation uses actual private metadata documents and no raw source document", "Executable original refused before diff/key/mutation", "Outside-owner synthetic profile refused before content access", "Confirmed native owner install preserves inert prefix and installs owned generation", "Actual encrypted backup/key/journal contain no raw public metadata or sibling backup", "Actual emitted script equals the tested template modulo only public generation", "Native status never promotes installed profile to verified coverage", "Flag withdrawal preserves installed stronger bytes and refuses new install", "Explicit reviewed restore works while disabled and preserves exact original", "Profile drift during modal preserves the independent edit without backup", "Foreign profile identity cannot adopt an owned journal", "Corrupt durable receipt withheld without file/key mutation or green status", "Missing own synthetic recovery key withholds restore without replacing it", "Native flag withdrawal while a modal is pending invalidates approval", "Single held native review rejects a second mutation and cancellation is final", "All public results/modal/private documents are value and owner-path free", "Native hardlink and junction selected profile routes are refused", "Exact installed profile prepared for restart; existing synthetic history unchanged"];
var FLAG = "lite.historyHooks.psReadLine";
var JOURNAL = "psreadline-history-state-v1.json";
var KEY = "soterai.configBackupKey";
var PRIVATE = "FAKE_ONLY_F26C_NATIVE_COMMENT_e41a9c72";
var CALLER = "FAKE_ONLY_F26C_NATIVE_CALLER_1f90d2";
var ORIGINAL = Buffer.from("# " + PRIVATE + "\r\n");
var HISTORY = Buffer.from("Write-Output FAKE_ONLY_EXISTING_HISTORY_f26c\n");
var TEMPLATE_HASH = "71a26e94857f99dabbf75219219b295b514627a57c88ad71368d7ff32bbf372a";
var GENERATION = "a1234567-1234-4567-8123-123456789abc";
var nativeRead = import_promises.default.readFile;
var nativeOpen = import_promises.default.open;
var nativeReadSync = import_node_fs.default.readFileSync;
var nativeOpenSync = import_node_fs.default.openSync;
var restores = [];
var listeners = [];
var metadata = [];
var configuration = [];
var profiles = /* @__PURE__ */ new Set();
var root = "";
var home = "";
var target = "";
var alternative = "";
var executable = "";
var outside = "";
var history = "";
var selected = "";
var pick = true;
var approve = true;
var hold = false;
var entered = false;
var finish;
var onModal;
var picks = 0;
var modals = 0;
var keyReads = 0;
var keyStores = 0;
var profileReads = 0;
var historyReads = 0;
var outsideReads = 0;
var originalDocumentCalls = 0;
var originalDocumentEvents = 0;
var stage = "initial";
var sha = (raw) => (0, import_node_crypto.createHash)("sha256").update(raw).digest("hex");
var key = (file) => (0, import_node_path.resolve)(file).toLowerCase();
var within = (base, file) => {
  const part = (0, import_node_path.relative)((0, import_node_path.resolve)(base), (0, import_node_path.resolve)(file));
  return part === "" || !part.startsWith("..") && !(0, import_node_path.isAbsolute)(part);
};
function valueFree(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  for (const secret of [PRIVATE, CALLER]) (0, import_strict.default)(!text.includes(secret), "Private fixture content entered metadata.");
  if (home) (0, import_strict.default)(!text.toLowerCase().includes(home.toLowerCase()), "Owner path entered public metadata.");
}
function patch(object, name, value) {
  const before = Object.getOwnPropertyDescriptor(object, name);
  Object.defineProperty(object, name, { configurable: true, writable: true, value });
  restores.push(() => before ? Object.defineProperty(object, name, before) : Reflect.deleteProperty(object, name));
}
function observeRead(input) {
  if (typeof input !== "string") return;
  const file = key(input);
  if (profiles.has(file)) profileReads++;
  if (file === key(history)) historyReads++;
  if (file === key(outside)) outsideReads++;
}
function sourceDocument(input) {
  const uri = input instanceof vscode.Uri ? input : input?.uri;
  return uri instanceof vscode.Uri && uri.scheme === "file" && (profiles.has(key(uri.fsPath)) || key(uri.fsPath) === key(history));
}
async function until(predicate) {
  const end = Date.now() + 1e4;
  while (!predicate() && Date.now() < end) await new Promise((done) => setTimeout(done, 10));
  (0, import_strict.default)(predicate(), "Expected bounded native review was not reached.");
}
function setupDiagnostic() {
  return { syntheticOnly: true, stage, picks, modals, keyReads, keyStores, profileReads, historyReads, outsideReads, originalDocumentCalls, originalDocumentEvents };
}
async function beforeActivate(context) {
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  home = (0, import_node_os.homedir)();
  for (const file of [root, home, context.globalStorageUri.fsPath]) import_strict.default.match((0, import_node_path.resolve)(file), /^D:\\SoterAI-Lite-test-profiles\\/i);
  import_strict.default.equal(key(home), key(process.env.USERPROFILE));
  (0, import_strict.default)(!within(root, home));
  (0, import_strict.default)(!within(root, context.globalStorageUri.fsPath));
  import_strict.default.equal(process.platform, "win32");
  import_strict.default.equal(vscode.env.remoteName, void 0);
  target = (0, import_node_path.join)(home, "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
  alternative = (0, import_node_path.join)(home, "alternative", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
  executable = (0, import_node_path.join)(home, "executable", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
  outside = (0, import_node_path.join)((0, import_node_path.dirname)(home), "outside-owner", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
  history = (0, import_node_path.join)(home, "AppData", "Roaming", "Microsoft", "Windows", "PowerShell", "PSReadLine", "ConsoleHost_history.txt");
  selected = target;
  for (const file of [target, alternative, executable, outside]) profiles.add(key(file));
  const phase = process.env.SOTERAI_LITE_F17_PHASE;
  (0, import_strict.default)(phase === "primary" || phase === "restart");
  stage = "synthetic-fixture-preparation";
  if (phase === "primary") {
    for (const [file, raw] of [[target, ORIGINAL], [alternative, Buffer.from("# alternate public\n")], [executable, Buffer.from("Write-Output public\n")], [outside, Buffer.from("# outside synthetic retained\n")], [history, HISTORY]]) {
      (0, import_strict.default)(within((0, import_node_path.dirname)(root), file));
      await import_promises.default.mkdir((0, import_node_path.dirname)(file), { recursive: true });
      await import_promises.default.writeFile(file, raw, { flag: "wx" });
    }
  }
  patch(import_promises.default, "readFile", (...args) => {
    observeRead(args[0]);
    return Reflect.apply(nativeRead, import_promises.default, args);
  });
  patch(import_promises.default, "open", (...args) => {
    observeRead(args[0]);
    return Reflect.apply(nativeOpen, import_promises.default, args);
  });
  patch(import_node_fs.default, "readFileSync", (...args) => {
    observeRead(args[0]);
    return Reflect.apply(nativeReadSync, import_node_fs.default, args);
  });
  patch(import_node_fs.default, "openSync", (...args) => {
    observeRead(args[0]);
    return Reflect.apply(nativeOpenSync, import_node_fs.default, args);
  });
  const get = context.secrets.get, store = context.secrets.store;
  patch(context.secrets, "get", async (name) => {
    if (name === KEY) keyReads++;
    return get.call(context.secrets, name);
  });
  patch(context.secrets, "store", async (name, value) => {
    if (name === KEY) keyStores++;
    return store.call(context.secrets, name, value);
  });
  const open = vscode.workspace.openTextDocument;
  patch(vscode.workspace, "openTextDocument", async (...args) => {
    if (sourceDocument(args[0])) originalDocumentCalls++;
    const doc = await Reflect.apply(open, vscode.workspace, args);
    if (doc.uri.scheme.startsWith("soterai-history-review-")) {
      valueFree(doc.getText());
      metadata.push(doc.getText());
    }
    return doc;
  });
  listeners.push(vscode.workspace.onDidOpenTextDocument((doc) => {
    if (sourceDocument(doc.uri)) originalDocumentEvents++;
  }));
  patch(vscode.window, "showSaveDialog", async (options) => {
    picks++;
    (0, import_strict.default)(options.defaultUri && within(home, options.defaultUri.fsPath));
    valueFree(options.title);
    return pick ? vscode.Uri.file(selected) : void 0;
  });
  patch(vscode.window, "showWarningMessage", async (message, options, ...items) => {
    const action = items.find((item) => ["Install history exclusion", "Restore previous profile"].includes(item));
    if (!action) return void 0;
    valueFree([message, options, items]);
    import_strict.default.equal(options.modal, true);
    modals++;
    await onModal?.();
    if (hold) {
      entered = true;
      return new Promise((done) => finish = done);
    }
    return approve ? action : void 0;
  });
  const execute = vscode.commands.executeCommand;
  patch(vscode.commands, "executeCommand", async (name, ...args) => {
    if (name === "vscode.diff") {
      for (const candidate of args.slice(0, 2)) {
        (0, import_strict.default)(candidate instanceof vscode.Uri && candidate.scheme.startsWith("soterai-history-review-"));
        const doc = await vscode.workspace.openTextDocument(candidate);
        valueFree(doc.getText());
        metadata.push(doc.getText());
      }
    }
    return Reflect.apply(execute, vscode.commands, [name, ...args]);
  });
  stage = "ready-before-product-activation";
}
async function run(context) {
  const phase = process.env.SOTERAI_LITE_F17_PHASE, output = process.env.SOTERAI_LITE_F17_EVIDENCE;
  const config = vscode.workspace.getConfiguration("soterai"), oldFlag = config.inspect(FLAG)?.globalValue;
  const runtime = sha(await nativeRead((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js")));
  import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
  const observations = [];
  const check = async (scope, work) => {
    const row = { id: "F26c-" + (phase === "primary" ? "N" : "R") + String(phase === "primary" ? PRIMARY_IDS.indexOf(scope) + 1 : observations.length + 1).padStart(2, "0"), scope, status: "NOT_RUN", errorName: void 0 };
    observations.push(row);
    try {
      await work();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      row.errorName = error instanceof Error ? error.name : "UnknownFailure";
    }
    if (row.id === "F26c-N19" || row.id === "F26c-N20") await recoverySnapshot("after-" + row.id, originalKey);
  };
  const call = async (name, ...args) => {
    const result = await vscode.commands.executeCommand("soterai." + name, ...args);
    valueFree(result);
    return result;
  };
  const flag = async (value) => {
    if (config.inspect(FLAG)?.globalValue === value) return;
    configuration.push({ stage: "write-start", enabled: value, observedAt: (/* @__PURE__ */ new Date()).toISOString() });
    let complete, expired;
    const acknowledgement = new Promise((done) => {
      complete = done;
    });
    const deadline = new Promise((_done, fail) => {
      expired = () => fail(Error("Native configuration acknowledgement unavailable."));
    });
    const listener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("soterai." + FLAG) && config.inspect(FLAG)?.globalValue === value) {
        configuration.push({ stage: "native-event", enabled: value, observedAt: (/* @__PURE__ */ new Date()).toISOString() });
        complete();
      }
    });
    const timer = setTimeout(() => expired(), 1e4);
    try {
      await config.update(FLAG, value, vscode.ConfigurationTarget.Global);
      await Promise.race([acknowledgement, deadline]);
      import_strict.default.equal(config.inspect(FLAG)?.globalValue, value);
    } finally {
      clearTimeout(timer);
      listener.dispose();
    }
  };
  const current = () => nativeRead(target);
  const clean = () => {
    import_strict.default.equal(historyReads, 0);
    import_strict.default.equal(originalDocumentCalls, 0);
    import_strict.default.equal(originalDocumentEvents, 0);
    (0, import_strict.default)(!vscode.workspace.textDocuments.some((doc) => sourceDocument(doc.uri)));
    valueFree(metadata);
    valueFree(ownedReceipt());
  };
  const journalFile = (0, import_node_path.join)(context.globalStorageUri.fsPath, JOURNAL);
  const ownedReceipt = () => {
    try {
      const stat = import_node_fs.default.lstatSync(journalFile);
      (0, import_strict.default)(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 8192);
      return JSON.parse(nativeReadSync(journalFile, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return void 0;
      throw error;
    }
  };
  const nativeState = () => JSON.stringify(ownedReceipt());
  const recoveryDiagnostics = [];
  const recoverySnapshot = async (point, expectedKey) => {
    try {
      const liveKey = await context.secrets.get(KEY), row = ownedReceipt(), profile = await current();
      let backupBytes;
      if (typeof row?.backupHandle === "string" && /^[a-f0-9]{32}$/.test(row.backupHandle)) {
        const stat = await import_promises.default.lstat((0, import_node_path.join)(context.globalStorageUri.fsPath, "config-backups", row.backupHandle + ".enc"));
        if (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 131072) backupBytes = stat.size;
      }
      recoveryDiagnostics.push({
        point,
        ownKeyPresent: typeof liveKey === "string" && liveKey.length > 0,
        ownKeyMatchesSaved: typeof expectedKey === "string" && liveKey === expectedKey,
        receiptPhase: ["PREPARED", "APPLIED", "RESTORING"].includes(row?.phase) ? row.phase : "UNKNOWN",
        profileMatchesBefore: typeof row?.beforeDigest === "string" && sha(profile) === row.beforeDigest,
        profileMatchesAfter: typeof row?.afterDigest === "string" && sha(profile) === row.afterDigest,
        backupBytes,
        observedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch {
      recoveryDiagnostics.push({ point, status: "SNAPSHOT_UNAVAILABLE" });
    }
  };
  const custody = (0, import_node_path.join)((0, import_node_path.dirname)(root), "f26c-history-restart.json");
  let installed, originalKey, driverFailure;
  try {
    if (phase === "primary") {
      await check("Exact runtime/commands/default-off machine flag; idle profile/history/key activity absent", async () => {
        import_strict.default.equal(profileReads, 0);
        import_strict.default.equal(keyReads, 0);
        import_strict.default.equal(keyStores, 0);
        import_strict.default.equal(picks, 0);
        import_strict.default.equal(historyReads, 0);
        const options = config.inspect(FLAG);
        import_strict.default.equal(options?.defaultValue, false);
        import_strict.default.equal(options?.globalValue, void 0);
        const commands2 = await vscode.commands.getCommands(true);
        for (const id of ["installPSReadLineHistoryGuard", "restorePSReadLineHistoryGuard", "psReadLineHistoryGuardStatus"]) (0, import_strict.default)(commands2.includes("soterai." + id));
        clean();
      });
      await check("Disabled install ignores caller authority before selection", async () => {
        const before = picks;
        import_strict.default.equal((await call("installPSReadLineHistoryGuard", { approved: true, path: CALLER, content: CALLER })).status, "UNAVAILABLE");
        import_strict.default.equal(picks, before);
        import_strict.default.equal(keyReads, 0);
        (0, import_strict.default)((await current()).equals(ORIGINAL));
      });
      await check("Actual native machine setting refuses repository override", async () => {
        await import_strict.default.rejects(Promise.resolve(config.update(FLAG, true, vscode.ConfigurationTarget.Workspace)), { name: "CodeExpectedError" });
        import_strict.default.equal(config.inspect(FLAG)?.workspaceValue, void 0);
        import_strict.default.equal(config.inspect(FLAG)?.globalValue, void 0);
      });
      await check("Explicit global opt-in does not initiate profile/key activity", async () => {
        const reads = profileReads;
        await flag(true);
        import_strict.default.equal(profileReads, reads);
        import_strict.default.equal(keyReads, 0);
        import_strict.default.equal(picks, 0);
      });
      await check("Native selection cancellation preserves original and key absence", async () => {
        pick = false;
        try {
          import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "CANCELLED");
        } finally {
          pick = true;
        }
        (0, import_strict.default)((await current()).equals(ORIGINAL));
        import_strict.default.equal(keyReads, 0);
      });
      await check("Modal cancellation uses actual private metadata documents and no raw source document", async () => {
        approve = false;
        try {
          import_strict.default.equal((await call("installPSReadLineHistoryGuard", { approved: true })).status, "CANCELLED");
        } finally {
          approve = true;
        }
        (0, import_strict.default)(metadata.length >= 2);
        (0, import_strict.default)((await current()).equals(ORIGINAL));
        import_strict.default.equal(keyReads, 0);
        clean();
      });
      await check("Executable original refused before diff/key/mutation", async () => {
        selected = executable;
        const before = metadata.length, keys = keyReads;
        try {
          import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE");
        } finally {
          selected = target;
        }
        import_strict.default.equal(metadata.length, before);
        import_strict.default.equal(keyReads, keys);
        import_strict.default.equal((await nativeRead(executable)).toString(), "Write-Output public\n");
      });
      await check("Outside-owner synthetic profile refused before content access", async () => {
        selected = outside;
        const reads = outsideReads;
        try {
          import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE");
        } finally {
          selected = target;
        }
        import_strict.default.equal(outsideReads, reads);
        import_strict.default.equal((await nativeRead(outside)).toString(), "# outside synthetic retained\n");
      });
      await check("Confirmed native owner install preserves inert prefix and installs owned generation", async () => {
        import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "APPLIED");
        installed = await current();
        (0, import_strict.default)(installed.subarray(0, ORIGINAL.length).equals(ORIGINAL));
        (0, import_strict.default)(installed.toString().includes("SoterAI Lite PSReadLine history v1"));
        import_strict.default.equal(ownedReceipt()?.phase, "APPLIED");
      });
      await check("Actual encrypted backup/key/journal contain no raw public metadata or sibling backup", async () => {
        (0, import_strict.default)(installed);
        import_strict.default.equal(keyStores, 1);
        originalKey = await context.secrets.get(KEY);
        (0, import_strict.default)(originalKey);
        const directory = (0, import_node_path.join)(context.globalStorageUri.fsPath, "config-backups"), files = await import_promises.default.readdir(directory);
        import_strict.default.equal(files.length, 1);
        (0, import_strict.default)(!(await nativeRead((0, import_node_path.join)(directory, files[0]))).includes(Buffer.from(PRIVATE)));
        valueFree(ownedReceipt());
        import_strict.default.deepEqual(await import_promises.default.readdir((0, import_node_path.dirname)(target)), ["Microsoft.PowerShell_profile.ps1"]);
        clean();
      });
      await check("Actual emitted script equals the tested template modulo only public generation", async () => {
        (0, import_strict.default)(installed);
        const body = installed.subarray(ORIGINAL.length).toString();
        const normalized = body.replace(/(# SoterAI Lite PSReadLine history v1 )[a-f0-9-]{36}\n/, "$1" + GENERATION + "\n");
        import_strict.default.equal(sha(normalized), TEMPLATE_HASH);
        await import_promises.default.writeFile((0, import_node_path.join)((0, import_node_path.dirname)(root), "native-emitted-history-profile.ps1"), installed, { flag: "wx" });
      });
      await check("Native status never promotes installed profile to verified coverage", async () => {
        const status = await call("psReadLineHistoryGuardStatus", { approved: true, verified: true });
        import_strict.default.equal(status.badge, "Uncovered");
        import_strict.default.equal(status.status, "INSTALLED_CONSOLE_LOAD_UNVERIFIED");
      });
      await check("Flag withdrawal preserves installed stronger bytes and refuses new install", async () => {
        (0, import_strict.default)(installed);
        await flag(false);
        (0, import_strict.default)((await current()).equals(installed));
        const before = picks;
        import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE");
        import_strict.default.equal(picks, before);
      });
      await check("Explicit reviewed restore works while disabled and preserves exact original", async () => {
        import_strict.default.equal((await call("restorePSReadLineHistoryGuard")).status, "RESTORED");
        (0, import_strict.default)((await current()).equals(ORIGINAL));
        import_strict.default.equal(ownedReceipt(), void 0);
      });
      await check("Profile drift during modal preserves the independent edit without backup", async () => {
        await flag(true);
        const stores = keyStores;
        onModal = async () => {
          await import_promises.default.writeFile(target, "# independently changed\n");
        };
        try {
          import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE");
        } finally {
          onModal = void 0;
        }
        import_strict.default.equal((await current()).toString(), "# independently changed\n");
        import_strict.default.equal(keyStores, stores);
        import_strict.default.equal(ownedReceipt(), void 0);
        await import_promises.default.writeFile(target, ORIGINAL);
      });
      await check("Foreign profile identity cannot adopt an owned journal", async () => {
        import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "APPLIED");
        installed = await current();
        selected = alternative;
        const state = nativeState();
        try {
          import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE");
        } finally {
          selected = target;
        }
        import_strict.default.equal(nativeState(), state);
        (0, import_strict.default)((await current()).equals(installed));
        import_strict.default.equal((await nativeRead(alternative)).toString(), "# alternate public\n");
      });
      await check("Corrupt durable receipt withheld without file/key mutation or green status", async () => {
        const row = ownedReceipt(), before = await current(), keys = keyStores;
        await import_promises.default.writeFile(journalFile, JSON.stringify({ ...row, unexpected: true }) + "\n");
        try {
          import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE");
          import_strict.default.equal((await call("psReadLineHistoryGuardStatus")).status, "UNAVAILABLE");
        } finally {
          await import_promises.default.writeFile(journalFile, JSON.stringify(row) + "\n");
        }
        (0, import_strict.default)((await current()).equals(before));
        import_strict.default.equal(keyStores, keys);
      });
      await check("Native flag withdrawal while a modal is pending invalidates approval", async () => {
        import_strict.default.equal((await call("restorePSReadLineHistoryGuard")).status, "RESTORED");
        hold = true;
        entered = false;
        const pending = call("installPSReadLineHistoryGuard");
        await until(() => entered);
        await flag(false);
        finish?.("Install history exclusion");
        import_strict.default.equal((await pending).status, "UNAVAILABLE");
        hold = false;
        (0, import_strict.default)((await current()).equals(ORIGINAL));
      });
      await check("Single held native review rejects a second mutation and cancellation is final", async () => {
        await flag(true);
        hold = true;
        entered = false;
        const pending = call("installPSReadLineHistoryGuard");
        await until(() => entered);
        import_strict.default.equal((await call("restorePSReadLineHistoryGuard")).status, "UNAVAILABLE");
        finish?.(void 0);
        import_strict.default.equal((await pending).status, "CANCELLED");
        hold = false;
        (0, import_strict.default)((await current()).equals(ORIGINAL));
      });
      await check("All public results/modal/private documents are value and owner-path free", async () => {
        valueFree(metadata);
        clean();
      });
      await check("Native hardlink and junction selected profile routes are refused", async () => {
        const source = (0, import_node_path.join)(home, "linked-source.ps1"), hard = (0, import_node_path.join)(home, "hard", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
        await import_promises.default.mkdir((0, import_node_path.dirname)(hard), { recursive: true });
        await import_promises.default.writeFile(source, "# hardlink synthetic retained\n", { flag: "wx" });
        await import_promises.default.link(source, hard);
        profiles.add(key(hard));
        selected = hard;
        try {
          import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE");
        } finally {
          selected = target;
        }
        const alias = (0, import_node_path.join)(home, "junction", "WindowsPowerShell");
        await import_promises.default.mkdir((0, import_node_path.dirname)(alias), { recursive: true });
        await import_promises.default.symlink((0, import_node_path.dirname)(outside), alias, "junction");
        selected = (0, import_node_path.join)(alias, "Microsoft.PowerShell_profile.ps1");
        try {
          import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "UNAVAILABLE");
        } finally {
          selected = target;
        }
        import_strict.default.equal((await nativeRead(source)).toString(), "# hardlink synthetic retained\n");
        import_strict.default.equal((await nativeRead(outside)).toString(), "# outside synthetic retained\n");
      });
      await check("Exact installed profile prepared for restart; existing synthetic history unchanged", async () => {
        import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "APPLIED");
        installed = await current();
        await flag(false);
        clean();
        (0, import_strict.default)((await nativeRead(history)).equals(HISTORY));
        await import_promises.default.writeFile(custody, JSON.stringify({ installedSha256: sha(installed), originalSha256: sha(ORIGINAL), historySha256: sha(HISTORY), receiptSha256: sha(nativeState()) }) + "\n", { flag: "wx" });
      });
      await check("Missing own synthetic recovery key withholds restore without replacing it", async () => {
        const saved = await context.secrets.get(KEY);
        (0, import_strict.default)(saved);
        const before = await current(), stores = keyStores;
        await context.secrets.delete(KEY);
        try {
          import_strict.default.equal((await call("restorePSReadLineHistoryGuard")).status, "INCOMPLETE");
          import_strict.default.equal(await context.secrets.get(KEY), void 0);
          import_strict.default.equal(keyStores, stores);
          (0, import_strict.default)((await current()).equals(before));
        } finally {
          await context.secrets.store(KEY, saved);
          await recoverySnapshot("after-own-key-return", saved);
        }
      });
    } else {
      const saved = JSON.parse((await nativeRead(custody)).toString());
      await check("Restart status stays unverified with no profile/history/key startup access", async () => {
        import_strict.default.equal(profileReads, 0);
        import_strict.default.equal(keyReads, 0);
        import_strict.default.equal(keyStores, 0);
        import_strict.default.equal(picks, 0);
        const status = await call("psReadLineHistoryGuardStatus");
        import_strict.default.equal(status.badge, "Uncovered");
        import_strict.default.equal(status.status, "INSTALLED_CONSOLE_LOAD_UNVERIFIED");
        import_strict.default.equal(sha(nativeState()), saved.receiptSha256);
        clean();
      });
      await check("Disabled restart install cannot mutate the retained owned profile", async () => {
        import_strict.default.equal(config.inspect(FLAG)?.globalValue, false);
        import_strict.default.equal((await call("installPSReadLineHistoryGuard", { approved: true })).status, "UNAVAILABLE");
        import_strict.default.equal(sha(await current()), saved.installedSha256);
      });
      await check("Explicit restart restore uses prior encrypted recovery without new key", async () => {
        import_strict.default.equal((await call("restorePSReadLineHistoryGuard")).status, "RESTORED");
        (0, import_strict.default)((await current()).equals(ORIGINAL));
        import_strict.default.equal(keyStores, 0);
        import_strict.default.equal(ownedReceipt(), void 0);
      });
      await check("Originally absent profile installs and restores exact absence", async () => {
        const absent = (0, import_node_path.join)(home, "absent", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
        await import_promises.default.mkdir((0, import_node_path.dirname)(absent), { recursive: true });
        profiles.add(key(absent));
        selected = absent;
        await flag(true);
        try {
          import_strict.default.equal((await call("installPSReadLineHistoryGuard")).status, "APPLIED");
          import_strict.default.equal((await call("restorePSReadLineHistoryGuard")).status, "RESTORED");
          import_strict.default.deepEqual(await import_promises.default.readdir((0, import_node_path.dirname)(absent)), []);
        } finally {
          selected = target;
        }
      });
      await check("Final owned custody/history and no original TextDocuments/green badge", async () => {
        (0, import_strict.default)((await current()).equals(ORIGINAL));
        (0, import_strict.default)((await nativeRead(history)).equals(HISTORY));
        import_strict.default.equal(ownedReceipt(), void 0);
        import_strict.default.equal((await call("psReadLineHistoryGuardStatus")).badge, "Uncovered");
        clean();
      });
    }
  } catch (error) {
    driverFailure = error instanceof Error ? error.name : "UnknownFailure";
  } finally {
    finish?.(void 0);
    hold = false;
    onModal = void 0;
    if (phase === "restart") try {
      await flag(oldFlag);
    } catch {
      driverFailure ??= "RestoreFlagFailure";
    }
    for (const listener of listeners) listener.dispose();
    for (const restore of restores.reverse()) restore();
  }
  const expected = phase === "primary" ? 23 : 5;
  await import_promises.default.writeFile(output, JSON.stringify({
    phase,
    extensionBundleSha256: runtime,
    observations,
    passed: observations.filter((row) => row.status === "PASS").length,
    failed: observations.filter((row) => row.status === "FAIL").length,
    notRun: expected - observations.filter((row) => row.status !== "NOT_RUN").length,
    driverFailure,
    recoveryDiagnostics,
    counts: { picks, modals, keyReads, keyStores, profileReads, historyReads, outsideReads, originalDocumentCalls, originalDocumentEvents },
    configuration,
    independence: "LOW_SCRIPTED_NATIVE_API_NOT_HUMAN",
    historyScope: "Extension-owned observed filesystem routes only; no real history or console execution in this host"
  }, null, 2) + "\n", { flag: "wx" });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
