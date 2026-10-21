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

// packages/vscode-extension/src/__tests__/host/liteSourceScanner.host.ts
var liteSourceScanner_host_exports = {};
__export(liteSourceScanner_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(liteSourceScanner_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var VALUE = "TEST_ONLY_F22A_NATIVE_PRIVATE_75ec31b4";
var SOURCE = 'const apiKey: string = "first\\n' + VALUE + '\\u0021"; const PORT=3000;\n';
var KEY = "soterai.hygiene.hmacKey.v1";
var STATE = "soterai.lite.hygiene.exposure.v1";
var FLAG = "lite.configScanner.source";
var restores = [];
var listeners = [];
var displayed = [];
var reviews = [];
var selected;
var approve = true;
var cancelFile = false;
var drift = false;
var hold = false;
var entered = false;
var finish;
var sourceCalls = 0;
var sourceEvents = 0;
var stores = 0;
var metadataDocuments = 0;
var started = performance.now();
var trace = [];
var note = (event) => trace.push({ event, milliseconds: performance.now() - started });
var sha = (v) => (0, import_node_crypto.createHash)("sha256").update(v).digest("hex");
var noValues = (v) => {
  const text = JSON.stringify(v) ?? "";
  for (const value of [VALUE, "apiKey", "first\\n", "first\n"]) (0, import_strict.default)(!text.includes(value), "Private source entered metadata");
};
var source = () => vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, "config.ts");
var isSource = (v) => v instanceof vscode.Uri && ["config.ts", "public.tsx", "unsupported.py"].some((n) => v.toString() === vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, n).toString());
function patch(object, name, value) {
  const prior = Object.getOwnPropertyDescriptor(object, name);
  Object.defineProperty(object, name, { configurable: true, writable: true, value });
  restores.push(() => prior ? Object.defineProperty(object, name, prior) : Reflect.deleteProperty(object, name));
}
function setupDiagnostic() {
  return { syntheticOnly: true, sourceCalls, sourceEvents, stores, reviews: reviews.length };
}
function beforeActivate(context) {
  import_strict.default.match((0, import_node_path.resolve)(process.env.USERPROFILE ?? ""), /^D:\\SoterAI-Lite-test-profiles\\/i);
  import_strict.default.match((0, import_node_path.resolve)(vscode.workspace.workspaceFolders[0].uri.fsPath), /^D:\\SoterAI-Lite-test-profiles\\/i);
  selected = source();
  listeners.push(vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("soterai")) note("configuration-event");
  }), context.secrets.onDidChange((e) => {
    if (e.key === KEY) note("hygiene-key-event");
    if (e.key === "soterai.vaultKey") note("vault-key-event");
  }));
  const store = context.secrets.store;
  patch(context.secrets, "store", async (key, value) => {
    if (key === KEY || key === "soterai.vaultKey") {
      stores++;
      import_strict.default.equal(Buffer.from(value, "base64").length, 32);
    }
    return store.call(context.secrets, key, value);
  });
  const open = vscode.workspace.openTextDocument;
  patch(vscode.workspace, "openTextDocument", (...args) => {
    if (isSource(args[0])) sourceCalls++;
    const input = args[0];
    if (input?.content) {
      noValues(input.content);
      metadataDocuments++;
    }
    return Reflect.apply(open, vscode.workspace, args);
  });
  listeners.push(vscode.workspace.onDidOpenTextDocument((d) => {
    if (isSource(d.uri)) sourceEvents++;
  }));
  const show = vscode.window.showTextDocument;
  patch(vscode.window, "showTextDocument", async (...args) => {
    const d = args[0];
    noValues(d.getText());
    displayed.push(d);
    return Reflect.apply(show, vscode.window, args);
  });
  patch(vscode.window, "showOpenDialog", async () => cancelFile ? void 0 : selected ? [selected] : void 0);
  patch(vscode.window, "showQuickPick", async (items) => items[0]);
  patch(vscode.window, "showWarningMessage", async (message, options, ...items) => {
    noValues([message, options]);
    const action = items.find((i) => ["Analyze saved project files", "Migrate securely", "Restore raw values", "Create metadata export"].includes(i));
    if (!action) return void 0;
    import_strict.default.equal(options.modal, true);
    reviews.push({ action, safe: true });
    if (drift && action === "Analyze saved project files") {
      drift = false;
      await (0, import_promises.writeFile)(source().fsPath, "const PORT=4000;\n");
    }
    if (hold && action === "Analyze saved project files") {
      entered = true;
      return new Promise((r) => finish = r);
    }
    return approve ? action : void 0;
  });
  for (const name of ["showInformationMessage", "showErrorMessage"]) patch(vscode.window, name, async (value) => {
    noValues(value);
    return void 0;
  });
}
async function run(context) {
  const phase = process.env.SOTERAI_LITE_F17_PHASE, output = process.env.SOTERAI_LITE_F17_EVIDENCE, config = vscode.workspace.getConfiguration("soterai"), oldFlag = config.inspect(FLAG)?.globalValue;
  const runtime = sha(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js")));
  import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath, receipt = (0, import_node_path.join)((0, import_node_path.dirname)(root), "source-restart.json"), observations = [];
  const check = async (scope, work) => {
    const row = { id: "F22A-N" + String(observations.length + 1).padStart(2, "0"), scope, status: "NOT_RUN", errorName: void 0 };
    observations.push(row);
    try {
      await work();
      row.status = "PASS";
    } catch (e) {
      row.status = "FAIL";
      row.errorName = e instanceof Error ? e.name : "UnknownFailure";
    }
  };
  const call = async (name, ...args) => {
    note("command-start-" + name);
    const result2 = await vscode.commands.executeCommand("soterai." + name, ...args);
    noValues(result2);
    trace.push({ event: "command-end-" + name, milliseconds: performance.now() - started, status: typeof result2?.status === "string" && /^[A-Z_]{1,80}$/.test(result2.status) ? result2.status : "UNEXPECTED", files: Number.isSafeInteger(result2?.files) ? result2.files : void 0, findings: Array.isArray(result2?.findings) ? result2.findings.length : void 0 });
    return result2;
  };
  const clean = () => {
    import_strict.default.equal(sourceCalls, 0);
    import_strict.default.equal(sourceEvents, 0);
    (0, import_strict.default)(!vscode.workspace.textDocuments.some((d) => isSource(d.uri)));
    noValues(context.globalState.get(STATE));
  };
  let driverFailure;
  try {
    if (phase === "primary") {
      await (0, import_promises.writeFile)(source().fsPath, SOURCE, { flag: "wx" });
      await (0, import_promises.writeFile)((0, import_node_path.join)(root, "public.tsx"), 'const View=()=> <div title="public" />;\n', { flag: "wx" });
      await (0, import_promises.writeFile)((0, import_node_path.join)(root, "unsupported.py"), "PORT=3000\n", { flag: "wx" });
      await check("Exact runtime, source registration and no startup read/key", async () => {
        import_strict.default.equal(await context.secrets.get(KEY), void 0);
        import_strict.default.equal((await call("sourceSecretScannerStatus")).status, "OWNER_REVIEW_REQUIRED");
        const commands2 = await vscode.commands.getCommands(true);
        for (const name of ["reviewWorkspaceSourceSecrets", "reviewSourceSecrets", "reviewSourceSecretVault", "restoreSourceSecretVault", "sourceSecretScannerStatus"]) (0, import_strict.default)(commands2.includes("soterai." + name));
        clean();
      });
      await check("File picker cancellation ignores caller file and approval", async () => {
        cancelFile = true;
        import_strict.default.equal((await call("reviewSourceSecrets", { approved: true, uri: "foreign.ts" })).status, "CANCELLED");
        cancelFile = false;
        import_strict.default.equal(await context.secrets.get(KEY), void 0);
        clean();
      });
      await check("Native content-review cancellation precedes key and originals", async () => {
        approve = false;
        import_strict.default.equal((await call("reviewSourceSecrets")).status, "CANCELLED");
        approve = true;
        import_strict.default.equal(await context.secrets.get(KEY), void 0);
        clean();
      });
      await check("Selected escaped TypeScript source and metadata-only report", async () => {
        const result2 = await call("reviewSourceSecrets", vscode.Uri.file("C:\\foreign.ts"), { approved: true });
        import_strict.default.equal(result2.status, "ANALYZED");
        import_strict.default.equal(result2.findings.length, 1);
        import_strict.default.equal(Buffer.from(await context.secrets.get(KEY), "base64").length, 32);
        clean();
      });
      await check("Source-specific workspace discovery with public JSX control", async () => {
        const result2 = await call("reviewWorkspaceSourceSecrets");
        import_strict.default.equal(result2.status, "ANALYZED");
        import_strict.default.equal(result2.files, 2);
        import_strict.default.equal(result2.findings.length, 1);
        clean();
      });
      await check("Shared possible-exposure ledger has keyed references only", async () => {
        const view = await call("openHygieneExposureLedger");
        import_strict.default.equal(view.rows.length, 1);
        import_strict.default.equal(view.rows[0].lastAction, "possible-project-exposure");
        import_strict.default.match(view.rows[0].fileRef, /^[a-f0-9]{64}$/);
        (0, import_strict.default)(!JSON.stringify(view).includes(root));
        clean();
      });
      await check("Unsupported language remains explicitly unsupported", async () => {
        selected = vscode.Uri.file((0, import_node_path.join)(root, "unsupported.py"));
        import_strict.default.equal((await call("reviewSourceSecrets")).status, "UNSUPPORTED_SOURCE");
        selected = source();
        clean();
      });
      await check("Malformed source withholds rather than reporting a clean scan", async () => {
        const prior = JSON.stringify(context.globalState.get(STATE));
        await (0, import_promises.writeFile)(source().fsPath, SOURCE + "const =");
        import_strict.default.equal((await call("reviewSourceSecrets")).status, "UNAVAILABLE");
        import_strict.default.equal(JSON.stringify(context.globalState.get(STATE)), prior);
        await (0, import_promises.writeFile)(source().fsPath, SOURCE);
        import_strict.default.equal((await call("reviewSourceSecrets")).status, "ANALYZED");
        clean();
      });
      await check("Native vault cancellation preserves exact original source", async () => {
        approve = false;
        import_strict.default.equal((await call("reviewSourceSecretVault", { approved: true })).status, "CANCELLED");
        approve = true;
        import_strict.default.equal(await (0, import_promises.readFile)(source().fsPath, "utf8"), SOURCE);
      });
      await check("Reviewed canonical vault replaces literals with no env-file output", async () => {
        import_strict.default.equal((await call("reviewSourceSecretVault")).status, "APPLIED");
        const masked = await (0, import_promises.readFile)(source().fsPath, "utf8");
        (0, import_strict.default)(!masked.includes(VALUE));
        import_strict.default.match(masked, /const apiKey: string = "\[SOTERAI_PROTECTED_/);
        await import_strict.default.rejects((0, import_promises.readFile)((0, import_node_path.join)(root, ".env.example")), { code: "ENOENT" });
        import_strict.default.equal(Buffer.from(await context.secrets.get("soterai.vaultKey"), "base64").length, 32);
        clean();
      });
      await check("Vault action records only possible-exposure metadata", async () => {
        import_strict.default.equal((await call("openHygieneExposureLedger")).rows[0].lastAction, "vaulted");
      });
      await check("Disclosure cancellation keeps source masked", async () => {
        approve = false;
        import_strict.default.equal((await call("restoreSourceSecretVault", { approved: true })).status, "CANCELLED");
        approve = true;
        (0, import_strict.default)(!(await (0, import_promises.readFile)(source().fsPath, "utf8")).includes(VALUE));
      });
      await check("Explicit disclosure restores exact escapes and retains saved deny", async () => {
        import_strict.default.equal((await call("restoreSourceSecretVault")).status, "RESTORED");
        import_strict.default.equal(await (0, import_promises.readFile)(source().fsPath, "utf8"), SOURCE);
        (0, import_strict.default)(JSON.stringify(context.workspaceState.get("soterai.aiForbidden.v1")).includes('"sensitive":true'));
        clean();
      });
      await check("Source drift invalidates pending native consent", async () => {
        drift = true;
        import_strict.default.equal((await call("reviewSourceSecrets")).status, "CHANGED");
        await (0, import_promises.writeFile)(source().fsPath, SOURCE);
      });
      await check("Metadata export cancellation creates no file", async () => {
        approve = false;
        import_strict.default.equal((await call("exportHygieneExposureLedger")).status, "CANCELLED");
        approve = true;
        import_strict.default.equal((await (0, import_promises.readdir)((0, import_node_path.join)(context.globalStorageUri.fsPath, "hygiene-exports")).catch(() => [])).length, 0);
      });
      await check("Reviewed source exposure export contains no values or source names", async () => {
        import_strict.default.equal((await call("exportHygieneExposureLedger")).status, "EXPORTED");
        const directory = (0, import_node_path.join)(context.globalStorageUri.fsPath, "hygiene-exports"), names = await (0, import_promises.readdir)(directory);
        import_strict.default.equal(names.length, 1);
        const text = await (0, import_promises.readFile)((0, import_node_path.join)(directory, names[0]), "utf8");
        noValues(text);
        (0, import_strict.default)(!text.includes(root));
        clean();
      });
      await check("Source flag withdrawal invalidates pending content review", async () => {
        hold = true;
        entered = false;
        const pending = call("reviewSourceSecrets");
        const end = Date.now() + 5e3;
        while (!entered && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
        (0, import_strict.default)(entered);
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        finish?.("Analyze saved project files");
        import_strict.default.notEqual((await pending).status, "ANALYZED");
        hold = false;
        import_strict.default.equal(await (0, import_promises.readFile)(source().fsPath, "utf8"), SOURCE);
      });
      await check("Disabled source route preserves records; reenable and retain restart basis", async () => {
        const before = JSON.stringify(context.globalState.get(STATE));
        import_strict.default.equal((await call("reviewSourceSecrets", { approved: true })).status, "UNAVAILABLE");
        import_strict.default.equal(JSON.stringify(context.globalState.get(STATE)), before);
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        import_strict.default.equal((await call("sourceSecretScannerStatus")).status, "OWNER_REVIEW_REQUIRED");
        clean();
        (0, import_strict.default)(stores >= 2);
        await (0, import_promises.writeFile)(receipt, JSON.stringify({ ledger: context.globalState.get(STATE), sourceSha256: sha(Buffer.from(SOURCE)) }) + "\n", { flag: "wx" });
      });
    } else {
      const prior = JSON.parse(await (0, import_promises.readFile)(receipt, "utf8"));
      await check("Restart reuses profile key/ledger with no startup source read", async () => {
        import_strict.default.equal(stores, 0);
        import_strict.default.equal((await call("sourceSecretScannerStatus")).status, "OWNER_REVIEW_REQUIRED");
        import_strict.default.deepEqual(context.globalState.get(STATE), prior.ledger);
        clean();
      });
      await check("Restart source ledger and exact saved original match prior receipt", async () => {
        const view = await call("openHygieneExposureLedger");
        import_strict.default.equal(view.rows.length, 1);
        import_strict.default.equal(view.rows[0].lastAction, "restored-after-owner-disclosure");
        import_strict.default.equal(sha(await (0, import_promises.readFile)(source().fsPath)), prior.sourceSha256);
        clean();
      });
      await check("Stale source finding authority never survives restart", async () => {
        import_strict.default.equal((await call("reviewSourceSecretVault", { approved: true })).status, "REVIEW_FILES_FIRST");
        import_strict.default.equal(stores, 0);
        clean();
      });
    }
  } catch {
    driverFailure = "NativeSourceDriverFailure";
  } finally {
    try {
      finish?.(void 0);
      await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global);
      clean();
      for (const d of new Set(displayed)) if (!d.isClosed && d.isUntitled) {
        await vscode.window.showTextDocument(d);
        await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
      }
    } catch {
      driverFailure = "NativeSourceWithdrawalUnconfirmed";
    }
    listeners.forEach((d) => d.dispose());
    for (const restore of restores.reverse()) restore();
  }
  const result = { schemaVersion: 1, phase, syntheticOnly: true, hostVersion: vscode.version, extensionBundleSha256: runtime, currentDeveloperBundleSha256: sha(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js"))), hostProbeSha256: sha(await (0, import_promises.readFile)(__filename)), observations, passed: observations.filter((r) => r.status === "PASS").length, failed: observations.filter((r) => r.status === "FAIL").length, notRun: observations.filter((r) => r.status === "NOT_RUN").length, sourceDocumentCalls: sourceCalls, sourceDocumentEvents: sourceEvents, secretStorageStores: stores, reviews, metadataDocuments, trace, driverFailure, independence: "LOW", ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW", notTested: ["Other languages, dynamic assembly and unsupported proposals", "Human usability/accessibility", "Live credentials or provider rotation", "OS custody or unmanaged native reads/uploads"] };
  noValues(result);
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || driverFailure) throw Error("Native source scanner incomplete");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
