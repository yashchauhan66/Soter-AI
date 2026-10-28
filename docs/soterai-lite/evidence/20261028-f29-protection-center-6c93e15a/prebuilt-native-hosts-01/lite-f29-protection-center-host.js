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

// docs/soterai-lite/evidence/20261028-f29-protection-center-6c93e15a/f29-native02.host.ts
var f29_native02_host_exports = {};
__export(f29_native02_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(f29_native02_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_promises = __toESM(require("node:fs/promises"));
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = require("node:path");
var FLAG = "lite.protectionCenter";
var RULES = "soterai.aiForbidden.v1";
var ACTIVITY = "soterai.sentinelEvents";
var PROFILE_RECEIPT = "soterai.lite.ps51.profile.v1";
var PROFILE_NAME = "SoterAI PowerShell 5.1 (checked commands)";
var PRIVATE = "FAKE_ONLY_F29_NATIVE_PRIVATE_4f6392c1";
var VIEW_IDS = ["soterai-protected-items", "soterai-protection-activity", "soterai-protection-coverage"];
var PRIMARY = [
  "Actual shipped activation registers three real native tree views and a real decoration provider",
  "Shipped manifest exposes restricted default-true machine flag, native menus, legacy gates and one status item",
  "Native restricted machine flag refuses a repository override",
  "Trusted fresh owner shows honest empty saved restrictions and disabled owned activity",
  "Actual TreeItems expose bounded native accessibility, theme icons and finite keyboard command arguments",
  "Actual Protection Center focus and native list navigation commands complete without a fabricated keyboard claim",
  "Actual action dispatch rejects caller commands, objects and prototype names without reaching an owner",
  "Actual existing restriction owner saves one public synthetic selector through native file selection",
  "Saved explicit row and Explorer decoration appear without presentation opening protected contents",
  "Actual existing sensitive owner adds a masked public selector and preserves the ordinary deny",
  "Actual existing rule review cancellation changes no persistent policy",
  "Cancelling the actual optional workflow chooser dispatches no backend",
  "Actual reviewed PowerShell setup cancellation preserves both project setting and recovery receipt",
  "Actual reviewed setup and restore owners save and recover the synthetic project setting; unowned restore refuses",
  "Actual Sentinel watcher feeds finite private-value-free Activity rows",
  "Actual missing packaged report remains MISSING and live NOT_TESTED",
  "Actual malformed synthetic installed-copy report remains INVALID without a positive claim",
  "Actual mismatched synthetic installed-copy identity remains MISMATCH without a positive claim",
  "Actual stale synthetic matching report remains STALE without a positive claim",
  "Actual fresh matching synthetic metadata remains NOT_TESTED and never becomes accepted coverage evidence",
  "Injected exact installed-bundle read outage renders UNAVAILABLE without changing runtime bytes",
  "Injected native Memento policy read failure renders a fixed unavailable state and recovers",
  "Injected native untrusted workspace facts withhold saved rows and unsafe actions; revoke remains callable",
  "Injected native empty workspace facts show open-workspace guidance without altering the real workspace",
  "Actual machine withdrawal clears presentation and decoration, preserves rules, restores legacy status action, then saves restart custody"
];
var RESTART = [
  "Fresh actual host retains exact policy custody and does not duplicate persistent restriction writes",
  "Fresh actual native views redisplay saved selectors and real Explorer restriction decoration",
  "Fresh actual Activity presentation contains finite metadata without synthetic private values",
  "Actual TreeItem revoke dispatch resolves a pending original managed read; a late scripted answer cannot grant it",
  "Final actual machine withdrawal preserves denies and recovery records and disables the selected Sentinel preference"
];
var restores = [];
var nativeDisposables = [];
var panels = [];
var views = /* @__PURE__ */ new Map();
var decorationProviders = [];
var statusItems = [];
var ownerCalls = [];
var apiCommands = [];
var notices = [];
var contextKeys = /* @__PURE__ */ new Map();
var readObservations = { document: 0, vscodeRead: 0, nodeReadFile: 0, nodeOpen: 0, syncReadFile: 0, syncOpen: 0 };
var settingChanges = [];
var evidenceMutations = [];
var root = "";
var extensionRoot = "";
var bundle = "";
var phase;
var folder;
var originalFolders;
var selectedFile;
var observedFile = "";
var policyReadFailure = false;
var installedReadFailure = false;
var workspaceMode = "normal";
var picker = "cancel";
var folderPick = "cancel";
var terminalApproval = "cancel";
var approveSentinelDisable = false;
var heldRead;
var holdRead = false;
var readModalCount = 0;
var policyWrites = 0;
var reportCounter = 0;
var reportPath = "";
var originalReportArchive;
var currentReportPresent = false;
var evidencePrepared = false;
var rendererGate;
var protectedPaths = /* @__PURE__ */ new Set();
var sha = (raw) => (0, import_node_crypto.createHash)("sha256").update(raw).digest("hex");
var within = (base, value) => {
  const part = (0, import_node_path.relative)((0, import_node_path.resolve)(base), (0, import_node_path.resolve)(value));
  return part === "" || !part.startsWith("..") && !(0, import_node_path.isAbsolute)(part);
};
var pathKey = (value) => {
  try {
    return typeof value === "string" ? (0, import_node_path.resolve)(value).toLowerCase() : value instanceof URL && value.protocol === "file:" ? (0, import_node_path.resolve)(vscode.Uri.parse(value.href).fsPath).toLowerCase() : void 0;
  } catch {
    return;
  }
};
var trackedRead = (value) => {
  const key = pathKey(value);
  return key !== void 0 && protectedPaths.has(key);
};
function valueFree(value) {
  (0, import_strict.default)(!(typeof value === "string" ? value : JSON.stringify(value) ?? "").includes(PRIVATE), "Private synthetic value entered the native presentation.");
}
function patch(object, name, value) {
  const previous = Object.getOwnPropertyDescriptor(object, name);
  Object.defineProperty(object, name, { configurable: true, writable: true, value });
  restores.push(() => previous ? Object.defineProperty(object, name, previous) : Reflect.deleteProperty(object, name));
}
function getter(object, name, read) {
  const previous = Object.getOwnPropertyDescriptor(object, name);
  Object.defineProperty(object, name, { configurable: true, enumerable: previous?.enumerable ?? true, get: read });
  restores.push(() => previous ? Object.defineProperty(object, name, previous) : Reflect.deleteProperty(object, name));
}
async function until(predicate, description) {
  const end = Date.now() + 15e3;
  while (!predicate() && Date.now() < end) await new Promise((done) => setTimeout(done, 20));
  (0, import_strict.default)(predicate(), description);
}
async function bounded(work, description) {
  let timer;
  try {
    return await Promise.race([Promise.resolve(work), new Promise((_done, reject) => {
      timer = setTimeout(() => reject(Error(description)), 15e3);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function updateFlag(key, value) {
  const config = vscode.workspace.getConfiguration("soterai");
  if (config.inspect(key)?.globalValue === value) return;
  let acknowledge;
  const acknowledged = new Promise((done) => {
    acknowledge = done;
  });
  const listener = vscode.workspace.onDidChangeConfiguration((change) => {
    if (change.affectsConfiguration("soterai." + key) && config.inspect(key)?.globalValue === value) acknowledge();
  });
  try {
    await config.update(key, value, vscode.ConfigurationTarget.Global);
    await bounded(acknowledged, "Native machine flag acknowledgement unavailable.");
  } finally {
    listener.dispose();
  }
}
async function children(id) {
  const captured = views.get(id);
  (0, import_strict.default)(captured, "Actual shipped native provider was not captured.");
  return [...await captured.provider.getChildren() ?? []];
}
async function items(id) {
  const provider = views.get(id).provider;
  return Promise.all((await children(id)).map((row) => Promise.resolve(provider.getTreeItem(row))));
}
async function refresh() {
  await vscode.commands.executeCommand("soterai.refreshProtectionCenter");
}
var allRows = async () => Object.fromEntries(await Promise.all(VIEW_IDS.map(async (id) => [id, await children(id)])));
async function noLivePass() {
  const rows = await children(VIEW_IDS[2]), text = JSON.stringify(rows);
  valueFree(rows);
  (0, import_strict.default)(text.includes("Live verification: NOT_TESTED"));
  (0, import_strict.default)(text.includes("Uncovered: unmanaged native reads"));
  (0, import_strict.default)(!text.includes("Reported PASS"));
  (0, import_strict.default)(!text.includes("100%"));
}
async function centerAction(action) {
  return vscode.commands.executeCommand("soterai.protectionCenterAction", action);
}
function statusOf(value) {
  try {
    if (!value || typeof value !== "object") return;
    const d = Object.getOwnPropertyDescriptor(value, "status");
    return d && "value" in d && typeof d.value === "string" ? d.value : void 0;
  } catch {
    return;
  }
}
function releaseHeldRead(value) {
  const release = heldRead;
  if (typeof release === "function") release(value);
}
function assertOwner(command, from, expectedStatus) {
  const found = ownerCalls.slice(from).filter((call) => call.command === command);
  import_strict.default.equal(found.length, 1);
  import_strict.default.equal(found[0].argumentCount, 0);
  import_strict.default.equal(found[0].status, expectedStatus);
}
var policy = (context) => context.workspaceState.get(RULES, {});
var policyDigest = (context) => sha(JSON.stringify(policy(context)));
function terminalSetting() {
  return vscode.workspace.getConfiguration("terminal.integrated", folder.uri).inspect("defaultProfile.windows")?.workspaceValue;
}
async function nativeDecoration(uri) {
  const cancellation = new vscode.CancellationTokenSource();
  try {
    const candidates = await Promise.all(decorationProviders.map((provider) => Promise.resolve(provider.provideFileDecoration(uri, cancellation.token))));
    return candidates.find((item) => item !== void 0 && item !== null && typeof item.tooltip === "string" && item.tooltip.includes("Saved SoterAI restriction"));
  } finally {
    cancellation.dispose();
  }
}
async function rendererObservationGate(runtime) {
  const selected = process.env.SOTERAI_F29_RENDERER_GATE_DIRECTORY;
  if (!selected) return;
  (0, import_strict.default)((0, import_node_path.isAbsolute)(selected));
  const directory = (0, import_node_path.resolve)(selected);
  import_strict.default.match(directory, /^D:\\SoterAI-Lite-test-profiles\\/i);
  (0, import_strict.default)(!within(root, directory));
  const stat = await import_promises.default.lstat(directory);
  (0, import_strict.default)(stat.isDirectory() && !stat.isSymbolicLink());
  const readyFile = (0, import_node_path.join)(directory, "f29-renderer-ready.json"), doneFile = (0, import_node_path.join)(directory, "f29-renderer-done.json");
  await import_strict.default.rejects(import_promises.default.lstat(doneFile), (error) => error.code === "ENOENT");
  const panel = panels.find((item) => item.viewType === "soteraiProjectPrivacy");
  (0, import_strict.default)(panel);
  await until(() => panel.webview.html.includes("Project privacy"), "Actual owner privacy HTML was not populated.");
  const html = Buffer.from(panel.webview.html, "utf8"), htmlPath = (0, import_node_path.join)(directory, "f29-project-privacy-captured.html");
  await import_promises.default.writeFile(htmlPath, html, { flag: "wx" });
  const ready = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    feature: "F29",
    profile: process.env.USERPROFILE,
    runRoot: directory,
    workspace: root,
    loadedBundleSha256: runtime,
    installedExtensionPath: extensionRoot,
    html: { path: htmlPath, bytes: html.length, sha256: sha(html) },
    theme: { kind: vscode.window.activeColorTheme.kind },
    stage: "N06_ACTUAL_PROJECT_PRIVACY_CAPTURE",
    source: "ACTUAL_SHIPPED_OWNER_WEBVIEW_HTML_UNMODIFIED_UTF8",
    syntheticOnly: true,
    signals: 0
  }) + "\n", "utf8");
  await import_promises.default.writeFile(readyFile, ready, { flag: "wx" });
  const readySha256 = sha(ready);
  rendererGate = { status: "WAITING_FOR_SEPARATE_ACTUAL_RENDERER_OBSERVER", readySha256 };
  const deadline = Date.now() + 18e4;
  while (Date.now() < deadline) {
    try {
      const doneStat = await import_promises.default.lstat(doneFile);
      (0, import_strict.default)(doneStat.isFile() && !doneStat.isSymbolicLink() && doneStat.nlink === 1 && doneStat.size <= 65536);
      const done = JSON.parse(await import_promises.default.readFile(doneFile, "utf8"));
      import_strict.default.equal(done.schemaVersion, 1);
      import_strict.default.equal(done.status, "OBSERVER_COMPLETED");
      import_strict.default.equal(done.readySha256, readySha256);
      import_strict.default.equal(done.signals, 0);
      const pin = done.observationsPin;
      (0, import_strict.default)(pin && typeof pin.path === "string" && within(directory, pin.path));
      const pinStat = await import_promises.default.lstat(pin.path);
      (0, import_strict.default)(pinStat.isFile() && !pinStat.isSymbolicLink() && pinStat.nlink === 1 && pinStat.size <= 8 * 1024 * 1024);
      const raw = await import_promises.default.readFile(pin.path);
      import_strict.default.equal(raw.length, pin.bytes);
      import_strict.default.equal(sha(raw), pin.sha256);
      rendererGate = { status: "SEPARATE_ACTUAL_RENDERER_OBSERVER_RECEIPT_AVAILABLE_REQUIRES_ROOT_REVIEW", readySha256, observationsPin: pin };
      import_strict.default.equal(sha(await import_promises.default.readFile(bundle)), runtime);
      return;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  rendererGate.status = "OBSERVER_DEADLINE_INCOMPLETE_NO_SIGNALS";
  throw Error("Separate native renderer observer did not complete within its prepared bounded gate.");
}
async function stageReport(raw) {
  (0, import_strict.default)(evidencePrepared);
  (0, import_strict.default)(within(extensionRoot, reportPath));
  import_strict.default.match(extensionRoot, /^D:\\SoterAI-Lite-test-profiles\\/i);
  if (currentReportPresent) {
    const before = await import_promises.default.lstat(reportPath);
    (0, import_strict.default)(before.isFile() && !before.isSymbolicLink() && before.nlink === 1);
    const archive = (0, import_node_path.join)((0, import_node_path.dirname)(reportPath), `f29-synthetic-report-retained-${String(++reportCounter).padStart(2, "0")}.json`);
    await import_strict.default.rejects(import_promises.default.lstat(archive), (error) => error.code === "ENOENT");
    await import_promises.default.rename(reportPath, archive);
    currentReportPresent = false;
    const bytes = await import_promises.default.readFile(archive);
    evidenceMutations.push({ action: "ARCHIVED_SYNTHETIC_INPUT", archive, bytes: bytes.length, sha256: sha(bytes) });
  }
  if (raw !== void 0) {
    (0, import_strict.default)(Buffer.byteLength(raw) <= 64 * 1024);
    await import_promises.default.writeFile(reportPath, raw, { flag: "wx" });
    currentReportPresent = true;
    evidenceMutations.push({ action: "STAGED_SYNTHETIC_INPUT_NOT_SHIPPED_EVIDENCE", bytes: Buffer.byteLength(raw), sha256: sha(raw) });
  }
}
async function prepareReports() {
  reportPath = (0, import_node_path.join)(extensionRoot, "verification", "project-privacy-verification.json");
  (0, import_strict.default)(within(extensionRoot, reportPath));
  try {
    const directory = await import_promises.default.lstat((0, import_node_path.dirname)(reportPath));
    (0, import_strict.default)(directory.isDirectory() && !directory.isSymbolicLink());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await import_promises.default.mkdir((0, import_node_path.dirname)(reportPath));
  }
  try {
    const before = await import_promises.default.lstat(reportPath);
    (0, import_strict.default)(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= 65536);
    originalReportArchive = (0, import_node_path.join)((0, import_node_path.dirname)(reportPath), "f29-original-report-retained.json");
    await import_strict.default.rejects(import_promises.default.lstat(originalReportArchive), (error) => error.code === "ENOENT");
    await import_promises.default.rename(reportPath, originalReportArchive);
    const raw = await import_promises.default.readFile(originalReportArchive);
    evidenceMutations.push({ action: "ARCHIVED_ORIGINAL_INSTALLED_COPY_REPORT", archive: originalReportArchive, bytes: raw.length, sha256: sha(raw) });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  evidencePrepared = true;
}
async function restoreReports() {
  if (!evidencePrepared) return;
  await stageReport(void 0);
  if (originalReportArchive) {
    const raw = await import_promises.default.readFile(originalReportArchive);
    await import_promises.default.rename(originalReportArchive, reportPath);
    import_strict.default.equal(sha(await import_promises.default.readFile(reportPath)), sha(raw));
    evidenceMutations.push({ action: "RESTORED_ORIGINAL_INSTALLED_COPY_REPORT", bytes: raw.length, sha256: sha(raw) });
  } else {
    await import_strict.default.rejects(import_promises.default.lstat(reportPath), (error) => error.code === "ENOENT");
    evidenceMutations.push({ action: "RESTORED_ORIGINAL_REPORT_ABSENCE" });
  }
  evidencePrepared = false;
}
function setupDiagnostic() {
  return {
    status: "PREPARED_INSTALLED_OWNER_NATIVE_API_FIXTURE",
    phase,
    nativeViewIds: [...views.keys()],
    nativeDecorationProviders: decorationProviders.length,
    statusItemCount: statusItems.length,
    policyWrites,
    ownerCalls: ownerCalls.length,
    syntheticReportInputs: evidenceMutations.length,
    currentWorkspaceMode: workspaceMode,
    syntheticOnly: true,
    productImports: false,
    signals: 0
  };
}
async function beforeActivate(context) {
  import_strict.default.equal(process.platform, "win32");
  import_strict.default.equal(vscode.env.remoteName, void 0);
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  import_strict.default.equal(vscode.workspace.isTrusted, true);
  folder = vscode.workspace.workspaceFolders[0];
  root = folder.uri.fsPath;
  originalFolders = vscode.workspace.workspaceFolders;
  extensionRoot = context.extensionUri.fsPath;
  bundle = (0, import_node_path.join)(extensionRoot, "dist", "extension.js");
  for (const file of [root, context.globalStorageUri.fsPath, extensionRoot, process.env.USERPROFILE]) import_strict.default.match((0, import_node_path.resolve)(file), /^D:\\SoterAI-Lite-test-profiles\\/i);
  (0, import_strict.default)(!within(root, context.globalStorageUri.fsPath));
  const selected = process.env.SOTERAI_LITE_F17_PHASE;
  (0, import_strict.default)(selected === "primary" || selected === "restart");
  phase = selected;
  const trust = vscode.workspace.isTrusted;
  getter(vscode.workspace, "workspaceFolders", () => workspaceMode === "empty" ? [] : originalFolders);
  getter(vscode.workspace, "isTrusted", () => workspaceMode === "untrusted" ? false : trust);
  const createView = vscode.window.createTreeView;
  patch(vscode.window, "createTreeView", (id, options) => {
    const view = Reflect.apply(createView, vscode.window, [id, options]);
    if (VIEW_IDS.includes(id)) {
      (0, import_strict.default)(!views.has(id));
      views.set(id, { provider: options.treeDataProvider, view });
    }
    return view;
  });
  const registerDecoration = vscode.window.registerFileDecorationProvider;
  patch(vscode.window, "registerFileDecorationProvider", (provider) => {
    const result = Reflect.apply(registerDecoration, vscode.window, [provider]);
    decorationProviders.push(provider);
    return result;
  });
  const createStatus = vscode.window.createStatusBarItem;
  patch(vscode.window, "createStatusBarItem", (...args) => {
    const item = Reflect.apply(createStatus, vscode.window, args);
    statusItems.push(item);
    return item;
  });
  const registerCommand = vscode.commands.registerCommand;
  patch(vscode.commands, "registerCommand", (id, callback, thisArg) => {
    const wrapped = function(...args) {
      const call = { command: id, argumentCount: args.length };
      ownerCalls.push(call);
      try {
        const result = Reflect.apply(callback, thisArg, args);
        return Promise.resolve(result).then((value) => {
          call.status = statusOf(value);
          return value;
        }, (error) => {
          call.rejected = true;
          throw error;
        });
      } catch (error) {
        call.rejected = true;
        throw error;
      }
    };
    return Reflect.apply(registerCommand, vscode.commands, [id, wrapped, thisArg]);
  });
  const execute = vscode.commands.executeCommand;
  patch(vscode.commands, "executeCommand", (command, ...args) => {
    apiCommands.push(command);
    if (command === "setContext" && typeof args[0] === "string") contextKeys.set(args[0], args[1]);
    return Reflect.apply(execute, vscode.commands, [command, ...args]);
  });
  const stateGet = context.workspaceState.get, stateUpdate = context.workspaceState.update;
  patch(context.workspaceState, "get", (key, ...args) => {
    if (key === RULES && policyReadFailure) throw Error(PRIVATE);
    return Reflect.apply(stateGet, context.workspaceState, [key, ...args]);
  });
  patch(context.workspaceState, "update", async (key, value) => {
    await stateUpdate.call(context.workspaceState, key, value);
    if (key === RULES) policyWrites++;
  });
  const configuration = vscode.workspace.getConfiguration;
  patch(vscode.workspace, "getConfiguration", (section, scope) => {
    const config = configuration.call(vscode.workspace, section, scope), update = config.update;
    if (section === "terminal.integrated") {
      Object.defineProperty(config, "update", { configurable: true, value: (key, value, target, override) => {
        settingChanges.push({ section, key, target });
        return update.call(config, key, value, target, override);
      } });
    }
    return config;
  });
  const originalOpen = vscode.workspace.openTextDocument;
  patch(vscode.workspace, "openTextDocument", (...args) => {
    const input = args[0];
    if (input instanceof vscode.Uri && protectedPaths.has(input.fsPath.toLowerCase()) || typeof input === "string" && trackedRead(input)) readObservations.document++;
    return Reflect.apply(originalOpen, vscode.workspace, args);
  });
  const vscodeRead = vscode.workspace.fs.readFile;
  patch(vscode.workspace.fs, "readFile", (uri) => {
    if (trackedRead(uri.fsPath)) readObservations.vscodeRead++;
    return vscodeRead.call(vscode.workspace.fs, uri);
  });
  const readFile = import_promises.default.readFile, open = import_promises.default.open, syncRead = import_node_fs.default.readFileSync, syncOpen = import_node_fs.default.openSync;
  patch(import_promises.default, "readFile", (...args) => {
    if (trackedRead(args[0])) readObservations.nodeReadFile++;
    return Reflect.apply(readFile, import_promises.default, args);
  });
  patch(import_promises.default, "open", (...args) => {
    if (trackedRead(args[0])) readObservations.nodeOpen++;
    return Reflect.apply(open, import_promises.default, args);
  });
  patch(import_node_fs.default, "readFileSync", (...args) => {
    if (trackedRead(args[0])) readObservations.syncReadFile++;
    return Reflect.apply(syncRead, import_node_fs.default, args);
  });
  patch(import_node_fs.default, "openSync", (...args) => {
    if (trackedRead(args[0])) readObservations.syncOpen++;
    if (installedReadFailure && pathKey(args[0]) === bundle.toLowerCase()) throw Error(PRIVATE);
    return Reflect.apply(syncOpen, import_node_fs.default, args);
  });
  const quickPick = vscode.window.showQuickPick;
  patch(vscode.window, "showQuickPick", (choices, options) => {
    if (options?.title === "Protection Center: optional setup and restore") {
      (0, import_strict.default)(Array.isArray(choices));
      valueFree(choices);
      import_strict.default.equal(choices.length, 20);
      return Promise.resolve(picker === "cancel" ? void 0 : choices.find((choice) => choice.action === picker));
    }
    return Reflect.apply(quickPick, vscode.window, [choices, options]);
  });
  const pickFolder = vscode.window.showWorkspaceFolderPick;
  patch(vscode.window, "showWorkspaceFolderPick", (...args) => {
    if (folderPick === "cancel") return Promise.resolve(void 0);
    if (folderPick === "first") return Promise.resolve(folder);
    return Reflect.apply(pickFolder, vscode.window, args);
  });
  const openDialog = vscode.window.showOpenDialog;
  patch(vscode.window, "showOpenDialog", (options) => {
    if (options?.title === "Choose a project file for a safe view") return Promise.resolve(selectedFile ? [selectedFile] : void 0);
    return Reflect.apply(openDialog, vscode.window, [options]);
  });
  const warning = vscode.window.showWarningMessage;
  patch(vscode.window, "showWarningMessage", (message, ...args) => {
    if (message === "Apply this terminal profile change to the selected project?") {
      const options = args[0];
      import_strict.default.equal(options.modal, true);
      valueFree([message, args]);
      return Promise.resolve(terminalApproval === "apply" ? "Use checked PowerShell profile" : terminalApproval === "restore" ? "Restore previous terminal profile" : void 0);
    }
    if (args.includes("Allow safe read once")) {
      const options = args[0];
      import_strict.default.equal(options.modal, true);
      valueFree(options.detail);
      readModalCount++;
      if (holdRead) return new Promise((done) => {
        heldRead = done;
      });
      return Promise.resolve(void 0);
    }
    if (message.startsWith("Disable AI Activity Sentinel monitoring?")) return Promise.resolve(approveSentinelDisable ? "Confirm this change" : void 0);
    valueFree(message);
    notices.push(message);
    return Reflect.apply(warning, vscode.window, [message, ...args]);
  });
  const info = vscode.window.showInformationMessage, errorMessage = vscode.window.showErrorMessage;
  patch(vscode.window, "showInformationMessage", (message, ...args) => {
    valueFree(message);
    notices.push(message);
    return Reflect.apply(info, vscode.window, [message, ...args]);
  });
  patch(vscode.window, "showErrorMessage", (message, ...args) => {
    valueFree(message);
    notices.push(message);
    return Reflect.apply(errorMessage, vscode.window, [message, ...args]);
  });
  const createPanel = vscode.window.createWebviewPanel;
  patch(vscode.window, "createWebviewPanel", (...args) => {
    const panel = Reflect.apply(createPanel, vscode.window, args);
    panels.push(panel);
    return panel;
  });
}
async function run(context) {
  const output = process.env.SOTERAI_LITE_F17_EVIDENCE;
  (0, import_strict.default)(output && (0, import_node_path.isAbsolute)(output));
  const runtime = sha(await import_promises.default.readFile(bundle));
  import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
  const manifest = JSON.parse(await import_promises.default.readFile((0, import_node_path.join)(extensionRoot, "package.json"), "utf8"));
  const scopes = phase === "primary" ? PRIMARY : RESTART;
  const rows = scopes.map((scope, index) => ({ id: `F29-${phase === "primary" ? "N" : "R"}${String(index + 1).padStart(2, "0")}`, scope, status: "NOT_RUN" }));
  let cursor = 0, driverFailure, cleanupFailure;
  const check = async (work) => {
    const row = rows[cursor++];
    try {
      await work();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      row.errorName = error instanceof Error ? error.name : "UnknownFailure";
      throw error;
    }
  };
  const ordinary = vscode.Uri.file((0, import_node_path.join)(root, "f29-public-restricted.txt")), sensitive = vscode.Uri.file((0, import_node_path.join)(root, "f29-public-sensitive.txt"));
  const activityFile = vscode.Uri.file((0, import_node_path.join)(root, "f29-native-activity", ".env"));
  const custody = (0, import_node_path.join)((0, import_node_path.dirname)(root), "f29-native-restart-custody.json");
  const report = (identity = runtime, date = (/* @__PURE__ */ new Date()).toISOString()) => JSON.stringify({
    schemaVersion: 1,
    generatedAt: date,
    artifact: { extensionSha256: identity },
    suites: [],
    surfaces: []
  }) + "\n";
  const evidenceState = async (state) => {
    await refresh();
    (0, import_strict.default)(JSON.stringify(await children(VIEW_IDS[2])).includes(`Packaged evidence: ${state}`));
    await noLivePass();
  };
  const workflow = async (action) => {
    picker = action;
    try {
      return await centerAction("workflows");
    } finally {
      picker = "cancel";
    }
  };
  const invokeItem = async (id, action) => {
    const item = (await items(id)).find((row) => row.command?.arguments?.[0] === action);
    (0, import_strict.default)(item?.command);
    return vscode.commands.executeCommand(item.command.command, ...item.command.arguments ?? []);
  };
  try {
    if (phase === "primary") {
      await check(async () => {
        import_strict.default.deepEqual([...views.keys()], VIEW_IDS);
        (0, import_strict.default)(decorationProviders.length > 0);
        for (const { view, provider } of views.values()) {
          import_strict.default.equal(typeof view.reveal, "function");
          import_strict.default.equal(typeof provider.getChildren, "function");
        }
        import_strict.default.equal(contextKeys.get("soterai.protectionCenter"), true);
      });
      await check(async () => {
        const contributions = manifest.contributes, setting = contributions.configuration.properties["soterai." + FLAG];
        import_strict.default.equal(setting.type, "boolean");
        import_strict.default.equal(setting.default, true);
        import_strict.default.equal(setting.scope, "machine");
        (0, import_strict.default)(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai." + FLAG));
        const registeredViews = contributions.views["soterai-explorer"];
        for (const id of VIEW_IDS) {
          const view = registeredViews.find((item) => item.id === id);
          (0, import_strict.default)(view);
          import_strict.default.equal(view.type, void 0);
          import_strict.default.equal(view.when, "soterai.protectionCenter");
        }
        for (const id of ["soterai-control-panel", "soterai-project-risk", "soterai-latest-findings", "soterai-policy-status"]) (0, import_strict.default)(registeredViews.find((item) => item.id === id)?.when.includes("!soterai.protectionCenter"));
        (0, import_strict.default)(contributions.menus["explorer/context"].some((item) => item.command === "soterai.openProtectionCenter"));
        (0, import_strict.default)(contributions.menus["view/title"].some((item) => item.command === "soterai.refreshProtectionCenter"));
        import_strict.default.equal(statusItems.length, 1);
        await until(() => statusItems[0].command === "soterai.openProtectionCenter", "Actual single status item did not point to Protection Center.");
        import_strict.default.equal(statusItems[0].accessibilityInformation?.role, "button");
      });
      await check(async () => {
        const config = vscode.workspace.getConfiguration("soterai");
        import_strict.default.equal(config.inspect(FLAG)?.defaultValue, true);
        await import_strict.default.rejects(Promise.resolve(config.update(FLAG, false, vscode.ConfigurationTarget.Workspace)), { name: "CodeExpectedError" });
        import_strict.default.equal(config.inspect(FLAG)?.workspaceValue, void 0);
        await refresh();
        import_strict.default.equal(contextKeys.get("soterai.protectionCenter"), true);
      });
      await check(async () => {
        import_strict.default.equal(vscode.workspace.isTrusted, true);
        await refresh();
        (0, import_strict.default)(JSON.stringify(await children(VIEW_IDS[0])).includes("No saved explicit restrictions"));
        (0, import_strict.default)(JSON.stringify(await children(VIEW_IDS[1])).includes("Owned activity disabled or unavailable"));
        await noLivePass();
      });
      await check(async () => {
        for (const id of VIEW_IDS) for (const item of await items(id)) {
          const label = typeof item.label === "string" ? item.label : item.label?.label;
          import_strict.default.equal(typeof label, "string");
          (0, import_strict.default)(label.length <= 1024);
          import_strict.default.equal(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
          import_strict.default.equal(item.accessibilityInformation?.role, "treeitem");
          import_strict.default.equal(typeof item.accessibilityInformation?.label, "string");
          (0, import_strict.default)(item.iconPath instanceof vscode.ThemeIcon);
          import_strict.default.equal(typeof item.tooltip, "string");
          valueFree([label, item.description, item.tooltip]);
          (0, import_strict.default)(!label.includes("<button"));
          if (item.command) {
            import_strict.default.equal(item.command.command, "soterai.protectionCenterAction");
            import_strict.default.equal(item.command.arguments?.length, 1);
            import_strict.default.equal(typeof item.command.arguments[0], "string");
          }
        }
      });
      await check(async () => {
        const commands2 = new Set(await vscode.commands.getCommands(true));
        for (const command of ["list.focusFirst", "list.focusDown", "list.focusUp"]) (0, import_strict.default)(commands2.has(command), "Installed native list navigation command unavailable.");
        import_strict.default.deepEqual(await vscode.commands.executeCommand("soterai.openProtectionCenter"), { status: "OPENED" });
        await until(() => views.get(VIEW_IDS[0]).view.visible, "Actual native Protected items view never became visible.");
        for (const command of ["list.focusFirst", "list.focusDown", "list.focusUp"]) await vscode.commands.executeCommand(command);
        (0, import_strict.default)(apiCommands.includes(VIEW_IDS[0] + ".focus"));
        for (const id of VIEW_IDS) await vscode.commands.executeCommand(id + ".focus");
        import_strict.default.deepEqual(await invokeItem(VIEW_IDS[0], "privacy"), { status: "OPENED" });
        await rendererObservationGate(runtime);
      });
      await check(async () => {
        const before = ownerCalls.length;
        for (const action of ["workbench.action.terminal.sendSequence", "__proto__", "constructor", { action: "revoke", approved: true, path: PRIVATE }, void 0]) import_strict.default.deepEqual(await centerAction(action), { status: "UNAVAILABLE" });
        const actual = ownerCalls.slice(before).filter((call) => call.command !== "soterai.protectionCenterAction");
        import_strict.default.deepEqual(actual, []);
        valueFree(await allRows());
      });
      await check(async () => {
        await import_promises.default.writeFile(ordinary.fsPath, "Public F29 saved restriction fixture.\n", { flag: "wx" });
        selectedFile = ordinary;
        const before = ownerCalls.length;
        try {
          const result = await centerAction("restrict");
          (0, import_strict.default)(["SAVED", "UNAVAILABLE"].includes(result.status), "Persistent-rule events may invalidate the pending presentation generation; no stronger result is allowed.");
        } finally {
          selectedFile = void 0;
        }
        const calls = ownerCalls.slice(before);
        (0, import_strict.default)(calls.some((call) => ["soterai.restrictProjectFile", "soterai.blockFromAI"].includes(call.command) && call.status === "SAVED"));
        (0, import_strict.default)(calls.some((call) => call.command === "soterai.restrictProjectFile" && call.argumentCount === 0), "Presentation must dispatch the existing native file-picker owner with no forwarded path.");
        (0, import_strict.default)(JSON.stringify(policy(context)).includes("f29-public-restricted.txt"));
      });
      await check(async () => {
        observedFile = ordinary.fsPath;
        protectedPaths.add((0, import_node_path.resolve)(observedFile).toLowerCase());
        const before = JSON.stringify(readObservations);
        await refresh();
        (0, import_strict.default)(JSON.stringify(await children(VIEW_IDS[0])).includes("file: f29-public-restricted.txt"));
        const decoration = await nativeDecoration(ordinary);
        (0, import_strict.default)(decoration);
        import_strict.default.equal(decoration.propagate, false);
        (0, import_strict.default)(decoration.badge);
        import_strict.default.equal(JSON.stringify(readObservations), before, "Presentation opened or read the protected fixture contents.");
      });
      await check(async () => {
        await import_promises.default.writeFile(sensitive.fsPath, PRIVATE + "\n", { flag: "wx" });
        import_strict.default.deepEqual(await vscode.commands.executeCommand("soterai.restrictSensitiveFile", sensitive), { status: "SAVED" });
        protectedPaths.add((0, import_node_path.resolve)(sensitive.fsPath).toLowerCase());
        const before = JSON.stringify(readObservations);
        await refresh();
        const row = (await children(VIEW_IDS[0])).find((item) => item.label.includes("f29-public-sensitive.txt"));
        (0, import_strict.default)(row?.description?.includes("Values stay masked"));
        (0, import_strict.default)(await nativeDecoration(sensitive));
        valueFree(await allRows());
        import_strict.default.equal(JSON.stringify(readObservations), before);
        (0, import_strict.default)(JSON.stringify(policy(context)).includes("f29-public-restricted.txt"));
      });
      await check(async () => {
        const before = policyDigest(context), calls = ownerCalls.length;
        folderPick = "cancel";
        import_strict.default.deepEqual(await invokeItem(VIEW_IDS[0], "manage"), { status: "CANCELLED" });
        assertOwner("soterai.manageAIRules", calls, "CANCELLED");
        import_strict.default.equal(policyDigest(context), before);
      });
      await check(async () => {
        const before = ownerCalls.length;
        picker = "cancel";
        import_strict.default.deepEqual(await centerAction("workflows"), { status: "CANCELLED" });
        import_strict.default.deepEqual(ownerCalls.slice(before).filter((call) => call.command !== "soterai.protectionCenterAction"), []);
      });
      await check(async () => {
        const setting = terminalSetting(), receipt = context.workspaceState.get(PROFILE_RECEIPT), changes = settingChanges.length, before = ownerCalls.length;
        terminalApproval = "cancel";
        import_strict.default.deepEqual(await workflow("ps51"), { status: "CANCELLED" });
        assertOwner("soterai.configureCheckedPowerShell", before, "CANCELLED");
        import_strict.default.deepEqual(terminalSetting(), setting);
        import_strict.default.deepEqual(context.workspaceState.get(PROFILE_RECEIPT), receipt);
        import_strict.default.equal(settingChanges.length, changes);
      });
      await check(async () => {
        const beforeSetting = terminalSetting();
        import_strict.default.equal(context.workspaceState.get(PROFILE_RECEIPT), void 0);
        let start = ownerCalls.length;
        const absent = await workflow("restorePs51");
        import_strict.default.deepEqual(absent, { status: "UNAVAILABLE" });
        assertOwner("soterai.restoreCheckedPowerShell", start, "UNAVAILABLE");
        terminalApproval = "apply";
        start = ownerCalls.length;
        const applied = await workflow("ps51");
        assertOwner("soterai.configureCheckedPowerShell", start, "SAVED");
        (0, import_strict.default)(["SAVED", "UNAVAILABLE"].includes(applied.status), "Presentation must not invent a stronger backend result after settings drift.");
        import_strict.default.equal(terminalSetting(), PROFILE_NAME);
        import_strict.default.equal(context.workspaceState.get(PROFILE_RECEIPT)?.phase, "APPLIED");
        terminalApproval = "restore";
        start = ownerCalls.length;
        const restored = await workflow("restorePs51");
        assertOwner("soterai.restoreCheckedPowerShell", start, "SAVED");
        (0, import_strict.default)(["SAVED", "UNAVAILABLE"].includes(restored.status));
        import_strict.default.deepEqual(terminalSetting(), beforeSetting);
        import_strict.default.equal(context.workspaceState.get(PROFILE_RECEIPT), void 0);
        terminalApproval = "cancel";
      });
      await check(async () => {
        await updateFlag("lite.selfHygiene", true);
        await vscode.commands.executeCommand("soterai.enableAISentinel");
        await import_promises.default.mkdir((0, import_node_path.dirname)(activityFile.fsPath), { recursive: true });
        let witnessed = false;
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, "f29-native-activity/.env"));
        const created = watcher.onDidCreate(() => {
          witnessed = true;
        }), changed = watcher.onDidChange(() => {
          witnessed = true;
        });
        try {
          await import_promises.default.writeFile(activityFile.fsPath, "API_KEY=" + PRIVATE + "\nPUBLIC_PORT=8080\n", { flag: "wx" });
          await until(() => witnessed, "Independent actual native file watcher saw no synthetic event.");
          await until(() => context.globalState.get(ACTIVITY, []).some((event) => event.type === "protected_access"), "Actual Sentinel owner persisted no native protected-file activity.");
        } finally {
          created.dispose();
          changed.dispose();
          watcher.dispose();
        }
        await refresh();
        const activity = await children(VIEW_IDS[1]);
        valueFree(activity);
        (0, import_strict.default)(activity.some((row) => row.label.includes("protected_access:")));
        (0, import_strict.default)(!JSON.stringify(activity).includes("f29-native-activity"));
        (0, import_strict.default)(!JSON.stringify(activity).includes("API_KEY"));
      });
      await check(async () => {
        await prepareReports();
        await evidenceState("MISSING");
      });
      await check(async () => {
        await stageReport("{INVALID_SYNTHETIC_" + PRIVATE);
        await evidenceState("INVALID");
      });
      await check(async () => {
        await stageReport(report("0".repeat(64)));
        await evidenceState("MISMATCH");
      });
      await check(async () => {
        await stageReport(report(runtime, "2000-01-01T00:00:00.000Z"));
        await evidenceState("STALE");
      });
      await check(async () => {
        await stageReport(report());
        await evidenceState("MATCHED");
        import_strict.default.equal(sha(await import_promises.default.readFile(bundle)), runtime);
      });
      await check(async () => {
        installedReadFailure = true;
        try {
          await evidenceState("UNAVAILABLE");
        } finally {
          installedReadFailure = false;
        }
        import_strict.default.equal(sha(await import_promises.default.readFile(bundle)), runtime);
        await evidenceState("MATCHED");
        await restoreReports();
      });
      await check(async () => {
        const before = policyDigest(context);
        policyReadFailure = true;
        try {
          await refresh();
          const text = JSON.stringify(await children(VIEW_IDS[0]));
          valueFree(text);
          (0, import_strict.default)(text.includes("Saved restrictions unavailable"));
        } finally {
          policyReadFailure = false;
        }
        await refresh();
        import_strict.default.equal(policyDigest(context), before);
        (0, import_strict.default)(JSON.stringify(await children(VIEW_IDS[0])).includes("f29-public-restricted.txt"));
      });
      await check(async () => {
        const before = policyDigest(context);
        workspaceMode = "untrusted";
        try {
          await refresh();
          (0, import_strict.default)(JSON.stringify(await children(VIEW_IDS[0])).includes("Trust this workspace"));
          (0, import_strict.default)(!JSON.stringify(await allRows()).includes("f29-public-restricted.txt"));
          import_strict.default.equal(await nativeDecoration(ordinary), void 0);
          import_strict.default.deepEqual(await centerAction("restrict"), { status: "UNAVAILABLE" });
          const calls = ownerCalls.length;
          import_strict.default.deepEqual(await centerAction("revoke"), { status: "REVOKED" });
          assertOwner("soterai.revokeProjectReads", calls, "REVOKED");
        } finally {
          workspaceMode = "normal";
        }
        await refresh();
        import_strict.default.equal(policyDigest(context), before);
      });
      await check(async () => {
        workspaceMode = "empty";
        try {
          await refresh();
          (0, import_strict.default)(JSON.stringify(await children(VIEW_IDS[0])).includes("Open a local workspace"));
          (0, import_strict.default)(!JSON.stringify(await allRows()).includes("f29-public-restricted.txt"));
        } finally {
          workspaceMode = "normal";
        }
        await refresh();
        import_strict.default.equal(vscode.workspace.workspaceFolders?.[0], folder);
      });
      await check(async () => {
        const before = policyDigest(context), receipt = context.workspaceState.get(PROFILE_RECEIPT);
        await updateFlag(FLAG, false);
        await refresh();
        for (const id of VIEW_IDS) {
          const rows2 = await children(id);
          import_strict.default.equal(rows2.length, 1);
          (0, import_strict.default)(rows2[0].label.includes("Protection Center disabled"));
        }
        import_strict.default.equal(await nativeDecoration(ordinary), void 0);
        import_strict.default.equal(contextKeys.get("soterai.protectionCenter"), false);
        import_strict.default.deepEqual(await vscode.commands.executeCommand("soterai.openProtectionCenter"), { status: "UNAVAILABLE" });
        const calls = ownerCalls.length;
        import_strict.default.deepEqual(await centerAction("revoke"), { status: "UNAVAILABLE" });
        import_strict.default.equal(ownerCalls.length, calls + 1);
        await until(() => statusItems[0].command === "soterai.openControlPanel", "Single status item did not restore the legacy action.");
        import_strict.default.equal(policyDigest(context), before);
        import_strict.default.deepEqual(context.workspaceState.get(PROFILE_RECEIPT), receipt);
        await updateFlag(FLAG, true);
        await refresh();
        (0, import_strict.default)(await nativeDecoration(ordinary));
        await import_promises.default.writeFile(custody, JSON.stringify({
          policySha256: before,
          runtimeSha256: runtime,
          policyWritesAtPrimary: policyWrites,
          activityCount: context.globalState.get(ACTIVITY, []).length,
          terminalReceiptAbsent: receipt === void 0,
          terminalSetting: terminalSetting() ?? null,
          flagOn: true,
          reportRestored: !evidencePrepared,
          syntheticOnly: true
        }) + "\n", { flag: "wx" });
      });
    } else {
      const saved = JSON.parse(await import_promises.default.readFile(custody, "utf8"));
      await check(async () => {
        import_strict.default.equal(runtime, saved.runtimeSha256);
        import_strict.default.equal(policyDigest(context), saved.policySha256);
        import_strict.default.equal(policyWrites, 0);
        import_strict.default.equal(context.workspaceState.get(PROFILE_RECEIPT), void 0);
      });
      await check(async () => {
        import_strict.default.deepEqual([...views.keys()], VIEW_IDS);
        await refresh();
        (0, import_strict.default)(JSON.stringify(await children(VIEW_IDS[0])).includes("f29-public-restricted.txt"));
        (0, import_strict.default)(await nativeDecoration(ordinary));
        (0, import_strict.default)(await nativeDecoration(sensitive));
      });
      await check(async () => {
        (0, import_strict.default)(context.globalState.get(ACTIVITY, []).length >= saved.activityCount);
        await refresh();
        const activity = await children(VIEW_IDS[1]);
        valueFree(activity);
        (0, import_strict.default)(activity.some((row) => row.label.includes("protected_access:")));
        await noLivePass();
      });
      await check(async () => {
        const before = policyDigest(context), calls = ownerCalls.length;
        holdRead = true;
        heldRead = void 0;
        const pending = vscode.commands.executeCommand("soterai.readProjectFileSafely", activityFile);
        try {
          await until(() => heldRead !== void 0, "Actual original managed read did not reach native review.");
          import_strict.default.deepEqual(await invokeItem(VIEW_IDS[0], "revoke"), { status: "REVOKED" });
          const result = await bounded(pending, "Actual original pending managed read did not resolve after revoke.");
          import_strict.default.notEqual(result.status, "ALLOWED_ONCE");
          import_strict.default.equal(result.text, void 0);
          releaseHeldRead("Allow safe read once");
          assertOwner("soterai.revokeProjectReads", calls, "REVOKED");
          import_strict.default.equal(policyDigest(context), before);
        } finally {
          holdRead = false;
          releaseHeldRead(void 0);
          await bounded(pending, "Native held read did not drain.");
        }
      });
      await check(async () => {
        const before = policyDigest(context), receipt = context.workspaceState.get(PROFILE_RECEIPT);
        await updateFlag(FLAG, false);
        await refresh();
        import_strict.default.equal(contextKeys.get("soterai.protectionCenter"), false);
        import_strict.default.equal(await nativeDecoration(ordinary), void 0);
        for (const id of VIEW_IDS) (0, import_strict.default)((await children(id)).every((row) => row.label.includes("Protection Center disabled")));
        approveSentinelDisable = true;
        try {
          await vscode.commands.executeCommand("soterai.disableAISentinel");
        } finally {
          approveSentinelDisable = false;
        }
        import_strict.default.equal(context.globalState.get("soterai.sentinel.enabledState"), false);
        import_strict.default.equal(policyDigest(context), before);
        import_strict.default.deepEqual(context.workspaceState.get(PROFILE_RECEIPT), receipt);
        await until(() => statusItems[0].command === "soterai.openControlPanel", "Legacy status action unavailable after final withdrawal.");
        valueFree(notices);
      });
    }
  } catch (error) {
    driverFailure = error instanceof Error ? error.name : "UnknownFailure";
  } finally {
    workspaceMode = "normal";
    installedReadFailure = false;
    policyReadFailure = false;
    holdRead = false;
    releaseHeldRead(void 0);
    try {
      await restoreReports();
      import_strict.default.equal(sha(await import_promises.default.readFile(bundle)), runtime);
    } catch (error) {
      cleanupFailure = error instanceof Error ? error.name : "UnknownCleanupFailure";
      driverFailure ??= "NativeCleanupFailure";
    }
    for (const panel of panels) try {
      panel.dispose();
    } catch {
    }
    for (const item of nativeDisposables) item.dispose();
    for (const restore of restores.reverse()) restore();
  }
  await import_promises.default.writeFile(output, JSON.stringify({
    phase,
    extensionBundleSha256: runtime,
    observations: rows,
    passed: rows.filter((row) => row.status === "PASS").length,
    failed: rows.filter((row) => row.status === "FAIL").length,
    notRun: rows.filter((row) => row.status === "NOT_RUN").length,
    driverFailure,
    cleanupFailure,
    diagnostics: setupDiagnostic(),
    nativeOwnerCalls: ownerCalls,
    protectedContentReadObservations: readObservations,
    observedProjectSettingChanges: settingChanges,
    retainedSyntheticReportInputs: evidenceMutations,
    readModalCount,
    rendererGate: rendererGate ?? { status: "NOT_RUN_SEPARATE_RENDERER_GATE_UNBOUND" },
    independence: "LOW_SCRIPTED_ACTUAL_INSTALLED_NATIVE_APIS_NOT_HUMAN",
    keyboard: "ACTUAL_VIEW_FOCUS_LIST_NAVIGATION_AND_TREEITEM_COMMAND_APIS; PHYSICAL_KEYS_AND_RENDERER_FOCUS_NOT_OBSERVED",
    workspaceStates: "UNTRUSTED_AND_EMPTY_ARE_EXPLICIT_INJECTED_NATIVE_API_FACTS_NOT_REAL_TRUST_OR_WORKSPACE_TRANSITIONS",
    reports: "SYNTHETIC_INSTALLED_COPY_INPUTS_WITH_ZERO_PASSING_SUITES; NOT_SHIPPED_OR_ACCEPTED_COVERAGE_EVIDENCE",
    exclusions: ["Human screen reader/usability", "Different-vendor independence", "Real agent behavior", "Physical keyboard/renderer automation", "Real workspace trust UI transition", "OS isolation and unmanaged native reads", "Actual vendor setup beyond the isolated project-terminal owner", "F26a/native06 remains explicitly deferred"]
  }, null, 2) + "\n", { flag: "wx" });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
