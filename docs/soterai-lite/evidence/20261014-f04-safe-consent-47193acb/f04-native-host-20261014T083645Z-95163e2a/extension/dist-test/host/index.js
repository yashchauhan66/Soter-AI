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

// packages/vscode-extension/src/__tests__/host/liteSafeConsent.host.ts
var liteSafeConsent_host_exports = {};
__export(liteSafeConsent_host_exports, {
  run: () => run
});
module.exports = __toCommonJS(liteSafeConsent_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var FLAG = "lite.safeConsent";
var RULES_KEY = "soterai.aiForbidden.v1";
var MARKER = ".synthetic-lite-f04-host";
var RECEIPT = ".lite-f04-save-receipt.json";
var PRIVATE = "SYNTHETIC_F04_HOST_PRIVATE_COMMENT_NEVER_RELEASED_20261014";
var URL = "postgresql://synthetic:fake-only@f04-host.invalid/private-database";
var KEY = "sk-proj-" + "SYNTHETIC_F04_HOST_FAKE_CREDENTIAL".repeat(3);
var REGION = "SYNTHETIC_F04_HOST_PROTECTED_REGION_NEVER_RELEASED_20261014";
var SPOOF = "SYNTHETIC_F04_HOST_CALLER_SUPPLIED_DESTINATION";
var PUBLIC = "Useful F04 native public control.\n";
var ORDINARY = `Useful ordinary operation note. API_KEY=${KEY}
`;
var ENV_TEXT = `# ${PRIVATE}
DATABASE_URL=${URL}
API_KEY=${KEY}
PUBLIC_PORT=8080
MULTI="first
${PRIVATE}=inside-value
last"
`;
var ENV_SAFE = "DATABASE_URL=[MASKED]\nAPI_KEY=[MASKED]\nPUBLIC_PORT=[MASKED]\nMULTI=[MASKED]";
var REGION_TEXT = `Useful before. ${REGION} Useful after.
`;
var sha = (bytes) => (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
async function run(context) {
  const phase = process.env.SOTERAI_LITE_F04_PHASE, output = process.env.SOTERAI_LITE_F04_EVIDENCE;
  const profile = process.env.SOTERAI_LITE_F04_PROFILE;
  if (!output || !(0, import_node_path.isAbsolute)(output)) throw new Error("F04 requires an absolute new evidence output.");
  const scopes = phase === "reload" ? [
    ["F04-H09", "Same native profile/workspace/runtime retains policy metadata and a withdrawn machine flag; saved denies still withhold."],
    ["F04-H10", "After reload, re-enabling consent still requires exact masked approval and never removes the permanent ordinary deny."]
  ] : [
    ["F04-H01", "Cold synthetic policy enrollment reaches exact ordinary-file consent without creating a TextDocument before approval."],
    ["F04-H02", "Native modal detail exactly matches env/sensitive/protected-region output and contains no original sensitive values."],
    ["F04-H03", "Cancel and fabricated command arguments grant nothing and cannot set the destination, output, route or expiry."],
    ["F04-H04", "A real unanswered native modal expires after at least 60 seconds; its late response cannot release text."],
    ["F04-H05", "Explicit revoke resolves a pending read promptly; its late answer cannot grant or disturb a newer busy request."],
    ["F04-H06", "Machine withdrawal clears a real open approved view and withholds reads while restriction commands remain usable."],
    ["F04-H07", "Binary input and safe output above the 16 KiB UTF-8 limit reach no modal; the exact limit remains readable."],
    ["F04-H08", "Actual persistent policy and machine withdrawal are saved with runtime identity for the native restart probe."]
  ];
  const observations = scopes.map(([id, scope]) => ({ id, scope, status: "NOT_RUN" }));
  const commandStatuses = [];
  const modalMetadata = [];
  const messages = [], patches = [];
  let root = "", rootKey = "", runtime = "", bundle = "", driverFailure;
  let config, oldFlag;
  let documentListener;
  let documentCalls = 0, ownedDocumentEvents = 0, lastApproved, lastRedacted;
  let decision = async () => "Allow safe read once";
  let modalCount = 0;
  const sanitize = (error) => {
    let text = error instanceof Error ? `${error.name}: ${error.message}` : "UnknownFailure";
    for (const marker of [PRIVATE, URL, KEY, REGION, SPOOF]) text = text.replaceAll(marker, "[SYNTHETIC-CANARY-OMITTED]");
    return text.slice(0, 12e3);
  };
  const noValues = (text) => {
    for (const marker of [PRIVATE, URL, KEY, REGION]) import_strict.default.ok(!text.includes(marker), "Original sensitive values must remain withheld.");
  };
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const waitUntil = async (predicate, description, timeout = 5e3) => {
    const deadline = performance.now() + timeout;
    while (!predicate() && performance.now() < deadline) await wait(20);
    import_strict.default.ok(predicate(), description);
  };
  const bounded = async (work, ms = 3e3) => {
    let timer;
    try {
      return await Promise.race([work, new Promise((_done, reject) => {
        timer = setTimeout(() => reject(new Error("Native operation did not resolve within its scoped fixture deadline.")), ms);
      })]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const patch = (target, name, value) => {
    const record = target;
    patches.push({ target: record, name, original: record[name] });
    record[name] = value;
  };
  const check = async (id, action) => {
    const row = observations.find((item) => item.id === id);
    try {
      await action();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      row.diagnostic = sanitize(error);
    }
    console.log(`LITE_SAFE_CONSENT_HOST ${phase} ${id} ${row.status}`);
  };
  try {
    import_strict.default.ok(phase === "save" || phase === "reload", "Explicit save/reload phase required.");
    import_strict.default.ok(profile && (0, import_node_path.isAbsolute)(profile), "Launcher-declared isolated profile required.");
    import_strict.default.equal((0, import_node_path.resolve)(process.env.USERPROFILE ?? ""), (0, import_node_path.resolve)(profile), "Native process must use its isolated profile.");
    import_strict.default.equal(context.extensionMode, vscode.ExtensionMode.Development);
    import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
    const folder = vscode.workspace.workspaceFolders[0];
    root = folder.uri.fsPath;
    rootKey = folder.uri.toString();
    import_strict.default.equal(folder.uri.scheme, "file");
    import_strict.default.ok(vscode.workspace.isTrusted);
    import_strict.default.equal(await (0, import_promises.readFile)((0, import_node_path.join)(root, MARKER), "utf8"), "synthetic-only-v1");
    const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
    import_strict.default.ok(extension && extension.isActive);
    bundle = (0, import_node_path.join)(extension.extensionPath, "dist", "extension.js");
    runtime = sha(await (0, import_promises.readFile)(bundle));
    import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F04_BUNDLE_SHA256);
    config = vscode.workspace.getConfiguration("soterai");
    oldFlag = config.inspect(FLAG)?.globalValue;
    const uri = (relative) => vscode.Uri.joinPath(folder.uri, relative);
    const write = async (relative, text) => {
      await (0, import_promises.mkdir)((0, import_node_path.dirname)((0, import_node_path.join)(root, relative)), { recursive: true });
      await (0, import_promises.writeFile)((0, import_node_path.join)(root, relative), text, { flag: "wx" });
    };
    const envelope = () => {
      const value = context.workspaceState.get(RULES_KEY, {})[rootKey];
      import_strict.default.ok(value, "Actual persistent policy metadata required.");
      return structuredClone(value);
    };
    const status = async (command, expected, ...args) => {
      const result2 = await vscode.commands.executeCommand(command, ...args);
      commandStatuses.push({ command, status: result2?.status });
      import_strict.default.deepEqual(result2, { status: expected });
    };
    const read = async (relative, ...extra) => {
      const result2 = await vscode.commands.executeCommand("soterai.readProjectFileSafely", uri(relative), ...extra);
      commandStatuses.push({ command: "soterai.readProjectFileSafely", status: result2?.status });
      return result2;
    };
    const approve = async (relative, surface = "integration-command") => {
      const index = modalMetadata.length;
      const result2 = surface === "safe-preview" ? await vscode.commands.executeCommand("soterai.reviewSafeFileAccess", uri(relative)) : await read(relative);
      import_strict.default.equal(result2.status, "ALLOWED_ONCE");
      import_strict.default.equal(typeof result2.text, "string");
      const metadata = modalMetadata[index];
      import_strict.default.ok(metadata && metadata.modal);
      import_strict.default.equal(metadata.previewDigest, sha(result2.text));
      import_strict.default.equal(metadata.previewBytes, Buffer.byteLength(result2.text, "utf8"));
      import_strict.default.equal(metadata.surface, surface);
      metadata.outputMatched = true;
      noValues(result2.text);
      return result2;
    };
    const withheld = async (relative) => {
      lastRedacted = void 0;
      await vscode.commands.executeCommand("soterai.openRedactedPreview", uri(relative));
      const document = lastRedacted;
      import_strict.default.ok(document);
      import_strict.default.match(document.getText(), /AI-forbidden content omitted/);
      noValues(document.getText());
    };
    const pending = async (relative) => {
      let finish;
      const beforeCalls = documentCalls, beforeEvents = ownedDocumentEvents;
      decision = () => new Promise((done) => {
        finish = done;
      });
      const work = read(relative);
      try {
        await waitUntil(() => !!finish, "The actual native modal must be reached before release.");
      } catch (error) {
        await status("soterai.revokeProjectReads", "REVOKED");
        finish?.(void 0);
        await bounded(work);
        throw error;
      }
      import_strict.default.equal(documentCalls, beforeCalls, "No TextDocument may be opened by the safe reader before approval.");
      import_strict.default.equal(ownedDocumentEvents, beforeEvents, "No owned safe TextDocument may appear before approval.");
      return { work, finish, beforeCalls, beforeEvents };
    };
    patch(vscode.window, "showInformationMessage", async (message) => {
      messages.push(message);
      return void 0;
    });
    patch(vscode.window, "showErrorMessage", async (message) => {
      messages.push(message);
      return void 0;
    });
    patch(vscode.window, "showWarningMessage", async (message, ...items) => {
      const options = items[0];
      if (items.includes("Allow safe read once")) {
        modalCount++;
        import_strict.default.equal(options?.modal, true);
        import_strict.default.equal(typeof options.detail, "string");
        noValues(message);
        noValues(options.detail);
        const surface = /Route: ([^.]+)\./.exec(message)?.[1] ?? "UNKNOWN";
        modalMetadata.push({ surface, modal: options.modal === true, previewBytes: Buffer.byteLength(options.detail, "utf8"), previewDigest: sha(options.detail) });
        return decision({ message, options, actions: items.slice(1) });
      }
      messages.push(message);
      return void 0;
    });
    const originalOpen = vscode.workspace.openTextDocument;
    patch(vscode.workspace, "openTextDocument", async (...args) => {
      documentCalls++;
      return originalOpen(...args);
    });
    const originalShow = vscode.window.showTextDocument;
    patch(vscode.window, "showTextDocument", async (document, ...args) => {
      if (document.uri.scheme === "soterai-approved") lastApproved = document;
      if (document.uri.scheme === "soterai-redacted") lastRedacted = document;
      return originalShow(document, ...args);
    });
    documentListener = vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.uri.scheme === "soterai-approved" || document.uri.scheme === "untitled") ownedDocumentEvents++;
    });
    if (phase === "save") {
      await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
      await write("ordinary.txt", ORDINARY);
      await write("public.txt", PUBLIC);
      await write(".env.host", ENV_TEXT);
      await write("private.pem", PRIVATE + URL);
      await write("region.txt", REGION_TEXT);
      await write("flag-denied.txt", "Flag-off ordinary restriction control.\n");
      await write("flag-sensitive.txt", PRIVATE);
      await write("binary.txt", "Binary\0" + PRIVATE);
      await write("large-safe.txt", "\u754C".repeat(5462));
      await write("exact-limit.txt", "A".repeat(16384));
      await write(".aiignore", "ordinary.txt\n");
      await check("F04-H01", async () => {
        const prior = context.workspaceState.get(RULES_KEY, {})[rootKey];
        import_strict.default.ok(!prior?.manual?.paths?.length && !prior?.manual?.regions?.length, "Cold reset is limited to fresh synthetic defaults before any manual protection.");
        await context.workspaceState.update(RULES_KEY, {});
        const held = await pending("ordinary.txt");
        try {
          held.finish("Allow safe read once");
          const result2 = await held.work;
          import_strict.default.equal(result2.status, "ALLOWED_ONCE");
          import_strict.default.match(result2.text, /Useful ordinary operation note/);
          noValues(result2.text);
          const metadata = modalMetadata.at(-1);
          import_strict.default.equal(metadata.previewDigest, sha(result2.text));
          metadata.outputMatched = true;
        } finally {
          held.finish(void 0);
          decision = async () => "Allow safe read once";
        }
        await status("soterai.blockFromAI", "SAVED", uri("ordinary.txt"));
        await withheld("ordinary.txt");
        import_strict.default.ok(envelope().manual.paths.some((rule) => rule.pattern === "ordinary.txt"));
      });
      await check("F04-H02", async () => {
        const env = await approve(".env.host");
        import_strict.default.equal(env.kind, "environment-schema");
        import_strict.default.equal(env.text, ENV_SAFE);
        const sensitive = await approve("private.pem");
        import_strict.default.equal(sensitive.kind, "sensitive-summary");
        import_strict.default.match(sensitive.text, /MASKED/);
        const regionDocument = await vscode.workspace.openTextDocument(uri("region.txt"));
        const editor = await vscode.window.showTextDocument(regionDocument);
        editor.selection = new vscode.Selection(regionDocument.positionAt(REGION_TEXT.indexOf(REGION)), regionDocument.positionAt(REGION_TEXT.indexOf(REGION) + REGION.length));
        await status("soterai.blockSelectionFromAI", "SAVED");
        const region = await approve("region.txt");
        import_strict.default.match(region.text, /Useful before\./);
        import_strict.default.match(region.text, /Useful after\./);
        import_strict.default.match(region.text, /AI-forbidden content omitted/);
        await withheld(".env.host");
      });
      await check("F04-H03", async () => {
        const before = modalCount, beforeDocuments = documentCalls;
        decision = async () => void 0;
        const forged = { approved: true, raw: true, recipient: SPOOF, safeText: SPOOF, surface: SPOOF, timeout: 0, expiresAt: Infinity };
        import_strict.default.deepEqual(await read("public.txt", forged), { status: "DENIED" });
        import_strict.default.equal(modalCount, before + 1);
        import_strict.default.equal(documentCalls, beforeDocuments);
        import_strict.default.deepEqual(await vscode.commands.executeCommand("soterai.readProjectFileSafely", { uri: uri("public.txt"), ...forged }), { status: "DENIED" });
        import_strict.default.equal(modalCount, before + 1);
        decision = async (modal) => {
          import_strict.default.ok(!JSON.stringify(modal).includes(SPOOF));
          return "Allow safe read once";
        };
        const result2 = await read("public.txt", forged);
        import_strict.default.equal(result2.status, "ALLOWED_ONCE");
        import_strict.default.equal(result2.text, PUBLIC);
        import_strict.default.equal(modalMetadata.at(-1).surface, "integration-command");
        import_strict.default.equal(modalMetadata.at(-1).previewDigest, sha(PUBLIC));
        modalMetadata.at(-1).outputMatched = true;
        decision = async () => "Allow safe read once";
      });
      await check("F04-H04", async () => {
        const started = performance.now(), held = await pending("public.txt");
        try {
          const result2 = await bounded(held.work, 65e3);
          const elapsedMs = performance.now() - started;
          import_strict.default.deepEqual(result2, { status: "EXPIRED" });
          import_strict.default.ok(elapsedMs >= 6e4, "The real fixed deadline must elapse before an unanswered modal expires.");
          commandStatuses.push({ command: "real-unanswered-modal-deadline", status: { result: result2.status, elapsedMs } });
          held.finish("Allow safe read once");
          await wait(100);
          import_strict.default.equal(documentCalls, held.beforeCalls);
          import_strict.default.equal(ownedDocumentEvents, held.beforeEvents);
          decision = async () => "Allow safe read once";
          import_strict.default.equal((await approve("public.txt")).text, PUBLIC);
        } finally {
          held.finish(void 0);
          await status("soterai.revokeProjectReads", "REVOKED");
          decision = async () => "Allow safe read once";
        }
      });
      await check("F04-H05", async () => {
        const older = await pending("public.txt");
        let newer;
        try {
          await status("soterai.revokeProjectReads", "REVOKED");
          import_strict.default.deepEqual(await bounded(older.work), { status: "EXPIRED" });
          newer = await pending("public.txt");
          let newerResolved = false;
          void newer.work.then(() => {
            newerResolved = true;
          });
          older.finish("Allow safe read once");
          await wait(100);
          import_strict.default.equal(newerResolved, false);
          import_strict.default.deepEqual(await read("public.txt"), { status: "BUSY" });
          newer.finish("Allow safe read once");
          const result2 = await bounded(newer.work);
          import_strict.default.equal(result2.status, "ALLOWED_ONCE");
          import_strict.default.equal(result2.text, PUBLIC);
          modalMetadata.at(-1).outputMatched = modalMetadata.at(-1).previewDigest === sha(PUBLIC);
          import_strict.default.equal(documentCalls, newer.beforeCalls);
          import_strict.default.equal(ownedDocumentEvents, newer.beforeEvents);
        } finally {
          older.finish(void 0);
          newer?.finish(void 0);
          await status("soterai.revokeProjectReads", "REVOKED");
          decision = async () => "Allow safe read once";
        }
      });
      await check("F04-H06", async () => {
        const result2 = await approve("public.txt", "safe-preview");
        import_strict.default.ok(lastApproved);
        const existing = lastApproved;
        import_strict.default.equal(existing.getText(), result2.text);
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        import_strict.default.deepEqual(await read("public.txt"), { status: "UNAVAILABLE" });
        await waitUntil(() => /AI-forbidden content omitted/.test(existing.getText()), "Flag withdrawal must refresh the actual open approved document.");
        await status("soterai.restrictProjectFile", "SAVED", uri("flag-denied.txt"));
        await status("soterai.restrictSensitiveFile", "SAVED", uri("flag-sensitive.txt"));
        await withheld("ordinary.txt");
        await withheld("flag-denied.txt");
        await withheld("flag-sensitive.txt");
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        await withheld("ordinary.txt");
      });
      await check("F04-H07", async () => {
        const before = modalCount;
        for (const relative of ["binary.txt", "large-safe.txt"]) import_strict.default.deepEqual(await read(relative), { status: "UNAVAILABLE" });
        import_strict.default.equal(modalCount, before);
        const limit = await approve("exact-limit.txt");
        import_strict.default.equal(Buffer.byteLength(limit.text, "utf8"), 16384);
      });
      await check("F04-H08", async () => {
        const stored = envelope();
        import_strict.default.ok(stored.manual.paths.some((rule) => rule.pattern === "ordinary.txt"));
        import_strict.default.ok(stored.manual.paths.some((rule) => rule.pattern === "flag-sensitive.txt" && rule.sensitive === true));
        noValues(JSON.stringify(stored));
        noValues(messages.join("\n"));
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        import_strict.default.deepEqual(await read(".env.host"), { status: "UNAVAILABLE" });
        await write(RECEIPT, JSON.stringify({
          schemaVersion: 1,
          runtime,
          profile: (0, import_node_path.resolve)(profile),
          workspace: root,
          safeConsentGlobalValue: config.inspect(FLAG)?.globalValue,
          policy: stored,
          reviewAudit: stored.reviewAudit ?? null
        }));
        import_strict.default.equal(config.inspect(FLAG)?.globalValue, false);
      });
    } else {
      await check("F04-H09", async () => {
        const receipt = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(root, RECEIPT), "utf8"));
        import_strict.default.equal(receipt.runtime, runtime);
        import_strict.default.equal(receipt.profile, (0, import_node_path.resolve)(profile));
        import_strict.default.equal(receipt.workspace, root);
        import_strict.default.equal(config.inspect(FLAG)?.globalValue, receipt.safeConsentGlobalValue);
        import_strict.default.equal(receipt.safeConsentGlobalValue, false);
        import_strict.default.deepEqual(envelope(), receipt.policy);
        import_strict.default.deepEqual(envelope().reviewAudit ?? null, receipt.reviewAudit);
        const before = modalCount;
        import_strict.default.deepEqual(await read(".env.host"), { status: "UNAVAILABLE" });
        import_strict.default.equal(modalCount, before);
        await withheld("ordinary.txt");
        await withheld("flag-denied.txt");
        await withheld("flag-sensitive.txt");
        await withheld(".env.host");
        import_strict.default.ok(context.storageUri);
        const database = await (0, import_promises.stat)((0, import_node_path.join)((0, import_node_path.dirname)(context.storageUri.fsPath), "state.vscdb"));
        import_strict.default.ok(database.isFile() && database.size > 0, "Persistent SQLite metadata exists; contents are never read.");
      });
      await check("F04-H10", async () => {
        const stored = envelope();
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        import_strict.default.equal((await approve(".env.host")).text, ENV_SAFE);
        const ordinary = await approve("ordinary.txt");
        import_strict.default.match(ordinary.text, /Useful ordinary operation note/);
        noValues(ordinary.text);
        await withheld("ordinary.txt");
        import_strict.default.deepEqual(envelope(), stored);
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        import_strict.default.deepEqual(await read(".env.host"), { status: "UNAVAILABLE" });
      });
    }
  } catch (error) {
    driverFailure = sanitize(error);
  } finally {
    documentListener?.dispose();
    for (const item of patches.reverse()) item.target[item.name] = item.original;
    if (config && (phase === "reload" || driverFailure || observations.some((row) => row.status !== "PASS"))) {
      try {
        await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global);
      } catch (error) {
        driverFailure = driverFailure ?? sanitize(error);
      }
    }
  }
  let currentRuntime, hostProbeSha256;
  try {
    if (bundle) currentRuntime = sha(await (0, import_promises.readFile)(bundle));
  } catch (error) {
    driverFailure = driverFailure ?? sanitize(error);
  }
  try {
    hostProbeSha256 = sha(await (0, import_promises.readFile)(__filename));
  } catch (error) {
    driverFailure = driverFailure ?? sanitize(error);
  }
  if (currentRuntime && runtime && currentRuntime !== runtime) driverFailure = driverFailure ?? "Packaged runtime changed during this host probe.";
  const result = {
    schemaVersion: 1,
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    phase,
    syntheticOnly: true,
    workspace: root,
    declaredProfilePath: profile ? (0, import_node_path.resolve)(profile) : void 0,
    extensionMode: "Development",
    hostVersion: vscode.version,
    extensionBundleSha256: runtime,
    currentDeveloperBundleSha256: currentRuntime,
    hostProbeSha256,
    observations,
    commandStatuses,
    modalMetadata,
    documentCalls,
    ownedDocumentEvents,
    driverFailure,
    safeConsentFlagRetainedForRestart: phase === "save" && !driverFailure && observations.every((row) => row.status === "PASS"),
    passed: observations.filter((row) => row.status === "PASS").length,
    failed: observations.filter((row) => row.status === "FAIL").length + (driverFailure ? 1 : 0),
    notRun: observations.filter((row) => row.status === "NOT_RUN").length,
    identityScope: "Byte-identical packaged runtime in an isolated persistent developer window with a test-only bootstrap and actual Memento. SQLite stat only; no clean-profile installed-VSIX or authenticated memory claim.",
    consentScope: "Exact native modal API arguments and returned safe-output digest; no rendered modal usability or human owner-presence proof.",
    independence: "LOW",
    ownerPresence: "SCRIPTED_SAME_EXTENSION_API_INSTANCE",
    externalAgents: "NOT_TESTED"
  };
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || result.notRun || currentRuntime !== runtime) throw new Error("F04 native host incomplete or failed; inspect retained observations.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  run
});
