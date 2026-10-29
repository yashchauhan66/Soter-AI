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

// packages/vscode-extension/src/__tests__/host/liteHygiene.host.ts
var liteHygiene_host_exports = {};
__export(liteHygiene_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(liteHygiene_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var VALUE = "TEST_ONLY_F21_NATIVE_PRIVATE_91e753d4";
var SOURCE = "API_KEY=" + VALUE + "\nPORT=3000\n";
var KEY = "soterai.hygiene.hmacKey.v1";
var STATE = "soterai.lite.hygiene.exposure.v1";
var restores = [];
var listeners = [];
var selected;
var approve = true;
var cancelFile = false;
var drift = false;
var hold = false;
var finish;
var entered = false;
var sourceCalls = 0;
var sourceEvents = 0;
var stores = 0;
var reviews = [];
var documents = [];
var displayed = [];
var trace = [];
var started = performance.now();
var note = (event) => trace.push({ event, milliseconds: performance.now() - started });
var sha = (v) => (0, import_node_crypto.createHash)("sha256").update(v).digest("hex");
var noValues = (v) => {
  (0, import_strict.default)(!(JSON.stringify(v) ?? "").includes(VALUE), "Private original entered metadata");
};
var source = () => vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, ".env.hygiene");
var isSource = (v) => v instanceof vscode.Uri && v.toString() === source().toString();
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
  listeners.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("soterai")) note("soterai-configuration-event");
    }),
    context.secrets.onDidChange((e) => {
      if (e.key === KEY) note("hygiene-key-event");
      if (e.key === "soterai.vaultKey") note("vault-key-event");
    })
  );
  const get = context.secrets.get, store = context.secrets.store;
  patch(context.secrets, "get", async (key) => {
    const v = await get.call(context.secrets, key);
    if ((key === KEY || key === "soterai.vaultKey") && v !== void 0) import_strict.default.equal(Buffer.from(v, "base64").length, 32);
    return v;
  });
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
      documents.push(input.content);
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
    const action = items.find((i) => ["Analyze saved project files", "Migrate securely", "Restore raw values", "Write empty example values", "Create metadata export"].includes(i));
    if (!action) return void 0;
    import_strict.default.equal(options.modal, true);
    reviews.push({ action, safe: true });
    if (drift && action === "Analyze saved project files") {
      drift = false;
      await (0, import_promises.writeFile)(source().fsPath, "PORT=4000\n");
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
  const phase = process.env.SOTERAI_LITE_F17_PHASE, output = process.env.SOTERAI_LITE_F17_EVIDENCE, config = vscode.workspace.getConfiguration("soterai"), oldFlag = config.inspect("lite.hygieneAssistant")?.globalValue;
  const runtime = sha(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js")));
  import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath, receipt = (0, import_node_path.join)((0, import_node_path.dirname)(root), "hygiene-restart.json"), observations = [];
  const check = async (scope, work) => {
    const row = { id: "F21-N" + String(observations.length + 1).padStart(2, "0"), scope, status: "NOT_RUN", errorName: void 0 };
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
      await (0, import_promises.writeFile)((0, import_node_path.join)(root, "public.txt"), "PORT=3000\n", { flag: "wx" });
      await check("Exact runtime, registration and no startup scan/key", async () => {
        import_strict.default.equal(await context.secrets.get(KEY), void 0);
        import_strict.default.equal((await call("hygieneStatus")).status, "OWNER_REVIEW_REQUIRED");
        const commands2 = await vscode.commands.getCommands(true);
        for (const name of ["reviewWorkspaceHygiene", "reviewSelectedFileHygiene", "reviewHygieneVault", "generateHygieneEnvExample", "restoreHygieneVault", "openHygieneExposureLedger", "exportHygieneExposureLedger", "openHygieneRotationChecklist", "hygieneStatus"]) (0, import_strict.default)(commands2.includes("soterai." + name));
        clean();
      });
      await check("File picker cancellation before originals/key", async () => {
        cancelFile = true;
        import_strict.default.equal((await call("reviewSelectedFileHygiene", { approved: true, path: "foreign.env" })).status, "CANCELLED");
        cancelFile = false;
        import_strict.default.equal(await context.secrets.get(KEY), void 0);
        clean();
      });
      await check("Actual selected saved file, safe metadata and real profile key", async () => {
        const result2 = await call("reviewSelectedFileHygiene", vscode.Uri.file("C:\\foreign.env"), { approved: true });
        import_strict.default.equal(result2.status, "ANALYZED");
        import_strict.default.equal(result2.findings.length, 1);
        import_strict.default.equal(Buffer.from(await context.secrets.get(KEY), "base64").length, 32);
        clean();
      });
      await check("Workspace public control and bounded metadata report", async () => {
        const result2 = await call("reviewWorkspaceHygiene");
        import_strict.default.equal(result2.status, "ANALYZED");
        (0, import_strict.default)(result2.files >= 2);
        import_strict.default.equal(result2.findings.length, 1);
        clean();
      });
      await check("Possible-exposure ledger has keyed refs without source/value/name", async () => {
        const result2 = await call("openHygieneExposureLedger");
        import_strict.default.equal(result2.rows.length, 1);
        import_strict.default.match(result2.rows[0].fileRef, /^[a-f0-9]{64}$/);
        import_strict.default.equal(result2.rows[0].lastAction, "possible-project-exposure");
        (0, import_strict.default)(!JSON.stringify(result2).includes(root));
        (0, import_strict.default)(!JSON.stringify(result2).includes("API_KEY"));
        clean();
      });
      await check("Canonical empty example keeps original source", async () => {
        import_strict.default.equal((await call("generateHygieneEnvExample")).status, "APPLIED");
        import_strict.default.equal(await (0, import_promises.readFile)((0, import_node_path.join)(root, ".env.example"), "utf8"), "API_KEY=\nPORT=\n");
        import_strict.default.equal(await (0, import_promises.readFile)(source().fsPath, "utf8"), SOURCE);
      });
      await check("Vault cancellation preserves source", async () => {
        approve = false;
        import_strict.default.equal((await call("reviewHygieneVault", { approved: true })).status, "CANCELLED");
        approve = true;
        import_strict.default.equal(await (0, import_promises.readFile)(source().fsPath, "utf8"), SOURCE);
      });
      await check("Approved canonical migration, placeholders and real SecretStorage", async () => {
        import_strict.default.equal((await call("reviewHygieneVault")).status, "APPLIED");
        (0, import_strict.default)(!(await (0, import_promises.readFile)(source().fsPath, "utf8")).includes(VALUE));
        import_strict.default.match(await (0, import_promises.readFile)(source().fsPath, "utf8"), /SOTERAI_PROTECTED/);
        (0, import_strict.default)(await context.secrets.get("soterai.vaultKey"));
        clean();
      });
      await check("Vault action remains possible-exposure metadata", async () => {
        import_strict.default.equal((await call("openHygieneExposureLedger")).rows[0].lastAction, "vaulted");
      });
      await check("Disclosure cancellation withholds originals", async () => {
        approve = false;
        import_strict.default.equal((await call("restoreHygieneVault")).status, "CANCELLED");
        approve = true;
        (0, import_strict.default)(!(await (0, import_promises.readFile)(source().fsPath, "utf8")).includes(VALUE));
      });
      await check("Explicit disclosure restores source and retains saved deny", async () => {
        import_strict.default.equal((await call("restoreHygieneVault")).status, "RESTORED");
        import_strict.default.equal(await (0, import_promises.readFile)(source().fsPath, "utf8"), SOURCE);
        (0, import_strict.default)(JSON.stringify(context.workspaceState.get("soterai.aiForbidden.v1")).includes('"sensitive":true'));
        clean();
      });
      await check("Source drift during approval withholds current report", async () => {
        drift = true;
        import_strict.default.equal((await call("reviewSelectedFileHygiene")).status, "CHANGED");
        await (0, import_promises.writeFile)(source().fsPath, SOURCE);
      });
      await check("Export cancellation creates no metadata file", async () => {
        approve = false;
        import_strict.default.equal((await call("exportHygieneExposureLedger")).status, "CANCELLED");
        approve = true;
        import_strict.default.equal((await (0, import_promises.readdir)((0, import_node_path.join)(context.globalStorageUri.fsPath, "hygiene-exports")).catch(() => [])).length, 0);
      });
      await check("Reviewed exclusive metadata export is value/path free", async () => {
        import_strict.default.equal((await call("exportHygieneExposureLedger")).status, "EXPORTED");
        const dir = (0, import_node_path.join)(context.globalStorageUri.fsPath, "hygiene-exports"), files = await (0, import_promises.readdir)(dir);
        import_strict.default.equal(files.length, 1);
        const text = await (0, import_promises.readFile)((0, import_node_path.join)(dir, files[0]), "utf8");
        noValues(text);
        (0, import_strict.default)(!text.includes(root));
        (0, import_strict.default)(!text.includes("API_KEY"));
      });
      await check("Native manual checklist ignores caller credentials and performs no rotation", async () => {
        const result2 = await call("openHygieneRotationChecklist", { provider: "foreign", approved: true });
        import_strict.default.equal(result2.provider, "openai");
        import_strict.default.equal(result2.status, "NOT_PERFORMED");
        import_strict.default.equal(result2.validity, "UNVERIFIED");
      });
      await check("Flag withdrawal invalidates a pending actual content review", async () => {
        hold = true;
        entered = false;
        const pending = call("reviewSelectedFileHygiene");
        const end = Date.now() + 5e3;
        while (!entered && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
        (0, import_strict.default)(entered);
        await config.update("lite.hygieneAssistant", false, vscode.ConfigurationTarget.Global);
        finish?.("Analyze saved project files");
        import_strict.default.notEqual((await pending).status, "ANALYZED");
        hold = false;
        import_strict.default.equal(await (0, import_promises.readFile)(source().fsPath, "utf8"), SOURCE);
      });
      await check("Disabled route preserves source, ledger and saved denies", async () => {
        const before = JSON.stringify(context.globalState.get(STATE));
        import_strict.default.equal((await call("reviewSelectedFileHygiene", { approved: true })).status, "UNAVAILABLE");
        import_strict.default.equal(JSON.stringify(context.globalState.get(STATE)), before);
        clean();
      });
      await check("Reenable and preserve restart binding; all original documents absent", async () => {
        await config.update("lite.hygieneAssistant", true, vscode.ConfigurationTarget.Global);
        import_strict.default.equal((await call("hygieneStatus")).status, "OWNER_REVIEW_REQUIRED");
        clean();
        (0, import_strict.default)(stores >= 2);
        await (0, import_promises.writeFile)(receipt, JSON.stringify({ ledger: context.globalState.get(STATE), sourceSha256: sha(Buffer.from(SOURCE)), documents: documents.length }) + "\n", { flag: "wx" });
      });
    } else {
      const prior = JSON.parse(await (0, import_promises.readFile)(receipt, "utf8"));
      await check("Restart reads existing ledger/key without startup original documents", async () => {
        import_strict.default.equal(stores, 0);
        import_strict.default.equal((await call("hygieneStatus")).status, "OWNER_REVIEW_REQUIRED");
        import_strict.default.deepEqual(context.globalState.get(STATE), prior.ledger);
        clean();
      });
      await check("Restart ledger export view matches accepted metadata", async () => {
        const view = await call("openHygieneExposureLedger");
        import_strict.default.equal(view.rows.length, 1);
        import_strict.default.equal(view.rows[0].lastAction, "restored-after-owner-disclosure");
        import_strict.default.equal(sha(await (0, import_promises.readFile)(source().fsPath)), prior.sourceSha256);
        clean();
      });
      await check("No stale finding authority survives restart", async () => {
        import_strict.default.equal((await call("reviewHygieneVault", { approved: true })).status, "REVIEW_FILES_FIRST");
        import_strict.default.equal(stores, 0);
        clean();
      });
    }
  } catch {
    driverFailure = "NativeHygieneDriverFailure";
  } finally {
    try {
      if (finish) finish(void 0);
      await config.update("lite.hygieneAssistant", oldFlag, vscode.ConfigurationTarget.Global);
      clean();
      for (const document of new Set(displayed)) if (!document.isClosed && document.isUntitled) {
        await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
      }
    } catch {
      driverFailure = "NativeHygieneWithdrawalUnconfirmed";
    }
    listeners.forEach((d) => d.dispose());
    for (const restore of restores.reverse()) restore();
  }
  const result = { schemaVersion: 1, phase, syntheticOnly: true, hostVersion: vscode.version, extensionBundleSha256: runtime, currentDeveloperBundleSha256: sha(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js"))), hostProbeSha256: sha(await (0, import_promises.readFile)(__filename)), observations, passed: observations.filter((r) => r.status === "PASS").length, failed: observations.filter((r) => r.status === "FAIL").length, notRun: observations.filter((r) => r.status === "NOT_RUN").length, sourceDocumentCalls: sourceCalls, sourceDocumentEvents: sourceEvents, secretStorageStores: stores, reviews, metadataDocuments: documents.length, trace, driverFailure, independence: "LOW", ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW", notTested: ["Human accessibility/usability", "Live credential validity or account rotation", "OS credential custody certification", "Same-user native reads or independent uploads"] };
  noValues(result);
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || driverFailure) throw Error("Native hygiene incomplete");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
