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

// packages/vscode-extension/src/__tests__/host/liteLogs.host.ts
var liteLogs_host_exports = {};
__export(liteLogs_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(liteLogs_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_node_fs = __toESM(require("node:fs"));
var import_promises = __toESM(require("node:fs/promises"));
var import_node_path = require("node:path");
var KEY = "soterai.hygiene.hmacKey.v1";
var STATE = "soterai.lite.hygiene.exposure.v1";
var FLAG = "lite.logProtection";
var ACTION = "Analyze saved logs";
var CALLER = "TEST_ONLY_F25_CALLER_NOT_AUTHORITY_b840d219";
var PLAIN_VALUE = "TEST_ONLY_F25_SAVED_LOG_PRIVATE_4832b1c7";
var TAP_VALUE = "TEST_ONLY_F25_TAP_PRIVATE_159dfcb0";
var PROPERTY_VALUE = "violet meadow tea TEST_ONLY_F25_PROPERTY_47c96a31";
var DECODED_VALUE = "TEST_ONLY_F25_DECODED_PRIVATE_689ad342";
var OUTSIDE_VALUE = "TEST_ONLY_F25_OUTSIDE_NEVER_READ_4a5f2793";
var REFERENCE = "f25-reference-private.ts";
var SAVED = "logs/saved.log";
var TAP = "coverage/failure.tap";
var STRUCTURED = "test-results/nested.json";
var JSONL = "test-results/decoded.jsonl";
var PUBLIC = "logs/public.tap";
var TEMPLATES = "logs/templates.json";
var PUBLIC_TEXT = "TAP version 13\nnot ok 1 - public arithmetic\n  ---\n  expected: 3000\n  actual: 4000\n  at: public-test.cjs:8:2\n  ...\n1..1\n";
var unicode = (text) => [...text].map((character) => "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0")).join("");
var INPUTS = /* @__PURE__ */ new Map([
  [SAVED, "Expected synthetic setup failure\nAPI_KEY=" + PLAIN_VALUE + "\n    at public-test.cjs:7:3\n"],
  [TAP, "TAP version 13\nnot ok 1 - synthetic failure\nTOKEN=" + TAP_VALUE + "\n1..1\n"],
  [STRUCTURED, '{"failure":{"pass\\u0077ord":' + JSON.stringify(PROPERTY_VALUE) + ',"actual":3000,"expected":4000},"file":"../' + REFERENCE + '","url":"https://saved-log-reference.invalid/never"}\n'],
  [JSONL, '{"failure":{"message":"' + unicode("API_KEY=" + DECODED_VALUE) + '"},"file":"../' + REFERENCE + '"}\n{"message":"public assertion failed","stack":"public-test.cjs:8:2"}\n'],
  [PUBLIC, PUBLIC_TEXT],
  [TEMPLATES, JSON.stringify({ password: "${OWNER_PASSWORD}", token: "<owner-token>", stripePublishableKey: "pk_test_syntheticPublic123", message: "public assertion failed" }) + "\n"]
]);
var PRIVATE_VALUES = [PLAIN_VALUE, TAP_VALUE, PROPERTY_VALUE, DECODED_VALUE, OUTSIDE_VALUE, CALLER];
var LIMITS = { files: 128, fileBytes: 65536, totalBytes: 1048576, milliseconds: 6e4, parts: 32, depth: 32, valueContainerNodes: 1e4, records: 128 };
var nativeRead = import_promises.default.readFile;
var nativeOpen = import_promises.default.open;
var nativeReadSync = import_node_fs.default.readFileSync;
var nativeOpenSync = import_node_fs.default.openSync;
var restores = [];
var listeners = [];
var opened = [];
var displayed = [];
var metadata = [];
var reviews = [];
var started = performance.now();
var trace = [];
var discoveries = [];
var registeredFiles = /* @__PURE__ */ new Map();
var readEvents = [];
var root = "";
var outside = "";
var setupStage = "initial";
var caseNumber = 0;
var activeCase;
var sourceCalls = 0;
var sourceEvents = 0;
var contentReads = 0;
var referenceReads = 0;
var observedFileCalls = 0;
var caseVariantContentMatches = 0;
var stores = 0;
var vaultStores = 0;
var keyEvents = 0;
var approve = true;
var holdPrompt = false;
var promptEntered = false;
var finishPrompt;
var holdDocument = false;
var documentEntered = false;
var finishDocument;
var lastReview;
var sha = (value) => (0, import_node_crypto.createHash)("sha256").update(value).digest("hex");
var note = (event) => trace.push({ event, milliseconds: performance.now() - started });
var within = (base, file) => {
  const part = (0, import_node_path.relative)((0, import_node_path.resolve)(base), (0, import_node_path.resolve)(file));
  return part === "" || !part.startsWith("..") && !(0, import_node_path.isAbsolute)(part);
};
var fileKey = (file) => process.platform === "win32" ? (0, import_node_path.resolve)(file).toLowerCase() : (0, import_node_path.resolve)(file);
function valueFree(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  for (const privateValue of PRIVATE_VALUES) (0, import_strict.default)(!text.includes(privateValue), "Private log content entered a public result or UI.");
}
function metadataOnly(value) {
  valueFree(value);
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  for (const name of [...INPUTS.keys(), REFERENCE, "API_KEY", "pass\\u0077ord"]) (0, import_strict.default)(!text.includes(name), "Saved-log names or labels entered keyed metadata.");
  if (root) (0, import_strict.default)(!text.includes(root), "Original root entered keyed metadata.");
  if (outside) (0, import_strict.default)(!text.includes(outside), "Reference path entered keyed metadata.");
}
function patch(object, name, value) {
  const prior = Object.getOwnPropertyDescriptor(object, name);
  Object.defineProperty(object, name, { configurable: true, writable: true, value });
  restores.push(() => prior ? Object.defineProperty(object, name, prior) : Reflect.deleteProperty(object, name));
}
async function until(predicate, milliseconds = 5e3) {
  const end = Date.now() + milliseconds;
  while (!predicate() && Date.now() < end) await new Promise((done) => setTimeout(done, 10));
  (0, import_strict.default)(predicate(), "Expected synthetic native stage was not reached.");
}
function filePath(value) {
  return typeof value === "string" ? value : value instanceof URL && value.protocol === "file:" ? vscode.Uri.parse(value.href).fsPath : value instanceof vscode.Uri && value.scheme === "file" ? value.fsPath : void 0;
}
function sourceDocument(value) {
  const file = filePath(value);
  return !!file && (within(root, file) || fileKey(file) === fileKey(outside));
}
function readObserved(value) {
  const file = filePath(value);
  if (!file) return;
  observedFileCalls++;
  const key = fileKey(file), suffix = process.platform === "win32" ? REFERENCE.toLowerCase() : REFERENCE;
  if (key === fileKey(outside) || key.endsWith(suffix)) referenceReads++;
  const spelling = registeredFiles.get(key);
  if (spelling) {
    contentReads++;
    readEvents.push(key);
    if ((0, import_node_path.resolve)(file) !== spelling) caseVariantContentMatches++;
  }
}
async function originals() {
  const result = [];
  for (const name of INPUTS.keys()) {
    const bytes2 = await nativeRead((0, import_node_path.join)(root, name));
    result.push({ bytes: bytes2.length, sha256: sha(bytes2) });
  }
  const bytes = await nativeRead(outside);
  result.push({ bytes: bytes.length, sha256: sha(bytes) });
  return result;
}
async function put(name, text) {
  const file = (0, import_node_path.join)(root, name);
  await import_promises.default.mkdir((0, import_node_path.dirname)(file), { recursive: true });
  await import_promises.default.writeFile(file, text, { flag: "wx" });
  registeredFiles.set(fileKey(file), (0, import_node_path.resolve)(file));
}
async function withCase(files, work) {
  import_strict.default.equal(activeCase, void 0);
  const prefix = "f25-native-cases/case-" + String(++caseNumber).padStart(3, "0");
  for (const [name, text] of files) await put(prefix + "/" + name, text);
  activeCase = prefix;
  try {
    await work(prefix);
  } finally {
    activeCase = void 0;
    const retained = (0, import_node_path.join)(root, "node_modules/f25-retained-cases");
    await import_promises.default.mkdir(retained, { recursive: true });
    await import_promises.default.rename((0, import_node_path.join)(root, prefix), (0, import_node_path.join)(retained, "case-" + String(caseNumber).padStart(3, "0")));
  }
}
function setupDiagnostic() {
  return { syntheticOnly: true, stage: setupStage, sourceCalls, sourceEvents, contentReads, referenceReads, discoveryCalls: discoveries.length, stores, vaultStores, keyEvents };
}
async function beforeActivate(context) {
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  import_strict.default.match((0, import_node_path.resolve)(process.env.USERPROFILE ?? ""), /^D:\\SoterAI-Lite-test-profiles\\/i);
  import_strict.default.match((0, import_node_path.resolve)(root), /^D:\\SoterAI-Lite-test-profiles\\/i);
  (0, import_strict.default)(!within(root, context.globalStorageUri.fsPath));
  import_strict.default.equal(process.platform, "win32");
  const phase = process.env.SOTERAI_LITE_F17_PHASE;
  (0, import_strict.default)(phase === "primary" || phase === "restart");
  outside = (0, import_node_path.join)((0, import_node_path.dirname)(root), REFERENCE);
  (0, import_strict.default)(within((0, import_node_path.dirname)(root), outside) && !within(root, outside));
  setupStage = "retained-synthetic-saved-log-preparation";
  if (phase === "primary") {
    for (const [name, text] of INPUTS) await put(name, text);
    await import_promises.default.writeFile(outside, 'const apiKey = "' + OUTSIDE_VALUE + '";\n', { flag: "wx" });
  } else for (const name of INPUTS.keys()) registeredFiles.set(fileKey((0, import_node_path.join)(root, name)), (0, import_node_path.resolve)((0, import_node_path.join)(root, name)));
  patch(import_promises.default, "readFile", (...args) => {
    readObserved(args[0]);
    return Reflect.apply(nativeRead, import_promises.default, args);
  });
  patch(import_node_fs.default, "readFileSync", (...args) => {
    readObserved(args[0]);
    return Reflect.apply(nativeReadSync, import_node_fs.default, args);
  });
  patch(import_promises.default, "open", (...args) => {
    readObserved(args[0]);
    return Reflect.apply(nativeOpen, import_promises.default, args);
  });
  patch(import_node_fs.default, "openSync", (...args) => {
    readObserved(args[0]);
    return Reflect.apply(nativeOpenSync, import_node_fs.default, args);
  });
  const find = vscode.workspace.findFiles;
  patch(vscode.workspace, "findFiles", async (...args) => {
    discoveries.push({ maximum: args[2], isolatedSyntheticDirectory: activeCase !== void 0 });
    if (activeCase !== void 0) {
      import_strict.default.equal(args[2], 129);
      import_strict.default.equal(args[1], "**/{.git,node_modules}/**");
      const found = await find.call(vscode.workspace, new vscode.RelativePattern(root, activeCase + "/**/*"), args[1], args[2], args[3]);
      (0, import_strict.default)(found.every((uri) => within((0, import_node_path.join)(root, activeCase), uri.fsPath)));
      return found.sort((left, right) => fileKey(left.fsPath).localeCompare(fileKey(right.fsPath)));
    }
    return Reflect.apply(find, vscode.workspace, args);
  });
  const store = context.secrets.store;
  patch(context.secrets, "store", async (key, value) => {
    if (key === KEY) {
      stores++;
      import_strict.default.equal(Buffer.from(value, "base64").length, 32);
    }
    if (key === "soterai.vaultKey") vaultStores++;
    return store.call(context.secrets, key, value);
  });
  listeners.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("soterai")) note("soterai-configuration-event");
    }),
    context.secrets.onDidChange((event) => {
      if (event.key === KEY) {
        keyEvents++;
        note("log-key-event");
      }
    })
  );
  const open = vscode.workspace.openTextDocument;
  patch(vscode.workspace, "openTextDocument", async (...args) => {
    if (sourceDocument(args[0])) sourceCalls++;
    const input = args[0];
    if (typeof input?.content === "string") {
      valueFree(input.content);
      if (input.language === "json") {
        metadataOnly(input.content);
        metadata.push(input.content);
      }
    }
    const document = await Reflect.apply(open, vscode.workspace, args);
    if (typeof input?.content === "string") opened.push(document);
    if (holdDocument && input?.language === "json") {
      documentEntered = true;
      await new Promise((done) => finishDocument = done);
    }
    return document;
  });
  listeners.push(vscode.workspace.onDidOpenTextDocument((document) => {
    if (sourceDocument(document.uri)) sourceEvents++;
  }));
  const show = vscode.window.showTextDocument;
  patch(vscode.window, "showTextDocument", async (...args) => {
    const document = args[0];
    valueFree(document.getText());
    displayed.push(document);
    return Reflect.apply(show, vscode.window, args);
  });
  patch(vscode.window, "showWarningMessage", async (message, options, ...items) => {
    valueFree([message, options, items]);
    const action = items.find((item) => [ACTION, "Create metadata export"].includes(item));
    if (!action) return void 0;
    import_strict.default.equal(options.modal, true);
    reviews.push({ action, modal: true });
    if (action === ACTION) {
      metadataOnly([message, options, items]);
      import_strict.default.match(options.detail ?? "", /128/);
      import_strict.default.match(options.detail ?? "", /64KiB/);
      import_strict.default.match(options.detail ?? "", /1MiB/);
      import_strict.default.match(options.detail ?? "", /60seconds/);
      if (holdPrompt) {
        promptEntered = true;
        return new Promise((done) => finishPrompt = done);
      }
    }
    return approve ? action : void 0;
  });
  for (const name of ["showInformationMessage", "showErrorMessage"]) patch(vscode.window, name, async (message) => {
    valueFree(message);
    return void 0;
  });
  setupStage = "instrumented-before-production-activation";
}
async function run(context) {
  const phase = process.env.SOTERAI_LITE_F17_PHASE, output = process.env.SOTERAI_LITE_F17_EVIDENCE;
  const config = vscode.workspace.getConfiguration("soterai"), oldFlag = config.inspect(FLAG)?.globalValue;
  const oldVault = config.inspect("lite.vaultMode")?.globalValue;
  const runtime = sha(await nativeRead((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js")));
  import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
  const receipt = (0, import_node_path.join)((0, import_node_path.dirname)(root), "logs-restart.json"), observations = [];
  const check = async (scope, work) => {
    const row = { id: "F25-N" + String(observations.length + 1).padStart(2, "0"), scope, status: "NOT_RUN", errorName: void 0 };
    observations.push(row);
    try {
      await work();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      row.errorName = error instanceof Error ? error.name : "UnknownFailure";
    }
  };
  const call = async (name, ...args) => {
    note("command-start-" + name);
    const result2 = await vscode.commands.executeCommand("soterai." + name, ...args);
    metadataOnly(result2);
    trace.push({
      event: "command-end-" + name,
      milliseconds: performance.now() - started,
      status: typeof result2?.status === "string" && /^[A-Z_]{1,80}$/.test(result2.status) ? result2.status : "METADATA",
      files: Number.isSafeInteger(result2?.files) ? result2.files : void 0,
      findings: Array.isArray(result2?.findings) ? result2.findings.length : void 0
    });
    return result2;
  };
  const clean = () => {
    import_strict.default.equal(sourceCalls, 0);
    import_strict.default.equal(sourceEvents, 0);
    import_strict.default.equal(referenceReads, 0);
    import_strict.default.equal(vaultStores, 0);
    (0, import_strict.default)(!vscode.workspace.textDocuments.some((document) => sourceDocument(document.uri)));
    metadataOnly(context.globalState.get(STATE));
    metadataOnly(metadata);
  };
  const scan = async (...args) => {
    const before = await originals(), result2 = await call("reviewLogs", ...args);
    import_strict.default.deepEqual(await originals(), before);
    clean();
    return result2;
  };
  const fourFindings = (result2) => {
    import_strict.default.equal(result2.status, "ANALYZED");
    import_strict.default.equal(result2.files, INPUTS.size);
    import_strict.default.equal(result2.skipped, 0);
    import_strict.default.equal(result2.findings.length, 4);
    for (const finding of result2.findings) for (const field of ["id", "fileRef", "valueRef"]) import_strict.default.match(finding[field], /^[a-f0-9]{64}$/);
  };
  const isolated = async (files, verify) => withCase(files, async (prefix) => {
    const beforeReads = readEvents.length;
    const result2 = await scan();
    await verify(result2, prefix, readEvents.slice(beforeReads));
  });
  const noFindings = (result2, status, files, skipped) => {
    import_strict.default.equal(result2.status, status);
    import_strict.default.equal(result2.files, files);
    import_strict.default.equal(result2.skipped, skipped);
    import_strict.default.deepEqual(result2.findings, []);
  };
  let driverFailure;
  try {
    if (phase === "primary") {
      await check("Exact packaged commands have no startup discovery, content, key or original document", async () => {
        import_strict.default.equal(discoveries.length, 0);
        import_strict.default.equal(contentReads, 0);
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(await context.secrets.get(KEY), void 0);
        import_strict.default.equal(metadata.length, 0);
        const status = await call("logProtectionStatus", { approved: true, root: CALLER });
        import_strict.default.equal(status.status, "OWNER_REVIEW_REQUIRED");
        import_strict.default.equal(status.busy, false);
        const commands2 = await vscode.commands.getCommands(true);
        for (const name of ["reviewLogs", "logProtectionStatus"]) (0, import_strict.default)(commands2.includes("soterai." + name));
        clean();
      });
      await check("Native owner cancellation ignores caller authority before discovery, key and content", async () => {
        approve = false;
        try {
          import_strict.default.equal((await scan({ approved: true, root: CALLER, content: CALLER })).status, "CANCELLED");
        } finally {
          approve = true;
        }
        import_strict.default.equal(discoveries.length, 0);
        import_strict.default.equal(contentReads, 0);
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(metadata.length, 0);
      });
      await check("One pending owner modal stays busy and refuses a second command without discovery", async () => {
        holdPrompt = true;
        promptEntered = false;
        const pending = call("reviewLogs");
        try {
          await until(() => promptEntered);
          import_strict.default.equal((await call("logProtectionStatus")).busy, true);
          import_strict.default.equal((await call("reviewLogs", { approved: true })).status, "UNAVAILABLE");
          import_strict.default.equal(discoveries.length, 0);
          import_strict.default.equal(contentReads, 0);
          import_strict.default.equal(stores, 0);
        } finally {
          finishPrompt?.(void 0);
          holdPrompt = false;
        }
        import_strict.default.equal((await pending).status, "CANCELLED");
        import_strict.default.equal((await call("logProtectionStatus")).busy, false);
        clean();
      });
      await check("Actual saved log, TAP, nested sensitive JSON property and decoded JSONL each produce one finding", async () => {
        (0, import_strict.default)(!INPUTS.get(JSONL).includes(DECODED_VALUE));
        lastReview = await scan();
        fourFindings(lastReview);
        import_strict.default.equal(Buffer.from(await context.secrets.get(KEY), "base64").length, 32);
        (0, import_strict.default)(contentReads > 0);
        (0, import_strict.default)(discoveries.some((item) => item.maximum === 129 && !item.isolatedSyntheticDirectory));
        clean();
      });
      await check("logs-v1 exact value references and canonical ledger rows are metadata only with distinct finding IDs", async () => {
        fourFindings(lastReview);
        import_strict.default.deepEqual(JSON.parse(metadata.at(-1)), lastReview);
        (0, import_strict.default)(displayed.length >= 1);
        const rawKey = Buffer.from(await context.secrets.get(KEY), "base64"), scoped = (0, import_node_crypto.createHmac)("sha256", rawKey).update("analysis-root\0" + vscode.workspace.workspaceFolders[0].uri.toString()).digest();
        const logKey = (0, import_node_crypto.createHmac)("sha256", scoped).update("analysis-domain\0logs-v1").digest();
        const ref = (key, value) => (0, import_node_crypto.createHmac)("sha256", key).update("value\0").update(value, "utf8").digest("hex");
        import_strict.default.deepEqual(lastReview.findings.map((finding) => finding.valueRef).sort(), [PLAIN_VALUE, TAP_VALUE, PROPERTY_VALUE, DECODED_VALUE].map((value) => ref(logKey, value)).sort());
        for (const domain of [void 0, "history-v1", "artifact-v1"]) {
          const key = domain ? (0, import_node_crypto.createHmac)("sha256", scoped).update("analysis-domain\0" + domain).digest() : scoped;
          (0, import_strict.default)(!lastReview.findings.some((finding) => finding.valueRef === ref(key, PLAIN_VALUE)));
        }
        rawKey.fill(0);
        logKey.fill(0);
        scoped.fill(0);
        const ledger = await call("openHygieneExposureLedger");
        import_strict.default.equal(ledger.rows.length, 4);
        for (const row of ledger.rows) {
          import_strict.default.equal(row.lastAction, "possible-project-exposure");
          for (const field of ["id", "rootRef", "fileRef", "valueRef"]) import_strict.default.match(row[field], /^[a-f0-9]{64}$/);
          (0, import_strict.default)(!lastReview.findings.some((finding) => finding.id === row.id));
          (0, import_strict.default)(lastReview.findings.some((finding) => finding.fileRef === row.fileRef && finding.valueRef === row.valueRef));
        }
        clean();
      });
      await check("Caller paths and approvals cannot redirect repeated scans or change keyed ledger identity", async () => {
        const before = await call("openHygieneExposureLedger"), result2 = await scan(vscode.Uri.file("C:\\foreign-f25-log"), { root: CALLER, path: CALLER, content: CALLER, approved: true });
        fourFindings(result2);
        import_strict.default.deepEqual(result2.findings.map((finding) => finding.id).sort(), lastReview.findings.map((finding) => finding.id).sort());
        const after = await call("openHygieneExposureLedger");
        import_strict.default.equal(after.rows.length, 4);
        for (const row of before.rows) (0, import_strict.default)(after.rows.find((next) => next.id === row.id).observations > row.observations);
        clean();
      });
      await check("Public TAP, Windows stack and credential templates remain useful without vault mode or a vault key", async () => {
        await config.update("lite.vaultMode", false, vscode.ConfigurationTarget.Global);
        try {
          await isolated(/* @__PURE__ */ new Map([["public.tap", PUBLIC_TEXT], ["stack.log", "Error: public assertion\n    at C:\\public-tests\\example.cjs:7:3\n"], ["templates.json", INPUTS.get(TEMPLATES)]]), async (result2) => noFindings(result2, "ANALYZED", 3, 0));
        } finally {
          await config.update("lite.vaultMode", oldVault, vscode.ConfigurationTarget.Global);
        }
        import_strict.default.equal(INPUTS.get(PUBLIC), PUBLIC_TEXT);
        import_strict.default.equal(await context.secrets.get("soterai.vaultKey"), void 0);
        clean();
      });
      await check("Malformed late JSONL, duplicate keys, strict syntax, decoded controls and invalid UTF8 withhold atomically", async () => {
        const valid = JSON.stringify({ password: PROPERTY_VALUE });
        const decodedControl = '{"password":' + JSON.stringify(PROPERTY_VALUE) + ',"message":"public\\u202e"}';
        (0, import_strict.default)(decodedControl.includes("\\u202e"));
        (0, import_strict.default)(!decodedControl.includes("\u202E"));
        await isolated(/* @__PURE__ */ new Map([
          ["late.jsonl", valid + '\n{"message":"unterminated'],
          ["duplicate.json", '{"password":' + JSON.stringify(PROPERTY_VALUE) + ',"pass\\u0077ord":"public"}'],
          ["strict.json", valid.slice(0, -1) + ",}"],
          ["control.json", decodedControl],
          ["invalid.log", Buffer.from([255, 254, 255])]
        ]), async (result2) => noFindings(result2, "PARTIAL", 0, 5));
        clean();
      });
      await check("Exactly32 semantic strings are admitted and a33rd withholds the complete structured file", async () => {
        const parts = Array.from({ length: 32 }, (_, index) => "public part " + index);
        await isolated(/* @__PURE__ */ new Map([["exact.json", JSON.stringify(parts)], ["over.json", JSON.stringify([...parts, "extra public part"])]]), async (result2) => noFindings(result2, "PARTIAL", 1, 1));
      });
      await check("Exact depth32,10000 value-container nodes and128 JSONL records remain useful; each next unit withholds", async () => {
        const nested = (depth) => "[".repeat(depth) + '"public"' + "]".repeat(depth);
        const nodes = (count) => "[" + Array.from({ length: count - 1 }, () => "0").join(",") + "]";
        const records = (count) => Array.from({ length: count }, (_, index) => JSON.stringify({ index })).join("\n") + "\n";
        await isolated(/* @__PURE__ */ new Map([
          ["depth-exact.json", nested(32)],
          ["depth-over.json", nested(33)],
          ["nodes-exact.json", nodes(1e4)],
          ["nodes-over.json", nodes(10001)],
          ["records-exact.jsonl", records(128)],
          ["records-over.jsonl", records(129)]
        ]), async (result2) => noFindings(result2, "PARTIAL", 3, 3));
      });
      await check("Inclusive64KiB saved-file admission preserves a public log and skips the next byte before reading", async () => {
        const exact = "PORT=3000\n" + " ".repeat(65536 - 10);
        import_strict.default.equal(Buffer.byteLength(exact), LIMITS.fileBytes);
        await isolated(/* @__PURE__ */ new Map([["exact.log", exact], ["over.log", exact + "x"]]), async (result2, prefix, reads) => {
          noFindings(result2, "PARTIAL", 1, 1);
          (0, import_strict.default)(reads.includes(fileKey((0, import_node_path.join)(root, prefix, "exact.log"))));
          (0, import_strict.default)(!reads.includes(fileKey((0, import_node_path.join)(root, prefix, "over.log"))));
        });
      });
      await check("Seventeen64KiB public files admit at most1MiB unique raw content and report the rest partial", async () => {
        const exact = "PORT=3000\n" + " ".repeat(65536 - 10), files = new Map(Array.from({ length: 17 }, (_, index) => ["public-" + String(index).padStart(2, "0") + ".log", exact]));
        await isolated(files, async (result2, _prefix, reads) => {
          noFindings(result2, "PARTIAL", 16, 1);
          import_strict.default.equal(new Set(reads).size, 16);
          import_strict.default.equal(new Set(reads).size * 65536, LIMITS.totalBytes);
        });
      });
      await check("Failed UTF8 decoding consumes the1MiB raw admission budget and prevents a later valid read", async () => {
        const files = new Map(Array.from({ length: 16 }, (_, index) => ["a-invalid-" + String(index).padStart(2, "0") + ".log", Buffer.alloc(65536, 255)]));
        files.set("z-after-budget.log", "Public TAP failure\n");
        await isolated(files, async (result2, prefix, reads) => {
          noFindings(result2, "PARTIAL", 0, 17);
          import_strict.default.equal(new Set(reads).size, 16);
          (0, import_strict.default)(!reads.includes(fileKey((0, import_node_path.join)(root, prefix, "z-after-budget.log"))));
        });
      });
      await check("Native discovery uses129 as the sentinel and scans no more than128 regular files", async () => {
        const files = new Map(Array.from({ length: 129 }, (_, index) => ["public-" + String(index).padStart(3, "0") + ".log", "PORT=3000\n"]));
        await isolated(files, async (result2, _prefix, reads) => {
          noFindings(result2, "PARTIAL", 128, 1);
          import_strict.default.equal(new Set(reads).size, 128);
          import_strict.default.equal(discoveries.at(-1)?.maximum, 129);
        });
      });
      await check("Owner disable blocks discovery and a repository enable is rejected by native machine scope", async () => {
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        const beforeReads = contentReads, beforeFind = discoveries.length, beforeStores = stores, prior = JSON.stringify(context.globalState.get(STATE));
        try {
          import_strict.default.equal((await call("reviewLogs", { enabled: true, approved: true })).status, "UNAVAILABLE");
          import_strict.default.equal((await call("logProtectionStatus")).status, "UNAVAILABLE");
          await import_strict.default.rejects(async () => config.update(FLAG, true, vscode.ConfigurationTarget.Workspace), { name: "CodeExpectedError" });
          import_strict.default.equal(contentReads, beforeReads);
          import_strict.default.equal(discoveries.length, beforeFind);
          import_strict.default.equal(stores, beforeStores);
          import_strict.default.equal(JSON.stringify(context.globalState.get(STATE)), prior);
        } finally {
          await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        }
        clean();
      });
      await check("Disable and reenable while owner approval waits irreversibly withdraws before discovery", async () => {
        holdPrompt = true;
        promptEntered = false;
        const beforeReads = contentReads, beforeFind = discoveries.length, beforeStores = stores, pending = call("reviewLogs");
        try {
          await until(() => promptEntered);
          await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
          await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        } finally {
          finishPrompt?.(ACTION);
          holdPrompt = false;
        }
        import_strict.default.equal((await pending).status, "UNAVAILABLE");
        import_strict.default.equal(contentReads, beforeReads);
        import_strict.default.equal(discoveries.length, beforeFind);
        import_strict.default.equal(stores, beforeStores);
        clean();
      });
      await check("Key change and restoration while metadata creation waits cannot revive stale display or command output", async () => {
        const key = await context.secrets.get(KEY);
        (0, import_strict.default)(key);
        holdDocument = true;
        documentEntered = false;
        const beforeShown = displayed.length, pending = call("reviewLogs");
        try {
          await until(() => documentEntered);
          const events = keyEvents;
          await context.secrets.store(KEY, Buffer.alloc(32, 65).toString("base64"));
          await until(() => keyEvents > events);
          await context.secrets.store(KEY, key);
        } finally {
          await context.secrets.store(KEY, key);
          finishDocument?.();
          holdDocument = false;
        }
        import_strict.default.equal((await pending).status, "UNAVAILABLE");
        import_strict.default.equal(displayed.length, beforeShown);
        clean();
      });
      await check("Canonical source replacement while a metadata document waits suppresses stale display and preserves restored originals", async () => {
        holdDocument = true;
        documentEntered = false;
        const beforeShown = displayed.length, original = INPUTS.get(SAVED), pending = call("reviewLogs");
        try {
          await until(() => documentEntered);
          await import_promises.default.writeFile((0, import_node_path.join)(root, SAVED), "PORT=4000\n");
          finishDocument?.();
          import_strict.default.equal((await pending).status, "UNAVAILABLE");
          import_strict.default.equal(displayed.length, beforeShown);
        } finally {
          await import_promises.default.writeFile((0, import_node_path.join)(root, SAVED), original);
          finishDocument?.();
          holdDocument = false;
        }
        clean();
      });
      await check("Owned flag withdrawal after analysis and before display suppresses the completed saved-log result", async () => {
        holdDocument = true;
        documentEntered = false;
        const beforeShown = displayed.length, pending = call("reviewLogs");
        try {
          await until(() => documentEntered);
          await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
          await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        } finally {
          finishDocument?.();
          holdDocument = false;
        }
        import_strict.default.equal((await pending).status, "UNAVAILABLE");
        import_strict.default.equal(displayed.length, beforeShown);
        clean();
      });
      await check("The real60-second native approval deadline withdraws output while busy remains until the late modal closes", async () => {
        holdPrompt = true;
        promptEntered = false;
        const beforeReads = contentReads, beforeFind = discoveries.length, begin = performance.now(), pending = call("reviewLogs");
        try {
          await until(() => promptEntered);
          const result2 = await pending;
          (0, import_strict.default)(performance.now() - begin >= 6e4);
          import_strict.default.equal(result2.status, "UNAVAILABLE");
          import_strict.default.equal((await call("logProtectionStatus")).busy, true);
          import_strict.default.equal((await call("reviewLogs")).status, "UNAVAILABLE");
          import_strict.default.equal(contentReads, beforeReads);
          import_strict.default.equal(discoveries.length, beforeFind);
        } finally {
          finishPrompt?.(ACTION);
          holdPrompt = false;
        }
        let busy = true;
        for (let index = 0; index < 100 && busy; index++) {
          busy = (await call("logProtectionStatus")).busy;
          if (busy) await new Promise((done) => setTimeout(done, 10));
        }
        import_strict.default.equal(busy, false);
        clean();
      });
      await check("Outside hardlinks are withheld without reference reads; findings grant no vault authority and form the restart basis", async () => {
        const prefix = "f25-native-cases/alias-case", alias = (0, import_node_path.join)(root, prefix, "linked.log"), retained = (0, import_node_path.join)(root, "node_modules/f25-retained-alias.log");
        await import_promises.default.mkdir((0, import_node_path.dirname)(alias), { recursive: true });
        await import_promises.default.link(outside, alias);
        registeredFiles.set(fileKey(alias), (0, import_node_path.resolve)(alias));
        activeCase = prefix;
        try {
          const beforeReads = contentReads;
          import_strict.default.equal((await call("reviewLogs")).status, "UNAVAILABLE");
          import_strict.default.equal(contentReads, beforeReads);
        } finally {
          activeCase = void 0;
          await import_promises.default.mkdir((0, import_node_path.dirname)(retained), { recursive: true });
          await import_promises.default.rename(alias, retained);
        }
        import_strict.default.equal((await import_promises.default.lstat(outside)).nlink, 2);
        import_strict.default.equal((await import_promises.default.lstat(retained)).nlink, 2);
        clean();
        const fresh = await scan();
        fourFindings(fresh);
        import_strict.default.equal((await call("reviewHygieneVault", fresh.findings[0], { approved: true })).status, "REVIEW_FILES_FIRST");
        const ledger = await call("openHygieneExposureLedger");
        import_strict.default.equal(ledger.rows.length, 4);
        import_strict.default.equal(await context.secrets.get("soterai.vaultKey"), void 0);
        await import_promises.default.writeFile(receipt, JSON.stringify({ ledger: context.globalState.get(STATE), originals: await originals(), findingIds: fresh.findings.map((finding) => finding.id).sort(), ledgerIds: ledger.rows.map((row) => row.id).sort() }) + "\n", { flag: "wx" });
        clean();
      });
    } else {
      const prior = JSON.parse(await nativeRead(receipt, "utf8"));
      await check("Restart reuses persisted keyed metadata without startup discovery, content, documents or key stores", async () => {
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(discoveries.length, 0);
        import_strict.default.equal(contentReads, 0);
        import_strict.default.equal(metadata.length, 0);
        import_strict.default.equal((await call("logProtectionStatus")).status, "OWNER_REVIEW_REQUIRED");
        import_strict.default.deepEqual(context.globalState.get(STATE), prior.ledger);
        import_strict.default.deepEqual(await originals(), prior.originals);
        clean();
      });
      await check("Restart caller approvals cannot replace a fresh native owner decision", async () => {
        approve = false;
        try {
          import_strict.default.equal((await scan({ approved: true, findingIds: prior.findingIds })).status, "CANCELLED");
        } finally {
          approve = true;
        }
        import_strict.default.equal(discoveries.length, 0);
        import_strict.default.equal(contentReads, 0);
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(metadata.length, 0);
        import_strict.default.deepEqual(context.globalState.get(STATE), prior.ledger);
        clean();
      });
      await check("Fresh restart review preserves exact saved-log finding IDs and independently keyed ledger row IDs", async () => {
        const result2 = await scan();
        fourFindings(result2);
        import_strict.default.deepEqual(result2.findings.map((finding) => finding.id).sort(), prior.findingIds);
        const ledger = await call("openHygieneExposureLedger");
        import_strict.default.deepEqual(ledger.rows.map((row) => row.id).sort(), prior.ledgerIds);
        for (const row of ledger.rows) {
          (0, import_strict.default)(!prior.findingIds.includes(row.id));
          (0, import_strict.default)(row.observations > prior.ledger.rows.find((old) => old.id === row.id).observations);
        }
        import_strict.default.equal(stores, 0);
        clean();
      });
      await check("Restart owner disable still withdraws the native route and fresh reenable preserves originals and public controls", async () => {
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        const beforeReads = contentReads, beforeFind = discoveries.length;
        try {
          import_strict.default.equal((await call("reviewLogs", { approved: true })).status, "UNAVAILABLE");
          import_strict.default.equal(contentReads, beforeReads);
          import_strict.default.equal(discoveries.length, beforeFind);
        } finally {
          await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        }
        fourFindings(await scan());
        import_strict.default.deepEqual(await originals(), prior.originals);
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(await nativeRead((0, import_node_path.join)(root, PUBLIC), "utf8"), PUBLIC_TEXT);
        clean();
      });
    }
  } catch {
    driverFailure = "NativeSavedLogsDriverFailure";
  } finally {
    try {
      finishPrompt?.(void 0);
      finishDocument?.();
      holdPrompt = false;
      holdDocument = false;
      await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global);
      await config.update("lite.vaultMode", oldVault, vscode.ConfigurationTarget.Global);
      clean();
      for (const document of /* @__PURE__ */ new Set([...opened, ...displayed])) if (!document.isClosed && document.isUntitled) {
        await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
      }
    } catch {
      driverFailure = "NativeSavedLogsWithdrawalUnconfirmed";
    }
    listeners.forEach((listener) => listener.dispose());
    for (const restore of restores.reverse()) restore();
  }
  const result = {
    schemaVersion: 1,
    phase,
    syntheticOnly: true,
    hostVersion: vscode.version,
    extensionBundleSha256: runtime,
    currentDeveloperBundleSha256: sha(await nativeRead((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js"))),
    hostProbeSha256: sha(await nativeRead(__filename)),
    observations,
    passed: observations.filter((row) => row.status === "PASS").length,
    failed: observations.filter((row) => row.status === "FAIL").length,
    notRun: observations.filter((row) => row.status === "NOT_RUN").length,
    expectedChecks: phase === "primary" ? 21 : 4,
    sourceDocumentCalls: sourceCalls,
    sourceDocumentEvents: sourceEvents,
    logContentReads: contentReads,
    referencedContentReads: referenceReads,
    observedFileCalls,
    caseVariantContentMatches,
    discoveries,
    limits: LIMITS,
    secretStorageStores: stores,
    vaultKeyStores: vaultStores,
    reviews,
    metadataDocuments: metadata.length,
    trace,
    driverFailure,
    independence: "LOW",
    ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
    boundaryDiscovery: "NATIVE_DISCOVERY_RESTRICTED_TO_RETAINED_SYNTHETIC_DIRECTORY_WITH_DETERMINISTIC_ADMISSION_ORDER",
    notTested: [
      "Human usability/accessibility",
      "Other extensions, normal debug consoles, arbitrary processes and transformed/prose/binary credentials",
      "Credential validity, provider rotation, AI access or prior disclosures",
      "Same-user unmanaged reads, process memory and independent uploads",
      "Other platforms and remote workspaces"
    ]
  };
  metadataOnly(result);
  await import_promises.default.writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || driverFailure || result.observations.length !== result.expectedChecks) throw Error("Native saved logs incomplete");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
