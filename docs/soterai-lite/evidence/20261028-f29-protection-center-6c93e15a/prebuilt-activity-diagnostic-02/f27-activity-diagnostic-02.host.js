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

// docs/soterai-lite/evidence/20261028-f29-protection-center-6c93e15a/f27-activity-diagnostic-02.host.ts
var f27_activity_diagnostic_02_host_exports = {};
__export(f27_activity_diagnostic_02_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(f27_activity_diagnostic_02_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_promises = __toESM(require("node:fs/promises"));
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = require("node:path");
var FLAG = "lite.selfHygiene";
var AUDIT = "soterai.auditLedger";
var SIGNING = "soterai.auditLedger.signingKey";
var ACTIVITY = "soterai.sentinelEvents";
var PRIVATE = "FAKE_ONLY_F27_NATIVE_PRIVATE_9e761c04";
var PAYLOAD = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nprivate_note=" + PRIVATE;
var PRIMARY = [
  "Default-off machine setting and telemetry off; no owned audit key or store writes",
  "Disabled actual programmatic audit command refuses without storing caller values",
  "Native restricted machine setting refuses repository override",
  "Explicit global opt-in itself creates no audit key or audit record",
  "Actual registered public egress command persists useful signed finite metadata",
  "Actual registered synthetic-secret egress command stores no caller text or previews",
  "Actual native storage rejection exposes a fixed audit error and preserves stored bytes",
  "Actual audit key await is invalidated by native opt-out then opt-in",
  "Actual audit queue recovers after rejected work without retaining rejected payload",
  "Actual registered audit status shows verified integrity for stored metadata",
  "Actual Sentinel command and native filesystem watcher persist finite metadata",
  "Actual Sentinel export opens a real value-free JSON document with positive events",
  "Actual Sentinel timeline renders public metadata without private paths or values",
  "Native activity storage rejection is reported incomplete without raw exception text",
  "Native opt-out stops actual Sentinel observations and export withholds old events",
  "Scripted cancel then explicit native disable stop the selected Sentinel preference",
  "Actual audit/activity state prepared for a fresh native host restart"
];
var RESTART = [
  "Fresh host retains prior audit bytes without creating another signing key",
  "Fresh actual Sentinel owner minimizes legacy synthetic stored events",
  "Fresh actual activity report exports only minimized legacy metadata",
  "Fresh actual audit status verifies the original retained signed metadata chain",
  "Explicit native flag withdrawal and activity clearing leave no active owned observation"
];
var restores = [];
var disposables = [];
var webviews = [];
var reports = [];
var notices = [];
var activityWrites = [];
var auditWrites = [];
var root = "";
var phase;
var auditKeyReads = 0;
var auditKeyStores = 0;
var activityFailures = 0;
var failAudit = false;
var failActivity = false;
var holdKey = false;
var keyEntered = false;
var releaseKey;
var approveDisable = false;
var sha = (raw) => (0, import_node_crypto.createHash)("sha256").update(raw).digest("hex");
var within = (base, file) => {
  const part = (0, import_node_path.relative)((0, import_node_path.resolve)(base), (0, import_node_path.resolve)(file));
  return part === "" || !part.startsWith("..") && !(0, import_node_path.isAbsolute)(part);
};
function valueFree(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  (0, import_strict.default)(!text.includes(PRIVATE), "Private synthetic fixture entered owned metadata.");
  (0, import_strict.default)(!text.includes("AKIAIOSFODNN7EXAMPLE"), "Synthetic credential entered owned metadata.");
  if (root) (0, import_strict.default)(!text.toLowerCase().includes(root.toLowerCase()), "Private owner path entered metadata.");
}
function patch(object, name, value) {
  const previous = Object.getOwnPropertyDescriptor(object, name);
  Object.defineProperty(object, name, { configurable: true, writable: true, value });
  restores.push(() => previous ? Object.defineProperty(object, name, previous) : Reflect.deleteProperty(object, name));
}
async function until(predicate, description) {
  const end = Date.now() + 15e3;
  while (!predicate() && Date.now() < end) await new Promise((done) => setTimeout(done, 20));
  (0, import_strict.default)(predicate(), description);
}
async function flag(value) {
  const config = vscode.workspace.getConfiguration("soterai");
  if (config.inspect(FLAG)?.globalValue === value) return;
  let acknowledge;
  const event = new Promise((done) => {
    acknowledge = done;
  });
  const listener = vscode.workspace.onDidChangeConfiguration((change) => {
    if (change.affectsConfiguration("soterai." + FLAG) && config.inspect(FLAG)?.globalValue === value) acknowledge();
  });
  let timer;
  try {
    await config.update(FLAG, value, vscode.ConfigurationTarget.Global);
    await Promise.race([event, new Promise((_done, reject) => {
      timer = setTimeout(() => reject(Error("Native flag acknowledgement unavailable.")), 15e3);
    })]);
    import_strict.default.equal(config.inspect(FLAG)?.globalValue, value);
  } finally {
    if (timer) clearTimeout(timer);
    listener.dispose();
  }
}
function setupDiagnostic() {
  return {
    status: "PREPARED_NATIVE_API_FIXTURE",
    phase,
    auditKeyReads,
    auditKeyStores,
    auditWriteCount: auditWrites.length,
    activityWriteCount: activityWrites.length,
    reports: reports.length,
    heldKey: keyEntered,
    syntheticOnly: true,
    productImports: false
  };
}
async function beforeActivate(context) {
  import_strict.default.equal(process.platform, "win32");
  import_strict.default.equal(vscode.env.remoteName, void 0);
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  for (const file of [root, context.globalStorageUri.fsPath, process.env.USERPROFILE]) import_strict.default.match((0, import_node_path.resolve)(file), /^D:\\SoterAI-Lite-test-profiles\\/i);
  (0, import_strict.default)(!within(root, context.globalStorageUri.fsPath));
  const selected = process.env.SOTERAI_LITE_F17_PHASE;
  (0, import_strict.default)(selected === "primary" || selected === "restart");
  phase = selected;
  const originalUpdate = context.globalState.update;
  patch(context.globalState, "update", async (name, value) => {
    if (name === AUDIT) {
      valueFree(value);
      if (failAudit) throw Error(PRIVATE);
    }
    if (name === ACTIVITY) {
      valueFree(value);
      if (failActivity) {
        activityFailures++;
        throw Error(PRIVATE);
      }
    }
    await originalUpdate.call(context.globalState, name, value);
    if (name === AUDIT) auditWrites.push(value);
    if (name === ACTIVITY) activityWrites.push(value);
  });
  const originalGet = context.secrets.get, originalStore = context.secrets.store;
  patch(context.secrets, "get", async (name) => {
    if (name === SIGNING) auditKeyReads++;
    const result = await originalGet.call(context.secrets, name);
    if (name === SIGNING && holdKey) {
      keyEntered = true;
      await new Promise((done) => {
        releaseKey = done;
      });
    }
    return result;
  });
  patch(context.secrets, "store", async (name, value) => {
    if (name === SIGNING) auditKeyStores++;
    return originalStore.call(context.secrets, name, value);
  });
  const open = vscode.workspace.openTextDocument;
  patch(vscode.workspace, "openTextDocument", async (...args) => {
    const document = await Reflect.apply(open, vscode.workspace, args);
    const input = args[0];
    if (input && typeof input.content === "string" && input.content.includes('"privacyMode": "metadata_only"')) {
      valueFree(document.getText());
      reports.push(document.getText());
    }
    return document;
  });
  const createPanel = vscode.window.createWebviewPanel;
  patch(vscode.window, "createWebviewPanel", (...args) => {
    const panel = Reflect.apply(createPanel, vscode.window, args);
    if (["soteraiEgressFirewall", "soteraiSentinelTimeline"].includes(String(args[0]))) webviews.push(panel);
    return panel;
  });
  const info = vscode.window.showInformationMessage;
  patch(vscode.window, "showInformationMessage", (message, ...args) => {
    if (message.startsWith("SoterAI AI Activity") || message.startsWith("AI Activity")) {
      valueFree(message);
      notices.push(message);
    }
    return Reflect.apply(info, vscode.window, [message, ...args]);
  });
  const warning = vscode.window.showWarningMessage;
  patch(vscode.window, "showWarningMessage", (message, ...args) => {
    if (message.startsWith("Disable AI Activity Sentinel monitoring?")) {
      valueFree([message, args]);
      return Promise.resolve(approveDisable ? "Confirm this change" : void 0);
    }
    if (message.startsWith("[SoterAI Sentinel]")) {
      valueFree(message);
      notices.push(message);
    }
    return Reflect.apply(warning, vscode.window, [message, ...args]);
  });
  if (phase === "primary") {
    import_strict.default.equal(context.globalState.get(AUDIT), void 0);
    import_strict.default.equal(context.globalState.get(ACTIVITY), void 0);
    import_strict.default.equal(await originalGet.call(context.secrets, SIGNING), void 0);
    await import_promises.default.mkdir((0, import_node_path.join)(root, PRIVATE), { recursive: true });
  }
  legacySeed = (value) => originalUpdate.call(context.globalState, ACTIVITY, value);
}
var legacySeed;
async function run(context) {
  const output = process.env.SOTERAI_LITE_F17_EVIDENCE;
  (0, import_strict.default)(output);
  const runtime = sha(await import_promises.default.readFile((0, import_node_path.join)(context.extensionUri.fsPath, "dist", "extension.js")));
  import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
  const scopes = phase === "primary" ? PRIMARY : RESTART;
  const rows = scopes.map((scope, index) => ({ id: `F27-${phase === "primary" ? "N" : "R"}${String(index + 1).padStart(2, "0")}`, scope, status: "NOT_RUN" }));
  let cursor = 0, driverFailure;
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
  const auditState = () => context.globalState.get(AUDIT);
  const activityState = () => context.globalState.get(ACTIVITY, []);
  const egress = (text = PAYLOAD) => vscode.commands.executeCommand("soterai.checkEgressPayload", { text });
  const activityExport = async () => {
    const count = reports.length;
    await vscode.commands.executeCommand("soterai.exportAIActivityReport");
    await until(() => reports.length > count, "Actual report document not opened.");
    return JSON.parse(reports.at(-1));
  };
  const eventFile = (0, import_node_path.join)(root, PRIVATE, ".env");
  const witnessedWrite = async (content) => {
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, PRIVATE + "/.env"));
    let finish;
    const changed = new Promise((done) => {
      finish = done;
    });
    const onChange = watcher.onDidChange(finish), onCreate = watcher.onDidCreate(finish);
    let timer;
    try {
      await import_promises.default.writeFile(eventFile, content);
      await Promise.race([changed, new Promise((_done, reject) => {
        timer = setTimeout(() => reject(Error("Independent native file-event witness unavailable.")), 15e3);
      })]);
    } finally {
      if (timer) clearTimeout(timer);
      onChange.dispose();
      onCreate.dispose();
      watcher.dispose();
    }
  };
  const writeFileEvent = async (suffix) => {
    const count = activityWrites.length;
    await witnessedWrite("PRIVATE_NOTE=" + PRIVATE + "\nPUBLIC=" + suffix + "\n");
    await until(() => activityWrites.length > count, "Actual file watcher did not persist an activity observation.");
  };
  let n14Stage = "NOT_ENTERED", traceOpened = false;
  const trace = (stage, before, report) => {
    n14Stage = stage;
    const current = JSON.stringify(activityState());
    import_node_fs.default.appendFileSync(output + ".n14-trace.jsonl", JSON.stringify({ stage, observedAt: (/* @__PURE__ */ new Date()).toISOString(), beforeSha256: sha(before), currentSha256: sha(current), currentEventCount: activityState().length, activityFailures, reportPersistence: report?.persistence, reportEventCount: report?.eventCount }) + "\n", { flag: traceOpened ? "a" : "wx" });
    traceOpened = true;
  };
  const custody = (0, import_node_path.join)((0, import_node_path.dirname)(root), "f27-native-restart-custody.json");
  try {
    if (phase === "primary") {
      await check(async () => {
        const config = vscode.workspace.getConfiguration("soterai");
        import_strict.default.equal(config.inspect(FLAG)?.defaultValue, false);
        import_strict.default.equal(config.inspect(FLAG)?.globalValue, void 0);
        import_strict.default.equal(config.get("telemetry.redactedEvents", "off"), "off");
        import_strict.default.equal(auditWrites.length, 0);
        import_strict.default.equal(auditKeyReads, 0);
        import_strict.default.equal(auditKeyStores, 0);
      });
      await check(async () => {
        await import_strict.default.rejects(Promise.resolve(egress()), (error) => {
          valueFree(error.message);
          return error.message === "Owned audit sink is disabled.";
        });
        import_strict.default.equal(auditWrites.length, 0);
        import_strict.default.equal(auditKeyReads, 0);
        import_strict.default.equal(auditKeyStores, 0);
      });
      await check(async () => {
        const config = vscode.workspace.getConfiguration("soterai");
        await import_strict.default.rejects(Promise.resolve(config.update(FLAG, true, vscode.ConfigurationTarget.Workspace)), { name: "CodeExpectedError" });
        import_strict.default.equal(config.inspect(FLAG)?.workspaceValue, void 0);
      });
      await check(async () => {
        await flag(true);
        import_strict.default.equal(auditWrites.length, 0);
        import_strict.default.equal(auditKeyStores, 0);
      });
      await check(async () => {
        const result = await egress("Public documentation example only.");
        import_strict.default.equal(result.decision, "ALLOW");
        import_strict.default.equal(auditKeyStores, 1);
        import_strict.default.equal(auditState().entries.length, 1);
        const entry = auditState().entries[0];
        import_strict.default.equal(entry.eventType, "egress.programmatic");
        import_strict.default.equal(entry.decision, "ALLOW");
        import_strict.default.match(entry.signature, /^[a-f0-9]{64}$/);
        valueFree(auditState());
      });
      await check(async () => {
        const result = await egress();
        import_strict.default.notEqual(result.decision, "ALLOW");
        import_strict.default.equal(auditState().entries.length, 2);
        import_strict.default.equal(auditState().entries[1].redactedEvidence, "");
        valueFree(auditState());
      });
      await check(async () => {
        const before = JSON.stringify(auditState()), count = auditWrites.length;
        failAudit = true;
        try {
          await import_strict.default.rejects(Promise.resolve(egress()), (error) => {
            valueFree(error.message);
            return error.message === "Owned audit operation unavailable.";
          });
        } finally {
          failAudit = false;
        }
        import_strict.default.equal(JSON.stringify(auditState()), before);
        import_strict.default.equal(auditWrites.length, count);
      });
      await check(async () => {
        const before = JSON.stringify(auditState()), count = auditWrites.length;
        holdKey = true;
        keyEntered = false;
        const pending = Promise.resolve(egress()).then(() => ({ rejected: false }), (error) => ({ rejected: true, error }));
        try {
          await until(() => keyEntered, "Native signing-key await not reached.");
          await flag(false);
          await flag(true);
        } finally {
          holdKey = false;
          releaseKey?.();
        }
        const result = await pending;
        import_strict.default.equal(result.rejected, true);
        valueFree(result.error?.message);
        import_strict.default.equal(JSON.stringify(auditState()), before);
        import_strict.default.equal(auditWrites.length, count);
      });
      await check(async () => {
        const before = auditState().entries.length;
        await egress("Public after failure.");
        import_strict.default.equal(auditState().entries.length, before + 1);
        valueFree(auditWrites);
      });
      await check(async () => {
        const before = webviews.length;
        await vscode.commands.executeCommand("soterai.showEgressFirewallStatus");
        import_strict.default.equal(webviews.length, before + 1);
        const html = webviews.at(-1).webview.html;
        valueFree(html);
        (0, import_strict.default)(html.includes("VERIFIED"));
      });
      await check(async () => {
        await vscode.commands.executeCommand("soterai.enableAISentinel");
        import_strict.default.equal(context.globalState.get("soterai.sentinel.enabledState"), true);
        await writeFileEvent("first");
        (0, import_strict.default)(activityState().some((event) => event.type === "protected_access"));
        valueFree(activityState());
        (0, import_strict.default)(activityState().every((event) => event.source === "sentinel" && event.filePath === void 0 && event.redactedEvidence === "Observed activity metadata only."));
      });
      await check(async () => {
        const report = await activityExport();
        import_strict.default.equal(report.privacyMode, "metadata_only");
        (0, import_strict.default)(report.eventCount > 0);
        valueFree(report);
      });
      await check(async () => {
        const before = webviews.length;
        await vscode.commands.executeCommand("soterai.showAITimeline");
        import_strict.default.equal(webviews.length, before + 1);
        const html = webviews.at(-1).webview.html;
        valueFree(html);
        (0, import_strict.default)(html.includes("Observed activity metadata only."));
      });
      await check(async () => {
        const before = JSON.stringify(activityState()), failures = activityFailures;
        failActivity = true;
        trace("before-rejected-write", before);
        await witnessedWrite("PRIVATE_NOTE=" + PRIVATE + "\nPUBLIC=failed-write\n");
        await until(() => activityFailures > failures, "Actual owner did not attempt the scripted native storage rejection.");
        trace("before-state-equality", before);
        import_strict.default.equal(JSON.stringify(activityState()), before);
        const report = await activityExport();
        trace("before-persistence-equality", before, report);
        import_strict.default.equal(report.persistence, "INCOMPLETE");
        valueFree(report);
        valueFree(notices);
      });
      await check(async () => {
        await flag(false);
        failActivity = false;
        const count = activityWrites.length;
        await witnessedWrite("PRIVATE_NOTE=" + PRIVATE + "\nPUBLIC=withdrawn\n");
        const report = await activityExport();
        import_strict.default.equal(report.eventCount, 0);
        import_strict.default.equal(activityWrites.length, count);
        await import_strict.default.rejects(Promise.resolve(egress()), (error) => {
          valueFree(error.message);
          return error.message === "Owned audit sink is disabled.";
        });
      });
      await check(async () => {
        await flag(true);
        approveDisable = false;
        await vscode.commands.executeCommand("soterai.disableAISentinel");
        import_strict.default.equal(context.globalState.get("soterai.sentinel.enabledState"), true);
        approveDisable = true;
        await vscode.commands.executeCommand("soterai.disableAISentinel");
        import_strict.default.equal(context.globalState.get("soterai.sentinel.enabledState"), false);
        approveDisable = false;
      });
      await check(async () => {
        valueFree(auditState());
        await legacySeed([{
          id: PRIVATE,
          timestamp: Date.now(),
          type: "protected_access",
          risk: "high",
          source: PRIVATE,
          filePath: PRIVATE,
          decision: "monitor",
          redactedEvidence: PRIVATE
        }]);
        await import_promises.default.writeFile(custody, JSON.stringify({
          auditSha256: sha(JSON.stringify(auditState())),
          entries: auditState().entries.length,
          primaryRuntimeSha256: runtime,
          seededLegacyEvents: 1,
          flagOn: true,
          sentinelPreferenceEnabled: false
        }) + "\n", { flag: "wx" });
      });
    } else {
      const saved = JSON.parse(await import_promises.default.readFile(custody, "utf8"));
      await check(async () => {
        import_strict.default.equal(runtime, saved.primaryRuntimeSha256);
        import_strict.default.equal(sha(JSON.stringify(auditState())), saved.auditSha256);
        import_strict.default.equal(auditKeyStores, 0);
        import_strict.default.equal(auditWrites.length, 0);
      });
      await check(async () => {
        import_strict.default.equal(activityState().length, 1);
        valueFree(activityState());
        import_strict.default.equal(activityState()[0].source, "sentinel");
        import_strict.default.equal(activityState()[0].filePath, void 0);
        (0, import_strict.default)(activityWrites.length >= 1);
      });
      await check(async () => {
        const report = await activityExport();
        import_strict.default.equal(report.eventCount, 1);
        valueFree(report);
      });
      await check(async () => {
        const before = webviews.length;
        await vscode.commands.executeCommand("soterai.showEgressFirewallStatus");
        import_strict.default.equal(webviews.length, before + 1);
        const html = webviews.at(-1).webview.html;
        valueFree(html);
        (0, import_strict.default)(html.includes("VERIFIED"));
        import_strict.default.equal(auditKeyStores, 0);
      });
      await check(async () => {
        await flag(false);
        import_strict.default.equal((await activityExport()).eventCount, 0);
        const before = activityWrites.length;
        await vscode.commands.executeCommand("soterai.clearAIActivityEvents");
        await until(() => activityState().length === 0 && activityWrites.length > before, "Actual owned activity clear API completion not observed.");
        import_strict.default.equal(context.globalState.get("soterai.sentinel.enabledState"), false);
        valueFree(auditState());
        valueFree(activityState());
        valueFree(notices);
        import_strict.default.equal(sha(JSON.stringify(auditState())), saved.auditSha256);
      });
    }
  } catch (error) {
    driverFailure = error instanceof Error ? error.name : "UnknownFailure";
  } finally {
    holdKey = false;
    releaseKey?.();
    failAudit = false;
    failActivity = false;
    for (const panel of webviews) try {
      panel.dispose();
    } catch {
    }
    for (const disposable of disposables) disposable.dispose();
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
    diagnostics: { ...setupDiagnostic(), n14Stage },
    independence: "LOW_SCRIPTED_ACTUAL_NATIVE_APIS_NOT_HUMAN",
    auditExport: "NO_REGISTERED_EXPORT_COMMAND_COMPONENT_COVERAGE_ONLY",
    exclusions: ["Transient JS/native processing memory", "Arbitrary native crash dumps", "Other extensions and unmanaged processes", "Real agent or human independence", "Native broker/MCP runtime controls belong to separate exact-runtime fixtures"]
  }, null, 2) + "\n", { flag: "wx" });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
