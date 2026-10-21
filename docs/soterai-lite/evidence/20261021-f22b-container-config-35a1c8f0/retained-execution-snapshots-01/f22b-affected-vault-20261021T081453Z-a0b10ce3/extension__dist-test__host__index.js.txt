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

// packages/vscode-extension/src/__tests__/host/liteVault.host.ts
var liteVault_host_exports = {};
__export(liteVault_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(liteVault_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_node_fs = require("node:fs");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var FLAG = "lite.vaultMode";
var KEY_ID = "soterai.vaultKey";
var RULES_KEY = "soterai.aiForbidden.v1";
var MARKER = ".synthetic-lite-f06-host";
var RECEIPT = ".lite-f06-save-receipt.json";
var URL = "postgresql://fake:synthetic-only@f06-native.invalid/quoted-database";
var CRASH_URL = "postgresql://fake:synthetic-only@f06-crash.invalid/quoted-database";
var API = "sk-proj-" + "SYNTHETIC_F06_NATIVE_FAKE_CREDENTIAL".repeat(3);
var PRIVATE = "SYNTHETIC_F06_NATIVE_MULTILINE_PRIVATE_VALUE_20261014";
var SOURCE = `DATABASE_URL = '${URL}'\r
API_KEY=${API}\r
TOKEN="first\r
${PRIVATE}=inside-value\r
last"\r
`;
var CRASH_SOURCE = SOURCE.replace(URL, CRASH_URL);
var SAFE = "DATABASE_URL=[MASKED]\nAPI_KEY=[MASKED]\nTOKEN=[MASKED]";
var sha = (bytes) => (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
var restores = [];
var listeners = [];
var setupPatch = { phase: "initial" };
function setupDiagnostic() {
  return { ...setupPatch };
}
var reviews = [];
var messages = [];
var hookedContext;
var installed = false;
var migrationApproval = true;
var recoveryApproval = true;
var rawApproval = true;
var secretStores = 0;
var secretGets = 0;
var restoredCanonicalKeyObserved = false;
var sourceDocumentCalls = 0;
var sourceDocumentEvents = 0;
function noValues(text) {
  for (const value of [SOURCE, CRASH_SOURCE, URL, CRASH_URL, API, PRIVATE]) import_strict.default.ok(!text.includes(value), "Original synthetic values must remain outside metadata and safe-read sinks.");
}
function within(base, target) {
  const result = (0, import_node_path.relative)((0, import_node_path.resolve)(base), (0, import_node_path.resolve)(target));
  return result === "" || !result.startsWith("..") && !(0, import_node_path.isAbsolute)(result);
}
function folder() {
  const value = vscode.workspace.workspaceFolders?.[0];
  import_strict.default.ok(value);
  return value;
}
function sourceUri(name = ".env.host") {
  return vscode.Uri.joinPath(folder().uri, name);
}
function isSource(value) {
  return value instanceof vscode.Uri && [sourceUri().toString(), sourceUri(".env.crash").toString()].includes(value.toString());
}
function replace(target, name, value) {
  const own = Object.getOwnPropertyDescriptor(target, name);
  setupPatch = {
    phase: "replace",
    name,
    frozen: Object.isFrozen(target),
    extensible: Object.isExtensible(target),
    own: !!own,
    configurable: own?.configurable,
    writable: own && "writable" in own ? own.writable : void 0
  };
  Object.defineProperty(target, name, { configurable: true, enumerable: own?.enumerable ?? false, writable: true, value });
  restores.push(() => {
    if (own) Object.defineProperty(target, name, own);
    else Reflect.deleteProperty(target, name);
  });
}
async function files(directory, storageRoot) {
  import_strict.default.ok(within(storageRoot, directory));
  const result = [];
  for (const entry of await (0, import_promises.readdir)(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  })) {
    const target = (0, import_node_path.join)(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(target, storageRoot));
    else if (entry.isFile()) result.push(target);
  }
  return result;
}
async function vaultSnapshot(storage) {
  const managed = (await files(storage, storage)).filter((file) => /^vault-|^soterai-vault\./.test((0, import_node_path.basename)(file)) && !/lock/i.test((0, import_node_path.basename)(file)));
  return Object.fromEntries(await Promise.all(managed.map(async (file) => [(0, import_node_path.relative)(storage, file), sha(await (0, import_promises.readFile)(file))])));
}
function noSourceDocuments() {
  import_strict.default.equal(sourceDocumentCalls, 0);
  import_strict.default.equal(sourceDocumentEvents, 0);
  import_strict.default.equal(vscode.workspace.textDocuments.filter((document) => isSource(document.uri)).length, 0);
}
function beforeActivate(context) {
  import_strict.default.equal(installed, false);
  installed = true;
  hookedContext = context;
  const profile = process.env.SOTERAI_LITE_F06_PROFILE;
  import_strict.default.ok(profile && (0, import_node_path.isAbsolute)(profile));
  import_strict.default.equal((0, import_node_path.resolve)(process.env.USERPROFILE ?? ""), (0, import_node_path.resolve)(profile));
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  import_strict.default.equal(folder().uri.scheme, "file");
  import_strict.default.match((0, import_node_path.resolve)(folder().uri.fsPath), /^D:\\/i);
  import_strict.default.match((0, import_node_path.resolve)(profile), /^D:\\/i);
  import_strict.default.equal((0, import_node_fs.readFileSync)((0, import_node_path.join)(folder().uri.fsPath, MARKER), "utf8"), "synthetic-only-v1");
  import_strict.default.ok(!within(folder().uri.fsPath, context.globalStorageUri.fsPath));
  import_strict.default.ok(within(profile, context.globalStorageUri.fsPath), "Global extension storage must stay in the launcher-owned isolated profile.");
  const nativeGet = context.secrets.get, nativeStore = context.secrets.store;
  replace(context.secrets, "get", async (key) => {
    const value = await nativeGet.call(context.secrets, key);
    if (key === KEY_ID) {
      secretGets++;
      if (value !== void 0) {
        import_strict.default.match(value, /^[A-Za-z0-9+/]{43}=$/);
        import_strict.default.equal(Buffer.from(value, "base64").length, 32);
        import_strict.default.equal(Buffer.from(value, "base64").toString("base64"), value);
        restoredCanonicalKeyObserved = true;
      }
    }
    return value;
  });
  replace(context.secrets, "store", async (key, value) => {
    if (key === KEY_ID) {
      secretStores++;
      import_strict.default.match(value, /^[A-Za-z0-9+/]{43}=$/);
      import_strict.default.equal(Buffer.from(value, "base64").length, 32);
    }
    return nativeStore.call(context.secrets, key, value);
  });
  const nativeOpen = vscode.workspace.openTextDocument;
  replace(vscode.workspace, "openTextDocument", (...args) => {
    if (isSource(args[0])) sourceDocumentCalls++;
    return Reflect.apply(nativeOpen, vscode.workspace, args);
  });
  listeners.push(vscode.workspace.onDidOpenTextDocument((document) => {
    if (isSource(document.uri)) sourceDocumentEvents++;
  }));
  replace(vscode.window, "showWarningMessage", async (message, ...items) => {
    noValues(message);
    const options = items[0];
    if (options?.detail) noValues(options.detail);
    const action = items.find((item) => ["Migrate securely", "Complete safe recovery", "Restore raw values", "Allow safe read once"].includes(item));
    if (typeof action !== "string") {
      messages.push({ surface: "warning", safe: true });
      return void 0;
    }
    reviews.push({ action, modal: options?.modal === true, detailBytes: Buffer.byteLength(options?.detail ?? "", "utf8"), detailSafe: true });
    import_strict.default.equal(options?.modal, true);
    if (action === "Migrate securely") return migrationApproval ? action : void 0;
    if (action === "Complete safe recovery") return recoveryApproval ? action : void 0;
    if (action === "Restore raw values") return rawApproval ? action : void 0;
    return action;
  });
  for (const name of ["showInformationMessage", "showErrorMessage"]) replace(vscode.window, name, async (message) => {
    noValues(message);
    messages.push({ surface: name, safe: true });
    return void 0;
  });
}
async function run(context) {
  const phase = process.env.SOTERAI_LITE_F06_PHASE, output = process.env.SOTERAI_LITE_F06_EVIDENCE, profile = process.env.SOTERAI_LITE_F06_PROFILE;
  if (!output || !(0, import_node_path.isAbsolute)(output)) throw new Error("New absolute F06 evidence output required.");
  const scopes = phase === "reload" ? [
    ["F06-H07", "Native restart retains genuine pending checkpoint and verified SecretStorage key; registered recovery completes the masked crash file."],
    ["F06-H08", "Fresh explicit raw-disclosure approval restores the bound original backup and quoted multiline placeholder content byte for byte."],
    ["F06-H09", "Machine withdrawal withholds every registered vault mutation and preserves source bytes and existing ciphertext."],
    ["F06-H10", "Persistent sensitive restrictions survive restart and raw restoration; managed safe reads still mask every value without original TextDocuments."]
  ] : [
    ["F06-H01", "Native manager-owned cancellation creates no vault data, key or changed source file."],
    ["F06-H02", "Actual registered migration replaces quoted database, API and multiline values on disk after native metadata review."],
    ["F06-H03", "Safe example has blank unique names; actual native encrypted vault and issued generation remain outside the project."],
    ["F06-H04", "Managed safe-reader output remains names-only and masked after optional migration."],
    ["F06-H05", "Raw-restore cancellation retains source placeholders and ciphertext with no disclosure."],
    ["F06-H06", "A real native source-write fault leaves an issued encrypted pending checkpoint and original source intact for native restart."]
  ];
  const observations = scopes.map(([id, scope]) => ({ id, scope, status: "NOT_RUN" }));
  const evidence = {}, commandStatuses = [];
  let runtime = "", bundle = "", root = "", storage = "", driverFailure, stage = "setup";
  let config, oldFlag;
  const check = async (id, action) => {
    const row = observations.find((item) => item.id === id);
    stage = id;
    try {
      await action();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      row.diagnostic = `${error instanceof Error ? error.name : "UnknownFailure"} at ${stage}`;
    }
    console.log(`LITE_VAULT_HOST ${phase} ${id} ${row.status}`);
  };
  try {
    import_strict.default.equal(hookedContext, context);
    import_strict.default.ok(installed);
    import_strict.default.ok(phase === "save" || phase === "reload");
    import_strict.default.ok(profile && (0, import_node_path.isAbsolute)(profile));
    import_strict.default.equal((0, import_node_path.resolve)(process.env.USERPROFILE ?? ""), (0, import_node_path.resolve)(profile));
    import_strict.default.equal(process.env.SOTERAI_LITE_F06_DRIVER_KIND, "native-bootstrap");
    import_strict.default.equal(context.extensionMode, vscode.ExtensionMode.Development);
    import_strict.default.ok(vscode.workspace.isTrusted);
    root = folder().uri.fsPath;
    storage = context.globalStorageUri.fsPath;
    import_strict.default.equal(await (0, import_promises.readFile)((0, import_node_path.join)(root, MARKER), "utf8"), "synthetic-only-v1");
    const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
    import_strict.default.ok(extension && extension.isActive);
    bundle = (0, import_node_path.join)(extension.extensionPath, "dist", "extension.js");
    runtime = sha(await (0, import_promises.readFile)(bundle));
    import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F06_BUNDLE_SHA256);
    config = vscode.workspace.getConfiguration("soterai");
    oldFlag = config.inspect(FLAG)?.globalValue;
    const command = async (id, target = sourceUri()) => {
      const current = vscode.workspace.getConfiguration("soterai"), inspected = current.inspect(FLAG);
      evidence.nativeGuardMetadata = {
        trusted: vscode.workspace.isTrusted,
        flagGet: current.get(FLAG),
        flagDefault: inspected?.defaultValue,
        flagGlobal: inspected?.globalValue,
        globalStorageScheme: context.globalStorageUri.scheme,
        storageAuthorityPresent: !!context.globalStorageUri.authority,
        storageQueryPresent: !!context.globalStorageUri.query,
        storageFragmentPresent: !!context.globalStorageUri.fragment
      };
      const result2 = await vscode.commands.executeCommand(id, target);
      commandStatuses.push({ command: id, reportedStatus: result2?.status ?? "VOID", completed: true });
      return result2;
    };
    const readSafely = async (target = sourceUri()) => {
      const result2 = await vscode.commands.executeCommand("soterai.readProjectFileSafely", target);
      commandStatuses.push({ command: "soterai.readProjectFileSafely", reportedStatus: result2.status, completed: true });
      import_strict.default.equal(result2.status, "ALLOWED_ONCE");
      import_strict.default.equal(result2.kind, "environment-schema");
      import_strict.default.equal(result2.text, SAFE);
      noValues(result2.text);
      noSourceDocuments();
    };
    const blankExample = async () => {
      const text = await (0, import_promises.readFile)((0, import_node_path.join)(root, ".env.example"), "utf8");
      noValues(text);
      import_strict.default.equal(text, "DATABASE_URL=\nAPI_KEY=\nTOKEN=\n");
      return sha(text);
    };
    const encryptedStorage = async () => {
      const managed = await vaultSnapshot(storage);
      import_strict.default.ok(Object.keys(managed).some((name) => (0, import_node_path.basename)(name) === "soterai-vault.enc"));
      import_strict.default.ok(Object.keys(managed).some((name) => /^vault-generation-.+\.enc$/.test((0, import_node_path.basename)(name))));
      for (const file of await files(storage, storage)) noValues((await (0, import_promises.readFile)(file)).toString("utf8"));
      return managed;
    };
    const pending = async () => {
      const text = await (0, import_promises.readFile)((0, import_node_path.join)(storage, "vault-pending.json"), "utf8");
      noValues(text);
      const value = JSON.parse(text);
      import_strict.default.equal(value.schemaVersion, 1);
      import_strict.default.equal(value.source, sourceUri(".env.crash").toString());
      import_strict.default.equal(value.root, folder().uri.toString());
      import_strict.default.match(value.id, /^[a-f0-9-]{36}$/i);
      import_strict.default.match(value.digest, /^[a-f0-9]{64}$/);
      const encrypted = await (0, import_promises.readFile)((0, import_node_path.join)(storage, `vault-generation-${value.id}.enc`));
      import_strict.default.equal(sha(encrypted), value.digest);
      noValues(encrypted.toString("utf8"));
      return value;
    };
    const restrictionMetadata = () => {
      const stored = context.workspaceState.get(RULES_KEY, {})[folder().uri.toString()];
      import_strict.default.ok(stored);
      const paths = stored.manual?.paths ?? stored.paths ?? [];
      for (const name of [".env.host", ".env.crash"]) import_strict.default.ok(paths.some((rule) => rule.pattern === name && rule.sensitive === true), "Actual saved sensitive restrictions must remain.");
      noValues(JSON.stringify(stored));
      return sha(JSON.stringify(paths));
    };
    if (phase === "save") {
      await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
      await (0, import_promises.writeFile)(sourceUri().fsPath, SOURCE, { flag: "wx" });
      await (0, import_promises.writeFile)(sourceUri(".env.crash").fsPath, CRASH_SOURCE, { flag: "wx" });
      await check("F06-H01", async () => {
        const before = await vaultSnapshot(storage), beforeStores = secretStores;
        migrationApproval = false;
        await command("soterai.migrateSecretsToVault");
        migrationApproval = true;
        import_strict.default.ok(await (0, import_promises.readFile)(sourceUri().fsPath, "utf8") === SOURCE);
        import_strict.default.deepEqual(await vaultSnapshot(storage), before);
        import_strict.default.equal(secretStores, beforeStores);
        import_strict.default.ok(reviews.some((review) => review.action === "Migrate securely"));
        noSourceDocuments();
        evidence.cancelledWithoutWrites = true;
      });
      await check("F06-H02", async () => {
        await command("soterai.migrateSecretsToVault");
        const masked = await (0, import_promises.readFile)(sourceUri().fsPath, "utf8");
        noValues(masked);
        import_strict.default.match(masked, /\[SOTERAI_PROTECTED_[A-Z0-9_]+\]/);
        import_strict.default.ok(secretStores > 0 && secretGets >= 2 && restoredCanonicalKeyObserved);
        evidence.migratedSourceDigest = sha(masked);
        evidence.actualVerifiedSecretStorageUse = true;
        noSourceDocuments();
      });
      await check("F06-H03", async () => {
        evidence.exampleDigest = await blankExample();
        evidence.encryptedVaultAndGenerationDigests = await encryptedStorage();
        import_strict.default.ok(!within(root, storage));
        const projectNames = await (0, import_promises.readdir)(root);
        import_strict.default.ok(!projectNames.some((name) => /\.bak$|backup|vault-generation|soterai-vault\.enc/i.test(name)));
        noSourceDocuments();
      });
      await check("F06-H04", async () => {
        await readSafely();
        evidence.maskedManagedReaderAfterMigration = true;
      });
      await check("F06-H05", async () => {
        const sourceBefore = await (0, import_promises.readFile)(sourceUri().fsPath), before = await vaultSnapshot(storage);
        rawApproval = false;
        await command("soterai.restoreSecretPlaceholders");
        await command("soterai.restoreFileFromBackup");
        rawApproval = true;
        import_strict.default.equal(sha(await (0, import_promises.readFile)(sourceUri().fsPath)), sha(sourceBefore));
        import_strict.default.deepEqual(await vaultSnapshot(storage), before);
        import_strict.default.ok(reviews.filter((review) => review.action === "Restore raw values").length >= 2);
        noSourceDocuments();
      });
      await check("F06-H06", async () => {
        const errorsBefore = messages.filter((message) => message.surface === "showErrorMessage").length;
        const crash = sourceUri(".env.crash");
        await (0, import_promises.chmod)(crash.fsPath, 292);
        try {
          import_strict.default.equal((await (0, import_promises.stat)(crash.fsPath)).mode & 128, 0, "Owned synthetic source must actually be read-only.");
          await command("soterai.migrateSecretsToVault", crash);
        } finally {
          await (0, import_promises.chmod)(crash.fsPath, 384);
        }
        import_strict.default.ok(messages.filter((message) => message.surface === "showErrorMessage").length > errorsBefore);
        import_strict.default.ok(await (0, import_promises.readFile)(sourceUri(".env.crash").fsPath, "utf8") === CRASH_SOURCE);
        const issued = await pending();
        const policyDigest = restrictionMetadata();
        await encryptedStorage();
        await blankExample();
        noSourceDocuments();
        const receipt = {
          schemaVersion: 1,
          runtime,
          profile: (0, import_node_path.resolve)(profile),
          workspace: root,
          globalStorage: storage,
          sourceMaskedDigest: sha(await (0, import_promises.readFile)(sourceUri().fsPath)),
          crashOriginalDigest: sha(CRASH_SOURCE),
          pendingDigest: sha(await (0, import_promises.readFile)((0, import_node_path.join)(storage, "vault-pending.json"))),
          generationId: issued.id,
          generationCiphertextDigest: issued.digest,
          restrictionPathDigest: policyDigest,
          vaultModeGlobalValue: vscode.workspace.getConfiguration("soterai").inspect(FLAG)?.globalValue
        };
        await (0, import_promises.writeFile)((0, import_node_path.join)(root, RECEIPT), JSON.stringify(receipt) + "\n", { flag: "wx" });
        evidence.genuinePendingCheckpointRetained = true;
        evidence.actualReadOnlySourceFailure = true;
        evidence.pendingGenerationId = issued.id;
        evidence.pendingCiphertextDigest = issued.digest;
      });
    } else {
      await check("F06-H07", async () => {
        const receipt = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(root, RECEIPT), "utf8"));
        noValues(JSON.stringify(receipt));
        import_strict.default.equal(receipt.runtime, runtime);
        import_strict.default.equal(receipt.profile, (0, import_node_path.resolve)(profile));
        import_strict.default.equal(receipt.workspace, root);
        import_strict.default.equal(receipt.globalStorage, storage);
        import_strict.default.equal(vscode.workspace.getConfiguration("soterai").inspect(FLAG)?.globalValue, receipt.vaultModeGlobalValue);
        import_strict.default.equal(sha(await (0, import_promises.readFile)((0, import_node_path.join)(storage, "vault-pending.json"))), receipt.pendingDigest);
        const issued = await pending();
        import_strict.default.equal(issued.id, receipt.generationId);
        import_strict.default.equal(issued.digest, receipt.generationCiphertextDigest);
        import_strict.default.equal(sha(await (0, import_promises.readFile)(sourceUri().fsPath)), receipt.sourceMaskedDigest);
        import_strict.default.equal(sha(await (0, import_promises.readFile)(sourceUri(".env.crash").fsPath)), receipt.crashOriginalDigest);
        import_strict.default.equal(restrictionMetadata(), receipt.restrictionPathDigest);
        const key = await context.secrets.get(KEY_ID);
        import_strict.default.ok(key);
        import_strict.default.ok(restoredCanonicalKeyObserved);
        import_strict.default.equal(secretStores, 0);
        await command("soterai.recoverVaultMigration", sourceUri(".env.crash"));
        noValues(await (0, import_promises.readFile)(sourceUri(".env.crash").fsPath, "utf8"));
        await import_strict.default.rejects((0, import_promises.readFile)((0, import_node_path.join)(storage, "vault-pending.json")));
        await blankExample();
        await encryptedStorage();
        await readSafely(sourceUri(".env.crash"));
        noSourceDocuments();
        evidence.realRestartCheckpointCompleted = true;
        evidence.existingNativeSecretStorageKeyRestored = true;
      });
      await check("F06-H08", async () => {
        rawApproval = true;
        await command("soterai.restoreFileFromBackup");
        await command("soterai.restoreSecretPlaceholders", sourceUri(".env.crash"));
        import_strict.default.ok(await (0, import_promises.readFile)(sourceUri().fsPath, "utf8") === SOURCE, "Bound backup restoration must preserve exact original quoting and multiline bytes.");
        import_strict.default.ok(await (0, import_promises.readFile)(sourceUri(".env.crash").fsPath, "utf8") === CRASH_SOURCE, "Placeholder restoration must preserve exact original quoting and multiline bytes.");
        import_strict.default.ok(reviews.filter((review) => review.action === "Restore raw values").length >= 2);
        await encryptedStorage();
        noSourceDocuments();
        evidence.explicitBoundBackupOriginalBytesMatched = true;
        evidence.explicitPlaceholderOriginalBytesMatched = true;
      });
      await check("F06-H09", async () => {
        const before = await vaultSnapshot(storage), hostBefore = sha(await (0, import_promises.readFile)(sourceUri().fsPath)), crashBefore = sha(await (0, import_promises.readFile)(sourceUri(".env.crash").fsPath));
        const beforeReviews = reviews.length;
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        for (const id of ["soterai.migrateSecretsToVault", "soterai.recoverVaultMigration", "soterai.restoreSecretPlaceholders", "soterai.restoreFileFromBackup"]) await command(id);
        import_strict.default.equal(reviews.length, beforeReviews);
        import_strict.default.deepEqual(await vaultSnapshot(storage), before);
        import_strict.default.equal(sha(await (0, import_promises.readFile)(sourceUri().fsPath)), hostBefore);
        import_strict.default.equal(sha(await (0, import_promises.readFile)(sourceUri(".env.crash").fsPath)), crashBefore);
        restrictionMetadata();
        noSourceDocuments();
        evidence.machineWithdrawalWithheldVaultCommands = true;
      });
      await check("F06-H10", async () => {
        const before = restrictionMetadata();
        await readSafely();
        await readSafely(sourceUri(".env.crash"));
        import_strict.default.equal(restrictionMetadata(), before);
        import_strict.default.ok(await (0, import_promises.readFile)(sourceUri().fsPath, "utf8") === SOURCE);
        noSourceDocuments();
        import_strict.default.ok(context.storageUri);
        const database = await (0, import_promises.stat)((0, import_node_path.join)((0, import_node_path.dirname)(context.storageUri.fsPath), "state.vscdb"));
        import_strict.default.ok(database.isFile() && database.size > 0);
        evidence.actualPersistentRestrictionMetadataPresent = true;
        evidence.rawRestoredSourceStillNamesOnlyForManagedReader = true;
      });
    }
  } catch (error) {
    driverFailure = `${error instanceof Error ? error.name : "UnknownFailure"} at ${stage}`;
  } finally {
    if (config && (phase === "reload" || driverFailure || observations.some((row) => row.status !== "PASS"))) {
      try {
        await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global);
      } catch {
        driverFailure ??= "IsolatedFlagRestorationFailure";
      }
    }
    for (const listener of listeners.splice(0)) listener.dispose();
    for (const restore of restores.reverse()) {
      try {
        restore();
      } catch {
        driverFailure ??= "PatchRestorationFailure";
      }
    }
  }
  let currentRuntime, hostProbeSha256;
  try {
    if (bundle) currentRuntime = sha(await (0, import_promises.readFile)(bundle));
    hostProbeSha256 = sha(await (0, import_promises.readFile)(__filename));
  } catch {
    driverFailure ??= "IdentityReadFailure";
  }
  const result = {
    schemaVersion: 1,
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    phase,
    syntheticOnly: true,
    workspace: root,
    declaredProfilePath: profile ? (0, import_node_path.resolve)(profile) : void 0,
    hostVersion: vscode.version,
    extensionMode: "Development",
    extensionBundleSha256: runtime,
    currentDeveloperBundleSha256: currentRuntime,
    hostProbeSha256,
    observations,
    evidence,
    driverFailure,
    commandStatuses,
    sourceDocumentCalls,
    sourceDocumentEvents,
    nativeSecretStorageStores: secretStores,
    nativeSecretStorageGets: secretGets,
    restoredCanonicalKeyObserved,
    nativeFaultKind: "Owned synthetic Windows read-only source file",
    scriptedNativeReviews: reviews,
    safeMessageCounts: messages,
    passed: observations.filter((row) => row.status === "PASS").length,
    failed: observations.filter((row) => row.status === "FAIL").length + (driverFailure ? 1 : 0),
    notRun: observations.filter((row) => row.status === "NOT_RUN").length,
    genuinePendingCheckpointRetainedForRestart: phase === "save" && observations.every((row) => row.status === "PASS"),
    identityScope: "Byte-identical packaged runtime and actual registered commands in an isolated persistent native developer context; not clean-profile installed-VSIX proof.",
    recoveryScope: "Actual native workspace source-write failure followed by native process restart and registered completion of the issued encrypted checkpoint; no reconstructed backup or plaintext fallback.",
    custodyScope: "Real isolated SecretStorage store/get/readback API observations only; no independent OS custody certification.",
    interactionScope: "Native modal API arguments with scripted same-instance decisions; no rendered modal usability or independent human-presence proof.",
    independence: "LOW",
    ownerPresence: "SCRIPTED_SAME_EXTENSION_API_INSTANCE",
    externalAgents: "NOT_TESTED"
  };
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || result.notRun || currentRuntime !== runtime) throw new Error("F06 native host failed or incomplete; inspect retained observation IDs.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
