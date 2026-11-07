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

// packages/vscode-extension/src/__tests__/host/liteOwnerReview.host.ts
var liteOwnerReview_host_exports = {};
__export(liteOwnerReview_host_exports, {
  run: () => run
});
module.exports = __toCommonJS(liteOwnerReview_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var FLAG = "lite.policyDrift";
var RULES_KEY = "soterai.aiForbidden.v1";
var BASELINE_KEY = "soterai.lite.policyDrift.v1";
var MARKER = ".synthetic-lite-f03-host";
var RECEIPT = ".lite-f03-save-receipt.json";
var PRIVATE = "SYNTHETIC_F03_HOST_ORDINARY_PRIVATE_NOTE_20261014";
var SENSITIVE = "SYNTHETIC_F03_HOST_ENV_VALUE_NEVER_RELEASED_20261014";
var REGION = "SYNTHETIC_F03_HOST_REGION_ALWAYS_MASKED_20261014";
var SOURCE = "SYNTHETIC_F03_HOST_POLICY_COMMENT_NEVER_AUDIT_20261014";
var PUBLIC = "Useful F03 public control.\n";
var REGION_TEXT = `Useful before. ${REGION} Useful after.
`;
var sha = (bytes) => (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
async function run(context) {
  const phase = process.env.SOTERAI_LITE_F03_PHASE, output = process.env.SOTERAI_LITE_F03_EVIDENCE;
  const profile = process.env.SOTERAI_LITE_F03_PROFILE;
  import_strict.default.ok(phase === "save" || phase === "reload", "explicit save/reload phase required");
  import_strict.default.ok(output && (0, import_node_path.isAbsolute)(output), "new absolute evidence output required");
  import_strict.default.ok(profile && (0, import_node_path.isAbsolute)(profile), "launcher-declared isolated profile required");
  import_strict.default.equal((0, import_node_path.resolve)(process.env.USERPROFILE ?? ""), (0, import_node_path.resolve)(profile), "native process must use the isolated profile");
  import_strict.default.equal(context.extensionMode, vscode.ExtensionMode.Development, "normal persistent developer context required");
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  const folder = vscode.workspace.workspaceFolders[0], root = folder.uri.fsPath, rootKey = folder.uri.toString();
  import_strict.default.equal(folder.uri.scheme, "file");
  import_strict.default.equal(await (0, import_promises.readFile)((0, import_node_path.join)(root, MARKER), "utf8"), "synthetic-only-v1");
  import_strict.default.ok(vscode.workspace.isTrusted);
  const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
  import_strict.default.ok(extension);
  const bundle = (0, import_node_path.join)(extension.extensionPath, "dist", "extension.js"), runtime = sha(await (0, import_promises.readFile)(bundle));
  import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F03_BUNDLE_SHA256);
  import_strict.default.ok(extension.isActive, "bootstrap must activate the actual packaged runtime before this driver");
  const api = vscode.window, originals = /* @__PURE__ */ new Map();
  const config = vscode.workspace.getConfiguration("soterai"), oldFlag = config.inspect(FLAG)?.globalValue;
  const messages = [], commandStatuses = [];
  const reviews = [], observations = [];
  const reviewDocuments = /* @__PURE__ */ new Map();
  let selectedPattern = "ordinary.txt", cancelFolder = false, typed = "exact";
  let inputCalls = 0, finalActions = 0, nativeDiff = false;
  let lastPreview, lastPreviewDocument;
  const uri = (relative) => vscode.Uri.joinPath(folder.uri, relative);
  const patch = (name, value) => {
    originals.set(name, api[name]);
    api[name] = value;
  };
  const write = async (relative, text) => {
    await (0, import_promises.mkdir)((0, import_node_path.dirname)((0, import_node_path.join)(root, relative)), { recursive: true });
    await (0, import_promises.writeFile)((0, import_node_path.join)(root, relative), text, { flag: "wx" });
  };
  const envelope = () => {
    const value = context.workspaceState.get(RULES_KEY, {})[rootKey];
    import_strict.default.ok(value, "actual persistent root policy metadata required");
    return structuredClone(value);
  };
  const permanent = () => {
    const value = envelope();
    return { manual: value.manual, policy: value.policy };
  };
  const records = () => envelope().reviewAudit?.records ?? [];
  const noValues = (text) => {
    for (const marker of [PRIVATE, SENSITIVE, REGION, SOURCE]) import_strict.default.ok(!text.includes(marker), "source values must stay outside metadata/alerts");
  };
  const assertAudit = () => {
    const value = envelope();
    import_strict.default.equal(value.schemaVersion, 3);
    import_strict.default.equal(value.reviewAudit?.schemaVersion, 1);
    import_strict.default.ok(records().length > 0 && records().length <= 64);
    import_strict.default.ok(Buffer.byteLength(JSON.stringify(value.reviewAudit), "utf8") <= 32768);
    import_strict.default.ok(Buffer.byteLength(JSON.stringify(value), "utf8") <= 128 * 1024);
    for (const record of records()) {
      import_strict.default.match(record.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      import_strict.default.equal(record.outcome, "REVIEWED_SESSION");
      import_strict.default.match(record.ruleDigest, /^[0-9a-f]{64}$/);
      import_strict.default.match(record.revisionDigest, /^[0-9a-f]{64}$/);
    }
    noValues(JSON.stringify(value));
    noValues(JSON.stringify(context.workspaceState.get(BASELINE_KEY)));
    noValues(messages.join("\n"));
  };
  const check = async (id, scope, action) => {
    const row = { id, status: "NOT_RUN", scope };
    observations.push(row);
    try {
      await action();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      let diagnostic = error instanceof Error ? error.name + ": " + error.message : "UnknownFailure";
      for (const marker of [PRIVATE, SENSITIVE, REGION, SOURCE]) diagnostic = diagnostic.replaceAll(marker, "[SYNTHETIC-CANARY-OMITTED]");
      row.diagnostic = diagnostic.slice(0, 12e3);
    }
    console.log(`LITE_OWNER_REVIEW_HOST ${phase} ${id} ${row.status}`);
  };
  const status = async (command, expected, ...args) => {
    const result2 = await vscode.commands.executeCommand(command, ...args);
    commandStatuses.push({ command, observedStatus: result2?.status });
    import_strict.default.deepEqual(result2, { status: expected });
  };
  const preview = async (relative) => {
    lastPreview = void 0;
    await vscode.commands.executeCommand("soterai.openRedactedPreview", uri(relative));
    import_strict.default.equal(typeof lastPreview, "string");
    return lastPreview;
  };
  const withheld = async (relative) => {
    const text = await preview(relative);
    import_strict.default.match(text, /AI-forbidden content omitted/);
    noValues(text);
  };
  const readEnvSafely = async () => {
    const result2 = await vscode.commands.executeCommand("soterai.readProjectFileSafely", uri(".env.owner"));
    commandStatuses.push({ command: "soterai.readProjectFileSafely", observedStatus: result2?.status });
    import_strict.default.equal(result2.status, "ALLOWED_ONCE");
    import_strict.default.equal(result2.text, "DATABASE_URL=[MASKED]\nPUBLIC_PORT=[MASKED]");
    noValues(result2.text);
  };
  const review = async (command, pattern, expected = "RELAXED_SESSION") => {
    selectedPattern = pattern;
    inputCalls = 0;
    finalActions = 0;
    nativeDiff = false;
    reviewDocuments.clear();
    const started = Date.now();
    await status(command, expected);
    const row = {
      command,
      selectedPattern: pattern,
      observedStatus: expected,
      elapsedMs: Date.now() - started,
      inputCalls,
      nativeDiff,
      diffDocumentCount: reviewDocuments.size,
      finalActions
    };
    reviews.push(row);
    if (expected === "RELAXED_SESSION") {
      import_strict.default.ok(row.elapsedMs >= 1e4, "the actual runtime must enforce its real ten-second cooldown");
      import_strict.default.equal(row.inputCalls, 1);
      import_strict.default.equal(row.finalActions, 1);
      import_strict.default.ok(row.nativeDiff);
      import_strict.default.equal(row.diffDocumentCount, 2);
      const views = [...reviewDocuments.values()].map((text) => {
        noValues(text);
        return JSON.parse(text);
      });
      import_strict.default.deepEqual(views[0].permanent, views[1].permanent);
      const after = views.find((value) => value.session.reviewedSelector);
      import_strict.default.equal(after.session.reviewedSelector.pattern, pattern);
      import_strict.default.equal(after.session.lifetime, "this editor session");
      import_strict.default.equal(after.session.sensitiveTreatment, "retained");
      import_strict.default.equal(after.session.protectedRegions, "retained");
    }
  };
  const opened = vscode.workspace.onDidOpenTextDocument((document) => {
    if (document.uri.scheme === "soterai-owner-review") reviewDocuments.set(document.uri.toString(), document.getText());
  });
  try {
    patch("showInformationMessage", async (message) => {
      messages.push(message);
      return void 0;
    });
    patch("showErrorMessage", async (message) => {
      messages.push(message);
      return void 0;
    });
    patch("showWorkspaceFolderPick", async () => cancelFolder ? void 0 : folder);
    patch("showQuickPick", async (items) => items.find((item) => item.label === `file: ${selectedPattern}`));
    patch("showInputBox", async (options) => {
      inputCalls++;
      import_strict.default.match(options.prompt ?? "", /^Type exactly: RELAX SESSION [0-9a-f]{8}$/);
      if (typed === "cancel") return void 0;
      return typed === "wrong" ? "SYNTHETIC_WRONG_OWNER_CONFIRMATION" : options.prompt.replace(/^Type exactly: /, "");
    });
    patch("showWarningMessage", async (message, ...items) => {
      messages.push(message);
      if (items.includes("Allow safe read once")) return "Allow safe read once";
      if (items.includes("Review session relaxation")) {
        for (let attempt = 0; attempt < 40; attempt++) {
          nativeDiff = vscode.window.tabGroups.all.some((group) => group.tabs.some((tab) => {
            const input = tab.input;
            return input instanceof vscode.TabInputTextDiff && reviewDocuments.has(input.original.toString()) && reviewDocuments.has(input.modified.toString());
          }));
          if (nativeDiff) break;
          await new Promise((done) => setTimeout(done, 25));
        }
        return "Review session relaxation";
      }
      if (items.includes("Relax for this editor session")) {
        finalActions++;
        return "Relax for this editor session";
      }
      return void 0;
    });
    patch("showTextDocument", async (document, ...args) => {
      if (document.uri.scheme === "soterai-redacted") {
        lastPreview = document.getText();
        lastPreviewDocument = document;
      }
      return originals.get("showTextDocument")(document, ...args);
    });
    await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
    if (phase === "save") {
      for (const relative of ["ordinary.txt", "other-denied.txt"]) await write(relative, PRIVATE);
      await write("public.txt", PUBLIC);
      await write("region.txt", REGION_TEXT);
      await write(".env.owner", `# ${SENSITIVE}
DATABASE_URL=${SENSITIVE}
PUBLIC_PORT=8080
`);
      for (const relative of ["ordinary.txt", "other-denied.txt"]) await status("soterai.blockFromAI", "SAVED", uri(relative));
      await status("soterai.restrictSensitiveFile", "SAVED", uri(".env.owner"));
      const regionDocument = await vscode.workspace.openTextDocument(uri("region.txt"));
      const editor = await vscode.window.showTextDocument(regionDocument);
      editor.selection = new vscode.Selection(regionDocument.positionAt(REGION_TEXT.indexOf(REGION)), regionDocument.positionAt(REGION_TEXT.indexOf(REGION) + REGION.length));
      await status("soterai.blockSelectionFromAI", "SAVED");
      const accepted = permanent();
      await check("F03-H01", "Actual owner commands ignore supplied grants; picker cancel and wrong exact typing preserve denies/audit.", async () => {
        const registered = await vscode.commands.getCommands(true);
        import_strict.default.ok(registered.includes("soterai.manageAIRules") && registered.includes("soterai.reviewSensitiveAIRules"));
        cancelFolder = true;
        await status("soterai.manageAIRules", "CANCELLED", { root: rootKey, approved: true, challenge: "forged" });
        cancelFolder = false;
        typed = "wrong";
        await review("soterai.manageAIRules", "ordinary.txt", "FAILED");
        typed = "exact";
        import_strict.default.equal(records().length, 0);
        import_strict.default.deepEqual(permanent(), accepted);
        await withheld("ordinary.txt");
      });
      await check("F03-H02", "Native metadata diff, exact typing and real cooldown produce an atomic v3 ordinary review audit.", async () => {
        await review("soterai.manageAIRules", "ordinary.txt");
        import_strict.default.deepEqual(permanent(), accepted);
        import_strict.default.equal(records().length, 1);
        import_strict.default.equal(records()[0].mode, "ordinary");
        assertAudit();
      });
      await check("F03-H03", "Only the reviewed ordinary selector opens; other deny, credential default and protected region remain; public control opens.", async () => {
        import_strict.default.equal(await preview("ordinary.txt"), PRIVATE);
        await withheld("other-denied.txt");
        await withheld(".env.owner");
        const region = await preview("region.txt");
        import_strict.default.ok(region.includes("Useful before.") && region.includes("Useful after."));
        import_strict.default.match(region, /AI-forbidden content omitted/);
        noValues(region);
        import_strict.default.equal(await preview("public.txt"), PUBLIC);
        import_strict.default.deepEqual(permanent(), accepted);
      });
      await check("F03-H04", "Machine flag withdrawal ends current session access, refreshes an open view and cannot resurrect access on re-enable.", async () => {
        import_strict.default.equal(await preview("ordinary.txt"), PRIVATE);
        const existing = lastPreviewDocument;
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        await status("soterai.manageAIRules", "UNAVAILABLE");
        await status("soterai.reviewSensitiveAIRules", "UNAVAILABLE");
        await withheld("ordinary.txt");
        for (let attempt = 0; attempt < 40 && existing.getText().includes(PRIVATE); attempt++) await new Promise((done) => setTimeout(done, 50));
        import_strict.default.ok(!existing.getText().includes(PRIVATE));
        import_strict.default.match(existing.getText(), /AI-forbidden content omitted/);
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        await withheld("ordinary.txt");
        import_strict.default.deepEqual(permanent(), accepted);
        assertAudit();
      });
      await check("F03-H05", "Separate sensitive owner review retains stored sensitivity, default omission and exact value-masked env safe read.", async () => {
        await review("soterai.reviewSensitiveAIRules", ".env.owner");
        import_strict.default.deepEqual(permanent(), accepted);
        import_strict.default.equal(records().at(-1)?.mode, "sensitive");
        await withheld(".env.owner");
        await readEnvSafely();
        assertAudit();
      });
      await check("F03-H06", "Rejected actual-context audit persistence yields FAILED and no grant, saved notification or policy change.", async () => {
        const before = envelope(), messageCount = messages.length;
        const memento = context.workspaceState, original = memento.update;
        memento.update = async (key, value) => {
          if (key === RULES_KEY) throw new Error("SYNTHETIC_F03_HOST_STORAGE_FAILURE");
          return original.call(context.workspaceState, key, value);
        };
        try {
          await review("soterai.manageAIRules", "ordinary.txt", "FAILED");
        } finally {
          memento.update = original;
        }
        import_strict.default.deepEqual(envelope(), before);
        import_strict.default.ok(!messages.slice(messageCount).some((message) => /Session review saved/.test(message)));
        await withheld("ordinary.txt");
        assertAudit();
      });
      await check("F03-H07", "Real source watcher/read drift restores a reviewed deny without copying source values into alerts or baseline.", async () => {
        await review("soterai.manageAIRules", "ordinary.txt");
        import_strict.default.equal(await preview("ordinary.txt"), PRIVATE);
        await write(".aiignore", `# ${SOURCE}
additional-denied.txt
`);
        await withheld("ordinary.txt");
        for (let attempt = 0; attempt < 60 && !messages.some((message) => /protection drift/.test(message)); attempt++) await new Promise((done) => setTimeout(done, 50));
        import_strict.default.ok(messages.some((message) => /protection drift/.test(message)));
        import_strict.default.deepEqual(permanent(), accepted);
        assertAudit();
      });
      await check("F03-H08", "Save phase leaves one reviewed ordinary grant active while permanent v3 rules/audit remain persisted for restart.", async () => {
        await review("soterai.manageAIRules", "ordinary.txt");
        import_strict.default.equal(await preview("ordinary.txt"), PRIVATE);
        import_strict.default.deepEqual(permanent(), accepted);
        assertAudit();
        await write(RECEIPT, JSON.stringify({ runtime, profile: (0, import_node_path.resolve)(profile), workspace: root, permanent: accepted, audit: envelope().reviewAudit }));
      });
    } else {
      await check("F03-H09", "Native restart in the same profile/workspace/runtime keeps actual audit metadata and restores all permanent denies.", async () => {
        const receipt = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(root, RECEIPT), "utf8"));
        import_strict.default.equal(receipt.runtime, runtime);
        import_strict.default.equal(receipt.profile, (0, import_node_path.resolve)(profile));
        import_strict.default.equal(receipt.workspace, root);
        import_strict.default.deepEqual(permanent(), receipt.permanent);
        import_strict.default.deepEqual(envelope().reviewAudit, receipt.audit);
        assertAudit();
        await withheld("ordinary.txt");
        await withheld("other-denied.txt");
        await withheld(".env.owner");
        await readEnvSafely();
        import_strict.default.equal(await preview("public.txt"), PUBLIC);
        import_strict.default.ok(context.storageUri, "actual persistent workspace storage directory required");
        const database = await (0, import_promises.stat)((0, import_node_path.join)((0, import_node_path.dirname)(context.storageUri.fsPath), "state.vscdb"));
        import_strict.default.ok(database.isFile() && database.size > 0, "persistent SQLite metadata must exist; contents are never read");
      });
      await check("F03-H10", "After restart machine withdrawal blocks new reviews, retains v3 audit/permanent denies and retains env masking.", async () => {
        const before = envelope();
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        await status("soterai.manageAIRules", "UNAVAILABLE");
        await status("soterai.reviewSensitiveAIRules", "UNAVAILABLE");
        await withheld("ordinary.txt");
        await withheld(".env.owner");
        await readEnvSafely();
        import_strict.default.deepEqual(envelope(), before);
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        await withheld("ordinary.txt");
        assertAudit();
      });
    }
  } finally {
    opened.dispose();
    for (const [name, value] of originals) api[name] = value;
    if (phase === "reload" || observations.some((row) => row.status === "FAIL")) {
      await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global);
    }
  }
  const result = {
    schemaVersion: 1,
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    phase,
    syntheticOnly: true,
    workspace: root,
    declaredProfilePath: (0, import_node_path.resolve)(profile),
    extensionMode: "Development",
    hostVersion: vscode.version,
    extensionBundleSha256: runtime,
    currentDeveloperBundleSha256: sha(await (0, import_promises.readFile)(bundle)),
    hostProbeSha256: sha(await (0, import_promises.readFile)(__filename)),
    observations,
    commandStatuses,
    reviews,
    auditRecordCount: records().length,
    policyDriftFlagRetainedForRestart: phase === "save" && !observations.some((row) => row.status === "FAIL"),
    passed: observations.filter((row) => row.status === "PASS").length,
    failed: observations.filter((row) => row.status === "FAIL").length,
    identityScope: "Byte-identical packaged runtime in a normal isolated developer window with a test-only bootstrap and persistent Memento. SQLite metadata only; no clean-profile installed-VSIX or authenticated memory claim.",
    independence: "LOW",
    ownerPresence: "SCRIPTED_SAME_EXTENSION_API_INSTANCE",
    externalAgents: "NOT_TESTED"
  };
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  import_strict.default.equal(result.currentDeveloperBundleSha256, runtime);
  if (result.failed) throw new Error("F03 native host assertions failed; inspect observations.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  run
});
