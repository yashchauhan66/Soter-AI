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

// packages/vscode-extension/src/__tests__/host/liteSecureEditor.host.ts
var liteSecureEditor_host_exports = {};
__export(liteSecureEditor_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run
});
module.exports = __toCommonJS(liteSecureEditor_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var VIEW_TYPE = "soterai.secureEditor";
var FLAG = "lite.secureEditor";
var MARKER = ".synthetic-lite-f05-host";
var RECEIPT = ".lite-f05-save-receipt.json";
var COMMENT = "SYNTHETIC_F05_HOST_COMMENT_NEVER_DEFAULT_VISIBLE_20261014";
var URL = "postgresql://synthetic:fake-only@f05-host.invalid/original";
var API = "SYNTHETIC_F05_HOST_API_VALUE_NEVER_DEFAULT_VISIBLE_20261014";
var NEW_URL = "postgresql://synthetic:fake-only@f05-native-edit.invalid/saved";
var DRAFT_URL = "postgresql://synthetic:fake-only@f05-native-recovery.invalid/draft";
var SOURCE = `# ${COMMENT}\r
DATABASE_URL = '${URL}'\r
API_KEY=${API}\r
PORT=5432\r
DUP=one\r
DUP=two\r
MULTI="first\r
SHADOW_SYNTHETIC=inside-value\r
last"\r
`;
var SAVED = SOURCE.replace(`'${URL}'`, NEW_URL);
var DRAFT = SOURCE.replace(`'${URL}'`, DRAFT_URL);
var SAFE = "DATABASE_URL=[MASKED]\nAPI_KEY=[MASKED]\nPORT=[MASKED]\nDUP=[MASKED]\nMULTI=[MASKED]";
var KEY_PREFIX = "soterai.lite.secureEditor.recovery.";
var RECORD_PREFIX = "soterai.lite.secureEditor.backup.";
var sha = (bytes) => (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
var wait = (ms) => new Promise((done) => setTimeout(done, ms));
var views = [];
var opens = [];
var backups = [];
var restorePatches = [];
var listeners = [];
var installed = false;
var hookedContext;
var registeredProvider;
var multipleEditors = false;
var sourceDocumentCalls = 0;
var sourceDocumentEvents = 0;
var editEvents = 0;
var saveCalls = 0;
var saveFailures = 0;
var secretStores = 0;
var secretGets = 0;
var revealApproval = true;
var recoveryApproval = true;
var input = NEW_URL;
var inputCalls = 0;
var nativeModalCalls = 0;
function noValues(text) {
  for (const value of [COMMENT, URL, API, NEW_URL, DRAFT_URL])
    import_strict.default.ok(!text.includes(value), "A default or metadata sink contained a synthetic private value.");
}
function replace(target, name, value) {
  const own = Object.getOwnPropertyDescriptor(target, name);
  Object.defineProperty(target, name, { configurable: true, enumerable: own?.enumerable ?? false, writable: true, value });
  restorePatches.push(() => {
    if (own) Object.defineProperty(target, name, own);
    else Reflect.deleteProperty(target, name);
  });
}
function invoke(method, target, args) {
  import_strict.default.equal(typeof method, "function");
  return Reflect.apply(method, target, args);
}
function sourceUri() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  import_strict.default.ok(folder);
  return vscode.Uri.joinPath(folder.uri, ".env.host");
}
function isSource(uri) {
  return uri instanceof vscode.Uri && uri.toString() === sourceUri().toString();
}
function currentViews() {
  return views.filter((view) => !view.disposed && isSource(view.document.uri));
}
function binding(view) {
  const html = view.panel.webview.html;
  noValues(html);
  const session = /data-session=["']([^"']+)["']/.exec(html)?.[1];
  const rawRevision = /data-revision=["']([^"']+)["']/.exec(html)?.[1];
  const field = /data-field=["']([^"']+)["']/.exec(html)?.[1];
  import_strict.default.ok(session && field && rawRevision !== void 0);
  const revision = Number(rawRevision);
  import_strict.default.ok(Number.isSafeInteger(revision) && revision >= 0);
  return { session, revision, field };
}
function masked(view) {
  noValues(view.panel.webview.html);
  import_strict.default.match(view.panel.webview.html, /MASKED|[Mm]asked/);
  import_strict.default.ok(!view.panel.webview.html.includes("SHADOW_SYNTHETIC"), "Multiline value text cannot become a field name.");
}
function noSourceDocuments() {
  import_strict.default.equal(sourceDocumentCalls, 0);
  import_strict.default.equal(sourceDocumentEvents, 0);
  import_strict.default.equal(vscode.workspace.textDocuments.filter((document) => isSource(document.uri)).length, 0);
}
function tabs() {
  return vscode.window.tabGroups.all.flatMap((group) => [...group.tabs]).filter((tab) => tab.input instanceof vscode.TabInputCustom && tab.input.viewType === VIEW_TYPE && isSource(tab.input.uri));
}
async function until(predicate, timeout = 1e4) {
  const deadline = performance.now() + timeout;
  while (!predicate() && performance.now() < deadline) await wait(25);
  import_strict.default.ok(predicate(), "The expected native custom-editor lifecycle state was not observed.");
}
async function bounded(work, timeout = 15e3) {
  let timer;
  try {
    return await Promise.race([Promise.resolve(work), new Promise((_done, reject) => {
      timer = setTimeout(() => reject(new Error("Native custom-editor operation did not resolve.")), timeout);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function send(view, type) {
  import_strict.default.ok(view.listener);
  await bounded(Promise.resolve(view.listener({ type, ...binding(view) })));
}
function beforeActivate(context) {
  import_strict.default.equal(installed, false, "Install this owned hook once before the actual runtime activates.");
  installed = true;
  hookedContext = context;
  const register = vscode.window.registerCustomEditorProvider;
  replace(vscode.window, "registerCustomEditorProvider", (viewType, supplied, options) => {
    if (viewType === VIEW_TYPE) {
      import_strict.default.equal(registeredProvider, void 0);
      const provider = supplied;
      registeredProvider = provider;
      multipleEditors = options?.supportsMultipleEditorsPerDocument === true;
      const originalOpen = provider.openCustomDocument;
      replace(provider, "openCustomDocument", async (...args) => {
        const document = await invoke(originalOpen, provider, args);
        const openContext = args[1];
        opens.push({ document, uri: document.uri.toString(), ...openContext.backupId ? { backupId: openContext.backupId } : {} });
        return document;
      });
      const originalResolve = provider.resolveCustomEditor;
      replace(provider, "resolveCustomEditor", async (...args) => {
        const document = args[0], panel = args[1];
        const view = { document, panel, disposed: false, messages: [] };
        views.push(view);
        const receive = panel.webview.onDidReceiveMessage, post = panel.webview.postMessage;
        replace(panel.webview, "onDidReceiveMessage", (listener, thisArg, disposables) => {
          view.listener = (message) => listener.call(thisArg, message);
          return receive.call(panel.webview, listener, thisArg, disposables);
        });
        replace(panel.webview, "postMessage", async (message) => {
          const delivered = await post.call(panel.webview, message);
          view.messages.push({ value: structuredClone(message), delivered });
          return delivered;
        });
        listeners.push(panel.onDidDispose(() => {
          view.disposed = true;
        }));
        return await invoke(originalResolve, provider, args);
      });
      const originalSave = provider.saveCustomDocument;
      replace(provider, "saveCustomDocument", async (...args) => {
        saveCalls++;
        try {
          return await invoke(originalSave, provider, args);
        } catch (error) {
          saveFailures++;
          throw error;
        }
      });
      const originalBackup = provider.backupCustomDocument;
      replace(provider, "backupCustomDocument", async (...args) => {
        const document = args[0], visible = currentViews().find((view) => view.document === document);
        const row = { document, source: document.uri.toString(), revision: visible ? binding(visible).revision : void 0, failed: false };
        backups.push(row);
        try {
          const result = await invoke(originalBackup, provider, args);
          row.id = result.id;
          return result;
        } catch (error) {
          row.failed = true;
          throw error;
        }
      });
      listeners.push(provider.onDidChangeCustomDocument((event) => {
        if (isSource(event.document.uri)) {
          editEvents++;
          noValues("label" in event ? event.label ?? "" : "");
        }
      }));
    }
    return invoke(register, vscode.window, [viewType, supplied, options]);
  });
  const open = vscode.workspace.openTextDocument;
  replace(vscode.workspace, "openTextDocument", (...args) => {
    if (isSource(args[0])) sourceDocumentCalls++;
    return invoke(open, vscode.workspace, args);
  });
  listeners.push(vscode.workspace.onDidOpenTextDocument((document) => {
    if (isSource(document.uri)) sourceDocumentEvents++;
  }));
  const nativeStore = context.secrets.store, nativeGet = context.secrets.get;
  replace(context.secrets, "store", async (key, value) => {
    if (key.startsWith(KEY_PREFIX)) {
      secretStores++;
      import_strict.default.match(value, /^[A-Za-z0-9+/]{43}=$/);
      import_strict.default.equal(Buffer.from(value, "base64").length, 32);
    }
    return await nativeStore.call(context.secrets, key, value);
  });
  replace(context.secrets, "get", async (key) => {
    if (key.startsWith(KEY_PREFIX)) secretGets++;
    return await nativeGet.call(context.secrets, key);
  });
  replace(vscode.window, "showWarningMessage", async (message, ...items) => {
    noValues(message);
    const options = items[0];
    if (options?.detail) noValues(options.detail);
    if (options?.modal) nativeModalCalls++;
    if (items.includes("Reveal value")) return revealApproval ? "Reveal value" : void 0;
    if (items.includes("Save recovered draft")) return recoveryApproval ? "Save recovered draft" : void 0;
    if (items.includes("Allow safe read once")) return "Allow safe read once";
    return void 0;
  });
  replace(vscode.window, "showInputBox", async (options) => {
    inputCalls++;
    import_strict.default.equal(options.password, true);
    import_strict.default.equal(Object.hasOwn(options, "value"), false);
    noValues(JSON.stringify(options));
    return input;
  });
  for (const method of ["showInformationMessage", "showErrorMessage"])
    replace(vscode.window, method, async (message) => {
      noValues(message);
      return void 0;
    });
}
async function run(context) {
  const phase = process.env.SOTERAI_LITE_F05_PHASE, output = process.env.SOTERAI_LITE_F05_EVIDENCE;
  const profile = process.env.SOTERAI_LITE_F05_PROFILE;
  import_strict.default.ok(output && (0, import_node_path.isAbsolute)(output), "A unique absolute evidence path is required.");
  const declarations = phase === "reload" ? [
    ["F05-H08", "Actual workbench supplies an issued backupId after native hot-exit/restart; restored custom tab starts masked with no original TextDocument."],
    ["F05-H09", "Native Save writes the privately recovered dirty draft and ordinary safe-reader output remains entirely value-masked."],
    ["F05-H10", "Machine withdrawal clears reveals and blocks edit/open/save; saved protection persists and cleanup uses a re-enabled actual native save."]
  ] : [
    ["F05-H01", "Byte-identical packaged runtime registers the native CustomDocument provider with multiple-view support in the isolated developer profile."],
    ["F05-H02", "Actual open command produces TabInputCustom and masked native HTML without opening any original TextDocument."],
    ["F05-H03", "Scripted native confirmation gates one-field payload; real ten-second hiding and all-value safe-reader masking hold."],
    ["F05-H04", "Native split creates two custom tabs sharing one CustomDocument, and only the initiating real panel receives a revealed value."],
    ["F05-H05", "Private password edit emits a real custom edit event; native Undo/Redo/Save preserve unrelated bytes and clean the saved custom tab."],
    ["F05-H06", "Native close/reopen retains the saved private value while default panels and original TextDocument count remain masked/zero."],
    ["F05-H07", "Actual workbench backup for the final dirty revision produces issued authenticated ciphertext, with native SecretStorage calls and hot-exit enabled."]
  ];
  const observations = declarations.map(([id, scope]) => ({ id, scope, status: "NOT_RUN" }));
  let runtime = "", bundle = "", root = "", driverFailure;
  let config, oldFlag;
  let oldHotExit, oldAutoSave, restoredIdObservedBeforeClose;
  const evidence = {};
  const check = async (id, action) => {
    const row = observations.find((item) => item.id === id);
    try {
      await action();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      row.diagnostic = error instanceof Error ? error.name : "UnknownFailure";
    }
    console.log(`LITE_SECURE_EDITOR_HOST ${phase} ${id} ${row.status}`);
  };
  try {
    import_strict.default.ok(installed && hookedContext === context, "Pre-activation and runtime must share the actual extension context.");
    import_strict.default.ok(phase === "save" || phase === "reload");
    import_strict.default.ok(profile && (0, import_node_path.isAbsolute)(profile));
    import_strict.default.equal((0, import_node_path.resolve)(process.env.USERPROFILE ?? ""), (0, import_node_path.resolve)(profile));
    import_strict.default.equal(context.extensionMode, vscode.ExtensionMode.Development);
    import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
    import_strict.default.ok(vscode.workspace.isTrusted);
    const folder = vscode.workspace.workspaceFolders[0];
    root = folder.uri.fsPath;
    import_strict.default.equal(folder.uri.scheme, "file");
    import_strict.default.equal(await (0, import_promises.readFile)((0, import_node_path.join)(root, MARKER), "utf8"), "synthetic-only-v1");
    const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
    import_strict.default.ok(extension?.isActive);
    bundle = (0, import_node_path.join)(extension.extensionPath, "dist", "extension.js");
    runtime = sha(await (0, import_promises.readFile)(bundle));
    import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F05_BUNDLE_SHA256);
    import_strict.default.ok(registeredProvider);
    config = vscode.workspace.getConfiguration("soterai");
    oldFlag = config.inspect(FLAG)?.globalValue;
    const files = vscode.workspace.getConfiguration("files");
    oldHotExit = files.inspect("hotExit")?.globalValue;
    oldAutoSave = files.inspect("autoSave")?.globalValue;
    const readSafely = async () => {
      const result2 = await vscode.commands.executeCommand("soterai.readProjectFileSafely", sourceUri());
      import_strict.default.equal(result2.status, "ALLOWED_ONCE");
      import_strict.default.equal(result2.text, SAFE);
      noValues(result2.text);
    };
    const nativeOpen = async () => {
      const result2 = await vscode.commands.executeCommand("soterai.openSecureEditor", sourceUri(), { reveal: true, approved: true, value: "ignored" });
      import_strict.default.deepEqual(result2, { status: "OPENED" });
      await until(() => tabs().length > 0 && currentViews().length > 0 && !!currentViews().at(-1)?.listener);
      noSourceDocuments();
      const view = currentViews().at(-1);
      masked(view);
      return view;
    };
    const reveal = async (view, expected) => {
      const before = view.messages.length, modalBefore = nativeModalCalls, requested = binding(view);
      let stage = "send-request";
      try {
        await send(view, "reveal");
        stage = "wait-for-owner-message";
        await until(() => view.messages.length > before);
        const sent = view.messages.at(-1);
        stage = "native-delivery";
        import_strict.default.equal(sent.delivered, true);
        stage = "exact-current-binding-and-value";
        import_strict.default.deepEqual(sent.value, { type: "owner-value", ...binding(view), value: expected });
        stage = "one-field-only";
        import_strict.default.ok(!JSON.stringify(sent.value).includes(API));
        import_strict.default.ok(!JSON.stringify(sent.value).includes(COMMENT));
        stage = "masked-default-and-no-source-document";
        masked(view);
        noSourceDocuments();
      } catch (error) {
        let current;
        try {
          current = binding(view);
        } catch {
        }
        const sent = view.messages.length > before ? view.messages.at(-1) : void 0;
        const value = sent?.value && typeof sent.value === "object" ? sent.value : void 0;
        const failures = Array.isArray(evidence.revealFailures) ? evidence.revealFailures : [];
        failures.push({
          stage,
          bindingReadable: current !== void 0,
          requestedRevision: requested.revision,
          currentRevision: current?.revision,
          sameSession: current?.session === requested.session,
          sameField: current?.field === requested.field,
          visible: view.panel.visible,
          disposed: view.disposed,
          modalCallsBefore: modalBefore,
          modalCallsAfter: nativeModalCalls,
          receivedBefore: before,
          receivedAfter: view.messages.length,
          delivered: sent?.delivered ?? false,
          postedSessionMatchesCurrent: !!current && value?.session === current.session,
          postedRevisionMatchesCurrent: !!current && value?.revision === current.revision,
          expectedValueDigest: sha(expected),
          postedValueDigest: typeof value?.value === "string" ? sha(value.value) : void 0
        });
        evidence.revealFailures = failures;
        throw error;
      }
    };
    const nativeSave = async () => {
      const count = saveCalls;
      await bounded(vscode.commands.executeCommand("workbench.action.files.save"));
      await until(() => saveCalls > count && tabs().every((tab) => !tab.isDirty));
      noSourceDocuments();
    };
    const inspectBackup = async (id) => {
      import_strict.default.ok(context.storageUri && (0, import_node_path.dirname)((0, import_node_path.resolve)(id)) === (0, import_node_path.resolve)(context.storageUri.fsPath));
      const issued = context.workspaceState.keys().filter((key) => key.startsWith(RECORD_PREFIX)).map((key) => context.workspaceState.get(key)).find((record) => record?.id === id);
      import_strict.default.ok(issued && issued.schemaVersion === 1);
      import_strict.default.equal(issued.source, sourceUri().toString());
      import_strict.default.equal(issued.root, folder.uri.toString());
      import_strict.default.match(issued.keyId, /^soterai\.lite\.secureEditor\.recovery\.[0-9a-f-]{36}$/);
      const bytes = await (0, import_promises.readFile)(id);
      import_strict.default.ok(bytes.length <= 512 * 1024);
      import_strict.default.equal(sha(bytes), issued.digest);
      const text = bytes.toString("utf8");
      noValues(text);
      const envelope = JSON.parse(text);
      import_strict.default.equal(envelope.source, issued.source);
      import_strict.default.equal(envelope.root, issued.root);
      import_strict.default.equal(envelope.keyId, issued.keyId);
      import_strict.default.equal(Buffer.from(envelope.nonce, "base64").length, 12);
      import_strict.default.equal(Buffer.from(envelope.tag, "base64").length, 16);
      import_strict.default.equal(Object.hasOwn(envelope, "key"), false);
      import_strict.default.equal(Object.hasOwn(envelope, "savedText"), false);
      import_strict.default.equal(Object.hasOwn(envelope, "draftText"), false);
      return issued;
    };
    if (phase === "save") {
      let primary;
      await check("F05-H01", async () => {
        import_strict.default.equal(multipleEditors, true);
        import_strict.default.ok(registeredProvider);
        import_strict.default.equal(sourceDocumentCalls, 0);
        import_strict.default.equal(sourceDocumentEvents, 0);
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        await files.update("hotExit", "onExitAndWindowClose", vscode.ConfigurationTarget.Global);
        await files.update("autoSave", "off", vscode.ConfigurationTarget.Global);
        await (0, import_promises.writeFile)(sourceUri().fsPath, SOURCE, { flag: "wx" });
        evidence.sourceInitialDigest = sha(SOURCE);
        evidence.nativeCustomProviderRegistered = true;
      });
      await check("F05-H02", async () => {
        primary = await nativeOpen();
        import_strict.default.equal(tabs().length, 1);
        const tab = tabs()[0];
        import_strict.default.ok(tab.input instanceof vscode.TabInputCustom);
        import_strict.default.equal(tab.input.viewType, VIEW_TYPE);
        import_strict.default.equal(originalSourceOpenCount(), 0);
        import_strict.default.ok(primary.panel.webview.html.includes("DATABASE_URL"));
        evidence.defaultHtmlDigest = sha(primary.panel.webview.html);
        evidence.originalTextDocumentsZero = true;
      });
      await check("F05-H03", async () => {
        import_strict.default.ok(primary);
        const before = primary.messages.length, prompts = nativeModalCalls;
        revealApproval = false;
        await send(primary, "reveal");
        import_strict.default.equal(primary.messages.length, before);
        import_strict.default.ok(nativeModalCalls > prompts);
        revealApproval = true;
        const started = performance.now();
        await reveal(primary, URL);
        const html = primary.panel.webview.html;
        await readSafely();
        await until(() => primary.panel.webview.html !== html, 12e3);
        import_strict.default.ok(performance.now() - started >= 1e4, "A real ten-second hide timer must run.");
        masked(primary);
        evidence.realRevealHideTimerObserved = true;
      });
      await check("F05-H04", async () => {
        import_strict.default.ok(primary);
        primary.panel.reveal(vscode.ViewColumn.One, false);
        await bounded(vscode.commands.executeCommand("workbench.action.splitEditorRight"));
        await until(() => tabs().length === 2 && currentViews().length === 2);
        const sibling = currentViews().find((view) => view !== primary);
        import_strict.default.equal(sibling.document, primary.document);
        import_strict.default.notEqual(binding(sibling).session, binding(primary).session);
        masked(primary);
        masked(sibling);
        const otherCount = primary.messages.length;
        await reveal(sibling, URL);
        import_strict.default.equal(primary.messages.length, otherCount);
        await send(sibling, "hide");
        masked(sibling);
        noSourceDocuments();
        primary = sibling;
        evidence.nativeSplitSharedDocument = true;
        evidence.revealRecipientPanelOnly = true;
      });
      await check("F05-H05", async () => {
        import_strict.default.ok(primary);
        primary.panel.reveal(primary.panel.viewColumn, false);
        input = NEW_URL;
        const changed = editEvents, initialRevision = binding(primary).revision;
        await send(primary, "edit");
        await until(() => editEvents > changed && tabs().some((tab) => tab.isDirty));
        import_strict.default.ok(inputCalls > 0);
        import_strict.default.ok(binding(primary).revision > initialRevision);
        for (const view of currentViews()) masked(view);
        import_strict.default.equal(sha(await (0, import_promises.readFile)(sourceUri().fsPath)), sha(SOURCE));
        const beforeUndo = binding(primary).revision;
        await bounded(vscode.commands.executeCommand("undo"));
        await until(() => binding(primary).revision > beforeUndo && tabs().every((tab) => !tab.isDirty));
        const beforeRedo = binding(primary).revision;
        await bounded(vscode.commands.executeCommand("redo"));
        await until(() => binding(primary).revision > beforeRedo && tabs().some((tab) => tab.isDirty));
        await nativeSave();
        import_strict.default.equal(sha(await (0, import_promises.readFile)(sourceUri().fsPath)), sha(SAVED));
        for (const view of currentViews()) masked(view);
        evidence.nativeUndoRedoSaveObserved = true;
        evidence.savedSourceDigest = sha(SAVED);
      });
      await check("F05-H06", async () => {
        const oldDocument = primary?.document, before = opens.length;
        import_strict.default.ok(await vscode.window.tabGroups.close(tabs(), true));
        await until(() => currentViews().length === 0 && tabs().length === 0);
        primary = await nativeOpen();
        import_strict.default.ok(opens.length > before);
        import_strict.default.notEqual(primary.document, oldDocument);
        await reveal(primary, NEW_URL);
        await send(primary, "hide");
        await readSafely();
        masked(primary);
        noSourceDocuments();
        evidence.nativeCloseReopenObserved = true;
      });
      await check("F05-H07", async () => {
        import_strict.default.ok(primary);
        input = DRAFT_URL;
        const before = editEvents;
        await send(primary, "edit");
        await until(() => editEvents > before && tabs().some((tab) => tab.isDirty));
        const revision = binding(primary).revision;
        await until(() => {
          const currentDocumentRows = backups.filter((row) => row.document === primary.document && row.source === sourceUri().toString());
          const currentRevisionRows = currentDocumentRows.filter((row) => row.revision === revision);
          const completedRows = currentRevisionRows.filter((row) => !!row.id && !row.failed);
          evidence.finalDirtyNativeBackupMatch = {
            revision,
            observedBackupRows: backups.length,
            currentDocumentRows: currentDocumentRows.length,
            currentRevisionRows: currentRevisionRows.length,
            completedMatchingRows: completedRows.length
          };
          return completedRows.length > 0;
        }, 2e4);
        const observed = backups.filter((row) => row.document === primary.document && row.source === sourceUri().toString() && row.revision === revision && row.id && !row.failed);
        evidence.nativeBackupInspectionStage = "inspect-issued-backup";
        const issued = await inspectBackup(observed.at(-1).id);
        evidence.nativeBackupInspectionStage = "verified-key-api-counts";
        import_strict.default.ok(secretStores > 0 && secretGets >= secretStores);
        evidence.nativeBackupInspectionStage = "saved-source-digest";
        import_strict.default.equal(sha(await (0, import_promises.readFile)(sourceUri().fsPath)), sha(SAVED));
        evidence.nativeBackupInspectionStage = "fresh-hot-exit-settings";
        const currentFiles = vscode.workspace.getConfiguration("files");
        evidence.hotExitMatchesExpected = currentFiles.get("hotExit") === "onExitAndWindowClose";
        evidence.autoSaveMatchesExpected = currentFiles.get("autoSave") === "off";
        import_strict.default.equal(currentFiles.get("hotExit"), "onExitAndWindowClose");
        import_strict.default.equal(currentFiles.get("autoSave"), "off");
        evidence.nativeBackupInspectionStage = "masked-panels-and-zero-source-documents";
        noSourceDocuments();
        for (const view of currentViews()) masked(view);
        const receipt = {
          schemaVersion: 1,
          runtime,
          profile: (0, import_node_path.resolve)(profile),
          workspace: root,
          sourceSavedDigest: sha(SAVED),
          expectedDraftDigest: sha(DRAFT),
          nativeBackupIdDigests: observed.map((row) => sha(row.id)),
          observedBackupCiphertextDigest: issued.digest,
          privateDraftKeptDirtyForHotExit: true
        };
        evidence.nativeBackupInspectionStage = "write-hot-exit-receipt";
        await (0, import_promises.writeFile)((0, import_node_path.join)(root, RECEIPT), JSON.stringify(receipt) + "\n", { flag: "wx" });
        evidence.nativeBackupInspectionStage = "complete";
        evidence.nativeBackupForFinalDirtyRevision = true;
        evidence.backupCiphertextDigest = issued.digest;
        evidence.actualNativeHotExitPending = true;
      });
    } else {
      const receipt = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(root, RECEIPT), "utf8"));
      let primary;
      await check("F05-H08", async () => {
        import_strict.default.equal(receipt.runtime, runtime);
        import_strict.default.equal(receipt.profile, (0, import_node_path.resolve)(profile));
        import_strict.default.equal(receipt.workspace, root);
        import_strict.default.equal(receipt.sourceSavedDigest, sha(SAVED));
        import_strict.default.equal(receipt.expectedDraftDigest, sha(DRAFT));
        await until(() => opens.some((row) => isSource(row.document.uri) && !!row.backupId) && currentViews().length > 0 && tabs().some((tab) => tab.isDirty), 2e4);
        const restored = opens.find((row) => isSource(row.document.uri) && row.backupId);
        const issued = await inspectBackup(restored.backupId);
        restoredIdObservedBeforeClose = receipt.nativeBackupIdDigests.includes(sha(restored.backupId));
        primary = currentViews().find((view) => view.document === restored.document);
        import_strict.default.ok(primary);
        masked(primary);
        noSourceDocuments();
        await reveal(primary, DRAFT_URL);
        await send(primary, "hide");
        evidence.workbenchSuppliedNativeRecoveryId = true;
        evidence.restoredCiphertextDigest = issued.digest;
        evidence.recoveredDraftOwnerValueMatched = true;
      });
      await check("F05-H09", async () => {
        import_strict.default.ok(primary);
        recoveryApproval = true;
        primary.panel.reveal(primary.panel.viewColumn, false);
        await nativeSave();
        import_strict.default.equal(sha(await (0, import_promises.readFile)(sourceUri().fsPath)), sha(DRAFT));
        await readSafely();
        masked(primary);
        noSourceDocuments();
        evidence.recoveredSavedDigest = sha(DRAFT);
      });
      await check("F05-H10", async () => {
        import_strict.default.ok(primary);
        input = NEW_URL;
        await send(primary, "edit");
        await until(() => tabs().some((tab) => tab.isDirty));
        await reveal(primary, NEW_URL);
        const before = primary.messages.length, beforeInput = inputCalls;
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        await wait(100);
        for (const view of currentViews()) masked(view);
        await send(primary, "reveal");
        await send(primary, "edit");
        import_strict.default.equal(primary.messages.length, before);
        import_strict.default.equal(inputCalls, beforeInput);
        import_strict.default.deepEqual(await vscode.commands.executeCommand("soterai.openSecureEditor", sourceUri()), { status: "UNAVAILABLE" });
        const failed = saveFailures;
        await bounded(vscode.commands.executeCommand("workbench.action.files.save")).catch(() => void 0);
        await until(() => saveFailures > failed);
        import_strict.default.equal(sha(await (0, import_promises.readFile)(sourceUri().fsPath)), sha(DRAFT));
        import_strict.default.ok(tabs().some((tab) => tab.isDirty));
        await readSafely();
        noSourceDocuments();
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        await nativeSave();
        import_strict.default.equal(sha(await (0, import_promises.readFile)(sourceUri().fsPath)), sha(SAVED));
        evidence.machineWithdrawalWithheldNativeSave = true;
        evidence.safeReaderRetainedAllValueMasking = true;
      });
    }
  } catch (error) {
    driverFailure = error instanceof Error ? error.name : "UnknownFailure";
  } finally {
    if (config && phase === "reload") {
      try {
        await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global);
        const files = vscode.workspace.getConfiguration("files");
        await files.update("hotExit", oldHotExit, vscode.ConfigurationTarget.Global);
        await files.update("autoSave", oldAutoSave, vscode.ConfigurationTarget.Global);
      } catch (error) {
        driverFailure ??= error instanceof Error ? error.name : "UnknownFailure";
      }
    }
    for (const listener of listeners.splice(0)) listener.dispose();
    for (const restore of restorePatches.reverse()) {
      try {
        restore();
      } catch {
        driverFailure ??= "PatchRestorationFailure";
      }
    }
  }
  let currentRuntime, hostProbeSha256;
  try {
    currentRuntime = bundle ? sha(await (0, import_promises.readFile)(bundle)) : void 0;
    hostProbeSha256 = sha(await (0, import_promises.readFile)(__filename));
  } catch (error) {
    driverFailure ??= error instanceof Error ? error.name : "UnknownFailure";
  }
  const result = {
    schemaVersion: 1,
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    phase,
    syntheticOnly: true,
    workspace: root,
    declaredProfilePath: profile ? (0, import_node_path.resolve)(profile) : void 0,
    hostVersion: vscode.version,
    extensionBundleSha256: runtime,
    currentDeveloperBundleSha256: currentRuntime,
    hostProbeSha256,
    observations,
    evidence,
    driverFailure,
    sourceDocumentCalls,
    sourceDocumentEvents,
    nativeOpenCalls: opens.length,
    nativeResolvedPanels: views.length,
    nativeEditEvents: editEvents,
    nativeSaveCalls: saveCalls,
    nativeSaveFailures: saveFailures,
    nativeBackupCalls: backups.length,
    nativeBackupFailures: backups.filter((row) => row.failed).length,
    nativeSecretStorageStores: secretStores,
    nativeSecretStorageGets: secretGets,
    scriptedNativeModalCalls: nativeModalCalls,
    scriptedPasswordInputCalls: inputCalls,
    restoredIdObservedBeforeClose,
    passed: observations.filter((row) => row.status === "PASS").length,
    failed: observations.filter((row) => row.status === "FAIL").length + (driverFailure ? 1 : 0),
    notRun: observations.filter((row) => row.status === "NOT_RUN").length,
    actualNativeHotExitPending: phase === "save" && observations.every((row) => row.status === "PASS"),
    identityScope: "Byte-identical packaged runtime, actual persistent developer context, native CustomDocument/WebviewPanel/TabInputCustom/workbench operations. Not clean-profile install proof.",
    interactionScope: "Actual registered native-panel listener and native modal/password API arguments with scripted same-instance owner decisions; no browser DOM automation or human owner-presence proof.",
    recoveryScope: "Save phase observes actual workbench backup; reload independently requires workbench-supplied issued backupId. Final closing backup may be generated after the save-phase probe. No manual-provider backup/restoration fallback is counted as native recovery.",
    custodyScope: "Synthetic isolated native SecretStorage store/get use; not independent OS custody certification.",
    independence: "LOW",
    ownerPresence: "SCRIPTED_SAME_EXTENSION_API_INSTANCE",
    externalAgents: "NOT_TESTED"
  };
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || result.notRun || currentRuntime !== runtime) throw new Error("F05 native host failed or incomplete; inspect retained observation IDs.");
}
function originalSourceOpenCount() {
  return sourceDocumentCalls + sourceDocumentEvents;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run
});
