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

// packages/vscode-extension/src/__tests__/host/liteArtifactScanner.host.ts
var liteArtifactScanner_host_exports = {};
__export(liteArtifactScanner_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(liteArtifactScanner_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_node_fs = __toESM(require("node:fs"));
var import_promises = __toESM(require("node:fs/promises"));
var import_node_path = require("node:path");
var KEY = "soterai.hygiene.hmacKey.v1";
var STATE = "soterai.lite.hygiene.exposure.v1";
var FLAG = "lite.artifactScanner";
var ACTION = "Analyze local artifacts";
var CALLER = "TEST_ONLY_F24_CALLER_NOT_AUTHORITY_308c47e1";
var MAP_VALUE = "TEST_ONLY_F24_MAP_PRIVATE_1dc684ea";
var SOURCE_VALUE = "TEST_ONLY_F24_SOURCE_PRIVATE_d3247b19";
var COPY_VALUE = "TEST_ONLY_F24_COPY_PRIVATE_52b937a0";
var RENAMED_VALUE = "TEST_ONLY_F24_RENAMED_PRIVATE_c17e084b";
var OUTSIDE_VALUE = "TEST_ONLY_F24_OUTSIDE_NEVER_READ_b18df640";
var MAP = "dist/assets/decoded-output.js.map";
var JS = "dist/reviewable.js";
var PUBLIC = "dist/assets/public.js";
var RENAMED = "build/renamed-output.snapshot";
var COPY = "coverage/generated-copy.txt";
var WITH_URL = "dist/assets/with-map.js";
var UNSUPPORTED = "coverage/indexed-output.map";
var REFERENCE = "f24-reference-private.ts";
var PUBLIC_TEXT = "export const PORT = 3000;\n";
var JS_TEXT = 'const apiKey = "' + SOURCE_VALUE + '"; export const PORT = 3000;\n';
var unicode = (value) => [...value].map((character) => "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0")).join("");
var MAP_TEXT = JSON.stringify({
  version: 3,
  file: "../" + REFERENCE,
  sourceRoot: "https://artifact-source.invalid/",
  sources: ["../../" + REFERENCE],
  sourcesContent: ['const apiKey = "' + unicode(MAP_VALUE) + '";\n'],
  names: [],
  mappings: ""
}) + "\n";
var INPUTS = /* @__PURE__ */ new Map([
  [MAP, MAP_TEXT],
  [JS, JS_TEXT],
  [PUBLIC, PUBLIC_TEXT],
  [RENAMED, 'const apiKey = "' + RENAMED_VALUE + '";\n'],
  [COPY, "PASSWORD=" + COPY_VALUE + "\n"],
  [WITH_URL, "export const MODE = 'public';\n//# sourceMappingURL=decoded-output.js.map\n"],
  [".next/static/runtime.mjs", "export const MODE = 'public';\n"],
  [".cache/public.txt", "PORT=3000\n"],
  ["caches/public.txt", "MODE=public\n"]
]);
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
var root = "";
var outside = "";
var publicParent = "";
var sourceCalls = 0;
var sourceEvents = 0;
var contentReads = 0;
var referenceReads = 0;
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
var holdPublication = false;
var publicationEntered = false;
var finishPublication;
var selected = [];
var lastReview;
var setupStage = "initial";
var sha = (value) => (0, import_node_crypto.createHash)("sha256").update(value).digest("hex");
var note = (event) => trace.push({ event, milliseconds: performance.now() - started });
var within = (base, file) => {
  const part = (0, import_node_path.relative)((0, import_node_path.resolve)(base), (0, import_node_path.resolve)(file));
  return part === "" || !part.startsWith("..") && !(0, import_node_path.isAbsolute)(part);
};
function valueFree(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  for (const privateValue of [MAP_VALUE, SOURCE_VALUE, COPY_VALUE, RENAMED_VALUE, OUTSIDE_VALUE, CALLER]) (0, import_strict.default)(!text.includes(privateValue), "Private artifact entered a result or UI.");
}
function metadataOnly(value) {
  valueFree(value);
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  for (const name of [MAP, JS, PUBLIC, RENAMED, COPY, WITH_URL, UNSUPPORTED, REFERENCE]) (0, import_strict.default)(!text.includes(name), "Artifact filename entered keyed metadata.");
  if (root) (0, import_strict.default)(!text.includes(root), "Original root entered keyed metadata.");
}
function patch(object, name, value) {
  const prior = Object.getOwnPropertyDescriptor(object, name);
  Object.defineProperty(object, name, { configurable: true, writable: true, value });
  restores.push(() => prior ? Object.defineProperty(object, name, prior) : Reflect.deleteProperty(object, name));
}
async function until(predicate) {
  const end = Date.now() + 5e3;
  while (!predicate() && Date.now() < end) await new Promise((done) => setTimeout(done, 10));
  (0, import_strict.default)(predicate(), "Expected synthetic native UI stage was not reached.");
}
function filePath(value) {
  return typeof value === "string" ? value : value instanceof URL && value.protocol === "file:" ? vscode.Uri.parse(value.href).fsPath : value instanceof vscode.Uri && value.scheme === "file" ? value.fsPath : void 0;
}
function sourceDocument(value) {
  const file = filePath(value);
  return !!file && (within(root, file) || (0, import_node_path.resolve)(file) === (0, import_node_path.resolve)(outside));
}
function readObserved(value) {
  const file = filePath(value);
  if (!file) return;
  if ((0, import_node_path.resolve)(file) === (0, import_node_path.resolve)(outside) || file.endsWith(REFERENCE)) referenceReads++;
  if ([...INPUTS.keys(), UNSUPPORTED].some((name) => (0, import_node_path.resolve)(file) === (0, import_node_path.resolve)((0, import_node_path.join)(root, name)))) contentReads++;
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
async function outputNames() {
  return (await import_promises.default.readdir(publicParent)).sort();
}
function setupDiagnostic() {
  return { syntheticOnly: true, stage: setupStage, sourceCalls, sourceEvents, contentReads, referenceReads, stores, vaultStores, keyEvents };
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
  publicParent = (0, import_node_path.join)((0, import_node_path.dirname)(root), "artifact-public-outputs");
  (0, import_strict.default)(within((0, import_node_path.dirname)(root), outside) && !within(root, outside));
  (0, import_strict.default)(!within(root, publicParent));
  setupStage = "retained-synthetic-artifact-preparation";
  if (phase === "primary") {
    for (const [name, text] of INPUTS) {
      await import_promises.default.mkdir((0, import_node_path.dirname)((0, import_node_path.join)(root, name)), { recursive: true });
      await import_promises.default.writeFile((0, import_node_path.join)(root, name), text, { flag: "wx" });
    }
    await import_promises.default.writeFile(outside, 'const apiKey = "' + OUTSIDE_VALUE + '";\n', { flag: "wx" });
    await import_promises.default.mkdir(publicParent);
  }
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
        note("artifact-key-event");
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
  patch(vscode.window, "showOpenDialog", async (options) => options.canSelectFolders ? [vscode.Uri.file(publicParent)] : selected.map((name) => vscode.Uri.file((0, import_node_path.join)(root, name))));
  patch(vscode.window, "showQuickPick", async (items) => items[0]);
  patch(vscode.window, "showWarningMessage", async (message, options, ...items) => {
    valueFree([message, options, items]);
    const action = items.find((item) => [ACTION, "Create metadata export", "Publish reviewed snapshot"].includes(item));
    if (!action) return void 0;
    import_strict.default.equal(options.modal, true);
    reviews.push({ action, safe: true });
    if (action === ACTION) {
      metadataOnly([message, options, items]);
      if (holdPrompt) {
        promptEntered = true;
        return new Promise((done) => finishPrompt = done);
      }
    }
    if (action === "Publish reviewed snapshot" && holdPublication) {
      publicationEntered = true;
      return new Promise((done) => finishPublication = done);
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
  const oldPublication = config.inspect("projectPrivacy.safePublication")?.globalValue;
  const runtime = sha(await nativeRead((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js")));
  import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
  const receipt = (0, import_node_path.join)((0, import_node_path.dirname)(root), "artifact-restart.json"), observations = [];
  const check = async (scope, work) => {
    const row = { id: "F24-N" + String(observations.length + 1).padStart(2, "0"), scope, status: "NOT_RUN", errorName: void 0 };
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
    if (["reviewArtifacts", "artifactScannerStatus", "openHygieneExposureLedger"].includes(name)) metadataOnly(result2);
    else valueFree(result2);
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
    const before = await originals(), result2 = await call("reviewArtifacts", ...args);
    import_strict.default.deepEqual(await originals(), before);
    clean();
    return result2;
  };
  const fourFindings = (result2) => {
    (0, import_strict.default)(["ANALYZED", "PARTIAL"].includes(result2.status));
    import_strict.default.equal(result2.findings.length, 4);
    for (const finding of result2.findings) for (const field of ["id", "fileRef", "valueRef"]) import_strict.default.match(finding[field], /^[a-f0-9]{64}$/);
  };
  const publish = async (...names) => {
    selected = names;
    const before = await originals(), result2 = await call("preparePublicWorkspace", { approved: true, root: CALLER });
    import_strict.default.deepEqual(await originals(), before);
    clean();
    return result2;
  };
  const verifiedPublication = async (result2) => {
    import_strict.default.equal(result2.status, "PREPARED");
    (0, import_strict.default)(typeof result2.destination === "string" && within(publicParent, result2.destination));
    const manifest = JSON.parse(await nativeRead((0, import_node_path.join)(result2.destination, "soterai-publication-manifest.json"), "utf8"));
    import_strict.default.equal(manifest.isolation, "NO ISOLATION");
    valueFree(manifest);
    const { manifestSha256, ...body } = manifest;
    import_strict.default.equal(manifestSha256, sha(JSON.stringify(body)));
    import_strict.default.equal(result2.manifestSha256, manifestSha256);
    for (const entry of manifest.entries) {
      const bytes = await nativeRead((0, import_node_path.join)(result2.destination, entry.path));
      valueFree(bytes.toString("utf8"));
      import_strict.default.equal(sha(bytes), entry.sha256);
      import_strict.default.equal(bytes.length, entry.bytes);
    }
    import_strict.default.equal(await nativeRead((0, import_node_path.join)(result2.destination, PUBLIC), "utf8"), PUBLIC_TEXT);
    const redacted = await nativeRead((0, import_node_path.join)(result2.destination, JS), "utf8");
    valueFree(redacted);
    import_strict.default.match(redacted, /SOTERAI_PROTECTED_|MASKED/);
    import_strict.default.match(redacted, /PORT = 3000/);
    (0, import_strict.default)(!manifest.entries.some((entry) => entry.path.endsWith(".map") || entry.path === WITH_URL));
  };
  let driverFailure;
  try {
    if (phase === "primary") {
      await check("Exact runtime and two native artifact commands have no startup content, key or original document", async () => {
        import_strict.default.equal(contentReads, 0);
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(await context.secrets.get(KEY), void 0);
        import_strict.default.equal(metadata.length, 0);
        const status = await call("artifactScannerStatus", { approved: true, root: CALLER });
        import_strict.default.equal(status.status, "OWNER_REVIEW_REQUIRED");
        import_strict.default.equal(status.busy, false);
        const commands2 = await vscode.commands.getCommands(true);
        for (const name of ["reviewArtifacts", "artifactScannerStatus"]) (0, import_strict.default)(commands2.includes("soterai." + name));
        clean();
      });
      await check("Owner cancellation ignores caller authority before content or analyzer key", async () => {
        approve = false;
        const value = await scan({ root: CALLER, approved: true, content: CALLER });
        approve = true;
        import_strict.default.equal(value.status, "CANCELLED");
        import_strict.default.equal(contentReads, 0);
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(metadata.length, 0);
      });
      await check("One pending native owner modal stays busy and refuses a second review without reading", async () => {
        holdPrompt = true;
        promptEntered = false;
        const pending = call("reviewArtifacts");
        await until(() => promptEntered);
        import_strict.default.equal((await call("artifactScannerStatus")).busy, true);
        import_strict.default.equal((await call("reviewArtifacts", { approved: true })).status, "UNAVAILABLE");
        import_strict.default.equal(contentReads, 0);
        import_strict.default.equal(stores, 0);
        finishPrompt?.(void 0);
        import_strict.default.equal((await pending).status, "CANCELLED");
        holdPrompt = false;
        import_strict.default.equal((await call("artifactScannerStatus")).busy, false);
        clean();
      });
      await check("Saved maps decode escaped embedded source, JS and renamed copies while public generated assets remain useful", async () => {
        (0, import_strict.default)(!MAP_TEXT.includes(MAP_VALUE));
        lastReview = await scan();
        import_strict.default.equal(lastReview.status, "ANALYZED");
        fourFindings(lastReview);
        (0, import_strict.default)(lastReview.files >= 4);
        import_strict.default.equal(Buffer.from(await context.secrets.get(KEY), "base64").length, 32);
        (0, import_strict.default)(contentReads > 0);
        clean();
      });
      await check("Artifact report and canonical exposure ledger contain only keyed metadata, no values or filenames", async () => {
        (0, import_strict.default)(metadata.length >= 1);
        import_strict.default.deepEqual(JSON.parse(metadata.at(-1)), lastReview);
        (0, import_strict.default)(displayed.length >= 1);
        const view = await call("openHygieneExposureLedger");
        import_strict.default.equal(view.rows.length, 4);
        for (const row of view.rows) {
          import_strict.default.equal(row.lastAction, "possible-project-exposure");
          for (const field of ["id", "rootRef", "fileRef", "valueRef"]) import_strict.default.match(row[field], /^[a-f0-9]{64}$/);
        }
        clean();
      });
      await check("Caller path, ref, content and approvals cannot redirect a fresh artifact review", async () => {
        const result2 = await scan(vscode.Uri.file("C:\\foreign-f24-artifact"), { root: CALLER, path: CALLER, content: CALLER, approved: true });
        fourFindings(result2);
        import_strict.default.deepEqual(result2.findings.map((finding) => finding.id).sort(), lastReview.findings.map((finding) => finding.id).sort());
      });
      await check("Repeated artifact review preserves keyed ledger identity and increments observations", async () => {
        const before = await call("openHygieneExposureLedger");
        fourFindings(await scan());
        const after = await call("openHygieneExposureLedger");
        import_strict.default.equal(after.rows.length, 4);
        for (const row of before.rows) (0, import_strict.default)(after.rows.find((next) => next.id === row.id).observations > row.observations);
        clean();
      });
      await check("Indexed source map remains visibly partial without following references or discarding supported findings", async () => {
        await import_promises.default.writeFile((0, import_node_path.join)(root, UNSUPPORTED), JSON.stringify({ version: 3, sections: [{ offset: { line: 0, column: 0 }, url: "https://artifact-source.invalid/ignored.map" }] }) + "\n", { flag: "wx" });
        const result2 = await scan();
        import_strict.default.equal(result2.status, "PARTIAL");
        fourFindings(result2);
        (0, import_strict.default)(result2.skipped >= 1);
        clean();
      });
      await check("Native ledger export cancellation writes nothing; approved export contains only keyed artifact rows", async () => {
        approve = false;
        import_strict.default.equal((await call("exportHygieneExposureLedger")).status, "CANCELLED");
        approve = true;
        const directory = (0, import_node_path.join)(context.globalStorageUri.fsPath, "hygiene-exports");
        import_strict.default.equal((await import_promises.default.readdir(directory).catch(() => [])).length, 0);
        import_strict.default.equal((await call("exportHygieneExposureLedger")).status, "EXPORTED");
        const names = await import_promises.default.readdir(directory);
        import_strict.default.equal(names.length, 1);
        const exported = await nativeRead((0, import_node_path.join)(directory, names[0]), "utf8");
        metadataOnly(exported);
        import_strict.default.equal(JSON.parse(exported).rows.length, 4);
        clean();
      });
      await check("A key change and restoration during pending report creation cannot revive stale display or command output", async () => {
        const key = await context.secrets.get(KEY);
        (0, import_strict.default)(key);
        holdDocument = true;
        documentEntered = false;
        const beforeShown = displayed.length;
        const pending = call("reviewArtifacts");
        await until(() => documentEntered);
        const events = keyEvents;
        await context.secrets.store(KEY, Buffer.alloc(32, 64).toString("base64"));
        await until(() => keyEvents > events);
        await context.secrets.store(KEY, key);
        finishDocument?.();
        import_strict.default.equal((await pending).status, "UNAVAILABLE");
        holdDocument = false;
        import_strict.default.equal(displayed.length, beforeShown);
        clean();
      });
      await check("Disable and reenable during the native owner modal irreversibly withdraws pending review", async () => {
        holdPrompt = true;
        promptEntered = false;
        const beforeReads = contentReads, beforeStores = stores, pending = call("reviewArtifacts");
        await until(() => promptEntered);
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        finishPrompt?.(ACTION);
        import_strict.default.equal((await pending).status, "UNAVAILABLE");
        holdPrompt = false;
        import_strict.default.equal(contentReads, beforeReads);
        import_strict.default.equal(stores, beforeStores);
        clean();
      });
      await check("Owner disable blocks review and native machine scope rejects a repository override", async () => {
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        const beforeReads = contentReads, beforeStores = stores, prior = JSON.stringify(context.globalState.get(STATE));
        import_strict.default.equal((await call("reviewArtifacts", { approved: true, enabled: true })).status, "UNAVAILABLE");
        import_strict.default.equal((await call("artifactScannerStatus")).status, "UNAVAILABLE");
        await import_strict.default.rejects(async () => config.update(FLAG, true, vscode.ConfigurationTarget.Workspace), { name: "CodeExpectedError" });
        import_strict.default.equal((await call("artifactScannerStatus")).status, "UNAVAILABLE");
        import_strict.default.equal(contentReads, beforeReads);
        import_strict.default.equal(stores, beforeStores);
        import_strict.default.equal(JSON.stringify(context.globalState.get(STATE)), prior);
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        clean();
      });
      await check("Withdrawal while a native metadata document awaits prevents stale display and return", async () => {
        holdDocument = true;
        documentEntered = false;
        const beforeShown = displayed.length, pending = call("reviewArtifacts");
        await until(() => documentEntered);
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        finishDocument?.();
        import_strict.default.equal((await pending).status, "UNAVAILABLE");
        holdDocument = false;
        import_strict.default.equal(displayed.length, beforeShown);
        clean();
      });
      await check("Actual reviewed public snapshot preserves public JS and releases only redacted generated JS with matching manifest hashes", async () => {
        await config.update("projectPrivacy.safePublication", true, vscode.ConfigurationTarget.Global);
        await verifiedPublication(await publish(PUBLIC, JS));
        clean();
      });
      await check("Source-map release is withheld before any public output folder is created", async () => {
        const before = await outputNames();
        import_strict.default.notEqual((await publish(MAP)).status, "PREPARED");
        import_strict.default.deepEqual(await outputNames(), before);
        clean();
      });
      await check("SourceMappingURL-bearing generated JS remains withheld from publication", async () => {
        const before = await outputNames();
        import_strict.default.notEqual((await publish(WITH_URL)).status, "PREPARED");
        import_strict.default.deepEqual(await outputNames(), before);
        clean();
      });
      await check("The artifact machine flag withdraws publication at admission without a new public output", async () => {
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        const before = await outputNames();
        import_strict.default.notEqual((await publish(PUBLIC, JS)).status, "PREPARED");
        import_strict.default.deepEqual(await outputNames(), before);
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        clean();
      });
      await check("Artifact disable and reenable during actual publication approval revokes the one-shot public plan", async () => {
        holdPublication = true;
        publicationEntered = false;
        selected = [PUBLIC, JS];
        const before = await outputNames(), sourceBefore = await originals();
        const pending = call("preparePublicWorkspace");
        await until(() => publicationEntered);
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        finishPublication?.("Publish reviewed snapshot");
        import_strict.default.notEqual((await pending).status, "PREPARED");
        holdPublication = false;
        import_strict.default.deepEqual(await outputNames(), before);
        import_strict.default.deepEqual(await originals(), sourceBefore);
        clean();
      });
      await check("Cancelling actual publication leaves every output and saved original unchanged", async () => {
        const before = await outputNames();
        approve = false;
        import_strict.default.equal((await publish(PUBLIC, JS)).status, "CANCELLED");
        approve = true;
        import_strict.default.deepEqual(await outputNames(), before);
        clean();
      });
      await check("Artifact findings confer no current-file vault authority or automatic original cleanup", async () => {
        const before = await originals();
        import_strict.default.equal((await call("reviewHygieneVault", lastReview.findings[0], { approved: true })).status, "REVIEW_FILES_FIRST");
        import_strict.default.deepEqual(await originals(), before);
        import_strict.default.equal(await context.secrets.get("soterai.vaultKey"), void 0);
        clean();
      });
      await check("An outside hardlink is withheld and retained, and exact original hashes plus keyed rows form the restart basis", async () => {
        const alias = (0, import_node_path.join)(root, "dist/assets/linked-output.txt"), retained = (0, import_node_path.join)(root, "node_modules/f24-retained-linked-output.txt");
        await import_promises.default.link(outside, alias);
        try {
          const beforeReads = referenceReads;
          import_strict.default.equal((await call("reviewArtifacts")).status, "UNAVAILABLE");
          import_strict.default.equal(referenceReads, beforeReads);
        } finally {
          await import_promises.default.mkdir((0, import_node_path.dirname)(retained), { recursive: true });
          await import_promises.default.rename(alias, retained);
        }
        import_strict.default.equal((await import_promises.default.lstat(outside)).nlink, 2);
        import_strict.default.equal((await import_promises.default.lstat(retained)).nlink, 2);
        clean();
        const fresh = await scan();
        fourFindings(fresh);
        import_strict.default.equal(fresh.status, "PARTIAL");
        const ledger = await call("openHygieneExposureLedger");
        import_strict.default.equal(ledger.rows.length, 4);
        await import_promises.default.writeFile(receipt, JSON.stringify({ ledger: context.globalState.get(STATE), originals: await originals(), findingIds: fresh.findings.map((finding) => finding.id).sort(), ledgerIds: ledger.rows.map((row) => row.id).sort() }) + "\n", { flag: "wx" });
      });
    } else {
      const prior = JSON.parse(await nativeRead(receipt, "utf8"));
      await check("Restart reuses persisted key and keyed ledger without startup content, documents or new key stores", async () => {
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(contentReads, 0);
        import_strict.default.equal(metadata.length, 0);
        import_strict.default.equal((await call("artifactScannerStatus")).status, "OWNER_REVIEW_REQUIRED");
        import_strict.default.deepEqual(context.globalState.get(STATE), prior.ledger);
        import_strict.default.deepEqual(await originals(), prior.originals);
        clean();
      });
      await check("Restart cancellation still requires native owner consent before artifact content or fresh authority", async () => {
        approve = false;
        import_strict.default.equal((await scan({ approved: true, findingIds: prior.findingIds })).status, "CANCELLED");
        approve = true;
        import_strict.default.equal(contentReads, 0);
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(metadata.length, 0);
        import_strict.default.deepEqual(context.globalState.get(STATE), prior.ledger);
        clean();
      });
      await check("Fresh restart review reestablishes stable keyed artifact findings and preserves unsupported-map partial scope", async () => {
        const result2 = await scan();
        fourFindings(result2);
        import_strict.default.equal(result2.status, "PARTIAL");
        import_strict.default.deepEqual(result2.findings.map((finding) => finding.id).sort(), prior.findingIds);
        const ledger = await call("openHygieneExposureLedger");
        import_strict.default.deepEqual(ledger.rows.map((row) => row.id).sort(), prior.ledgerIds);
        import_strict.default.equal(stores, 0);
        clean();
      });
      await check("Restart publication requires a fresh owner decision and still produces verified canary-free output", async () => {
        await config.update("projectPrivacy.safePublication", true, vscode.ConfigurationTarget.Global);
        const before = await outputNames();
        approve = false;
        import_strict.default.equal((await publish(PUBLIC, JS)).status, "CANCELLED");
        approve = true;
        import_strict.default.deepEqual(await outputNames(), before);
        await verifiedPublication(await publish(PUBLIC, JS));
        import_strict.default.equal(stores, 0);
        import_strict.default.deepEqual(await originals(), prior.originals);
        clean();
      });
    }
  } catch {
    driverFailure = "NativeArtifactDriverFailure";
  } finally {
    try {
      finishPrompt?.(void 0);
      finishDocument?.();
      finishPublication?.(void 0);
      holdPrompt = false;
      holdDocument = false;
      holdPublication = false;
      await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global);
      await config.update("projectPrivacy.safePublication", oldPublication, vscode.ConfigurationTarget.Global);
      clean();
      for (const document of /* @__PURE__ */ new Set([...opened, ...displayed])) if (!document.isClosed && document.isUntitled) {
        await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
      }
    } catch {
      driverFailure = "NativeArtifactWithdrawalUnconfirmed";
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
    artifactContentReads: contentReads,
    referencedContentReads: referenceReads,
    secretStorageStores: stores,
    vaultKeyStores: vaultStores,
    reviews,
    metadataDocuments: metadata.length,
    trace,
    driverFailure,
    independence: "LOW",
    ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
    notTested: [
      "Human usability/accessibility",
      "Map validity, original-path sanitization or releasing source maps",
      "Other platforms, transformed/prose/binary/unknown credentials",
      "Credential validity, provider rotation, actual AI access or prior copies",
      "Same-user unmanaged reads and independent uploads"
    ]
  };
  metadataOnly(result);
  await import_promises.default.writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || driverFailure || result.observations.length !== result.expectedChecks) throw Error("Native artifact scanner incomplete");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
