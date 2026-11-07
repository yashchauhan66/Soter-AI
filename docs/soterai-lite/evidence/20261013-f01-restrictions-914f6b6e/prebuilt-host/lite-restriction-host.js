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

// packages/vscode-extension/src/__tests__/host/liteRestrictionSave.host.ts
var liteRestrictionSave_host_exports = {};
__export(liteRestrictionSave_host_exports, {
  run: () => run
});
module.exports = __toCommonJS(liteRestrictionSave_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var FLAG = "lite.restrictionSave";
var MARKER = ".synthetic-lite-f01-host";
var RECEIPT = ".lite-f01-save-receipt.json";
var fixtures = {
  "direct.txt": "Synthetic F01 direct private material.\n",
  "chosen.txt": "Synthetic F01 chosen private material.\n",
  "public.txt": "Public F01 control remains available.\n",
  "private-folder/child.txt": "Synthetic F01 folder private material.\n",
  "f01-glob/child.txt": "Synthetic F01 glob private material.\n",
  "selected.txt": "Public before.\nSynthetic private region amber violet meadow.\nPublic after.\n",
  "sensitive.txt": "Synthetic F01 sensitive material.\n",
  ".env.f01": "DATABASE_URL=synthetic_fixture_database\nPORT=9999\n",
  "off-ordinary.txt": "Public F01 flag-off ordinary control.\n",
  "off-sensitive.txt": "Public F01 flag-off sensitive control.\n",
  "off-glob/child.txt": "Public F01 flag-off glob control.\n",
  "off-region.txt": "Public F01 flag-off region control.\n"
};
var sha = (value) => (0, import_node_crypto.createHash)("sha256").update(value).digest("hex");
async function run() {
  const phase = process.env.SOTERAI_LITE_F01_PHASE;
  const output = process.env.SOTERAI_LITE_F01_EVIDENCE;
  const profile = process.env.SOTERAI_LITE_F01_PROFILE;
  import_strict.default.ok(phase === "save" || phase === "reload", "explicit save/reload phase required");
  import_strict.default.ok(output && (0, import_node_path.isAbsolute)(output), "new absolute evidence output required");
  import_strict.default.ok(profile && (0, import_node_path.isAbsolute)(profile), "launcher-declared isolated profile required");
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1, "exactly one synthetic workspace required");
  const folder = vscode.workspace.workspaceFolders[0];
  import_strict.default.equal(folder.uri.scheme, "file");
  const root = folder.uri.fsPath;
  import_strict.default.equal(await (0, import_promises.readFile)((0, import_node_path.join)(root, MARKER), "utf8"), "synthetic-only-v1");
  import_strict.default.ok(vscode.workspace.isTrusted, "trusted isolated synthetic workspace required");
  const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
  import_strict.default.ok(extension, "actual SoterAI installation required");
  const bundlePath = (0, import_node_path.join)(extension.extensionPath, "dist", "extension.js");
  const activationBundleSha256 = sha(await (0, import_promises.readFile)(bundlePath));
  if (process.env.SOTERAI_LITE_F01_BUNDLE_SHA256) {
    import_strict.default.equal(activationBundleSha256, process.env.SOTERAI_LITE_F01_BUNDLE_SHA256);
  }
  await extension.activate();
  import_strict.default.ok(extension.isActive);
  import_strict.default.equal(sha(await (0, import_promises.readFile)(bundlePath)), activationBundleSha256, "bundle changed during activation");
  const config = vscode.workspace.getConfiguration("soterai");
  const originalFlag = config.inspect(FLAG)?.globalValue;
  const api = vscode.window;
  const originals = /* @__PURE__ */ new Map();
  const messages = [];
  const commandStatuses = [];
  let input;
  let cancelPicker = false;
  let pickerCalls = 0;
  let lastPreview;
  const observations = [
    { id: "F01-H01", status: "NOT_RUN", scope: "Save phase: direct and chosen file saves, sensitive save, withheld previews and public control." },
    { id: "F01-H02", status: "NOT_RUN", scope: "Save phase: missing synthetic file reports FAILED without a saved notification." },
    { id: "F01-H03", status: "NOT_RUN", scope: "Save phase: real folder, scripted glob and real selected-region saves report SAVED." },
    { id: "F01-H04", status: "NOT_RUN", scope: "Reload phase: same declared profile/workspace/bundle retains actual restrictions and public control." },
    { id: "F01-H05", status: "NOT_RUN", scope: "Flag-off withdraws new operations, retains prior denies/masking; explicit picker cancellation reports CANCELLED." }
  ];
  const check = async (id, action) => {
    const entry = observations.find((item) => item.id === id);
    try {
      await action();
      entry.status = "PASS";
    } catch (error) {
      entry.status = "FAIL";
      entry.diagnostic = error instanceof Error ? error.name : "UnknownFailure";
    }
    console.log(`LITE_RESTRICTION_HOST ${phase} ${id} ${entry.status}`);
  };
  const patch = (name, value) => {
    originals.set(name, api[name]);
    api[name] = value;
  };
  const uri = (relative) => vscode.Uri.joinPath(folder.uri, relative);
  const status = async (command, expected, target) => {
    const result2 = await vscode.commands.executeCommand(command, ...target ? [target] : []);
    const value = result2 && typeof result2 === "object" && !Array.isArray(result2) ? result2.status : void 0;
    commandStatuses.push({ command, observedStatus: typeof value === "string" && ["SAVED", "FAILED", "CANCELLED", "UNAVAILABLE"].includes(value) ? value : "MISSING_OR_INVALID" });
    import_strict.default.deepEqual(result2, { status: expected }, "command must return only typed save metadata");
  };
  const preview = async (relative) => {
    lastPreview = void 0;
    await vscode.commands.executeCommand("soterai.openRedactedPreview", uri(relative));
    import_strict.default.equal(typeof lastPreview, "string", "registered preview command must show an actual virtual document");
    return lastPreview;
  };
  const withheld = async (relative) => {
    const text = await preview(relative);
    import_strict.default.match(text, /AI-forbidden content omitted/);
    import_strict.default.ok(!text.includes(fixtures[relative].trim()));
  };
  const select = async (relative, text) => {
    const doc = await vscode.workspace.openTextDocument(uri(relative));
    const editor = await originals.get("showTextDocument")(doc, { preview: false });
    const start = doc.getText().indexOf(text);
    import_strict.default.ok(start >= 0);
    editor.selection = new vscode.Selection(doc.positionAt(start), doc.positionAt(start + text.length));
  };
  const retained = async () => {
    for (const relative of ["direct.txt", "chosen.txt", "private-folder/child.txt", "f01-glob/child.txt"]) await withheld(relative);
    const region = await preview("selected.txt");
    import_strict.default.ok(region.includes("Public before.") && region.includes("Public after."));
    import_strict.default.ok(!region.includes("Synthetic private region amber violet meadow."));
    import_strict.default.match(region, /AI-forbidden content omitted/);
    import_strict.default.equal(await preview("public.txt"), fixtures["public.txt"]);
    const sensitive = await vscode.commands.executeCommand("soterai.readProjectFileSafely", uri("sensitive.txt"));
    import_strict.default.equal(sensitive?.status, "ALLOWED_ONCE");
    import_strict.default.match(sensitive?.text ?? "", /MASKED/);
    import_strict.default.ok(!sensitive?.text?.includes(fixtures["sensitive.txt"].trim()));
    const environment = await vscode.commands.executeCommand("soterai.readProjectFileSafely", uri(".env.f01"));
    import_strict.default.equal(environment?.status, "ALLOWED_ONCE");
    import_strict.default.equal(environment?.text, "DATABASE_URL=[MASKED]\nPORT=[MASKED]");
  };
  try {
    patch("showInformationMessage", async (message) => {
      messages.push(message);
      return void 0;
    });
    patch("showErrorMessage", async () => void 0);
    patch("showWarningMessage", async (_message, ...items) => items.includes("Allow safe read once") ? "Allow safe read once" : void 0);
    patch("showInputBox", async () => input);
    patch("showWorkspaceFolderPick", async () => folder);
    patch("showOpenDialog", async () => {
      pickerCalls++;
      return cancelPicker ? void 0 : [uri("chosen.txt")];
    });
    patch("showTextDocument", async (document, ...options) => {
      if (document.uri.scheme === "soterai-redacted") lastPreview = document.getText();
      return originals.get("showTextDocument")(document, ...options);
    });
    await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
    import_strict.default.equal(config.get(FLAG), true);
    if (phase === "save") {
      for (const [relative, text] of Object.entries(fixtures)) {
        await (0, import_promises.mkdir)((0, import_node_path.dirname)((0, import_node_path.join)(root, relative)), { recursive: true });
        await (0, import_promises.writeFile)((0, import_node_path.join)(root, relative), text, { flag: "wx" });
      }
      await check("F01-H01", async () => {
        await status("soterai.blockFromAI", "SAVED", uri("direct.txt"));
        await status("soterai.restrictProjectFile", "SAVED", uri("chosen.txt"));
        await status("soterai.restrictSensitiveFile", "SAVED", uri("sensitive.txt"));
        await withheld("direct.txt");
        await withheld("chosen.txt");
        import_strict.default.equal(await preview("public.txt"), fixtures["public.txt"]);
      });
      await check("F01-H02", async () => {
        const before = messages.length;
        await status("soterai.blockFromAI", "FAILED", uri("missing-synthetic-file.txt"));
        import_strict.default.ok(!messages.slice(before).some((message) => /\bsaved\b/i.test(message)));
      });
      await check("F01-H03", async () => {
        await status("soterai.blockFromAI", "SAVED", uri("private-folder"));
        input = "f01-glob/**";
        await status("soterai.blockGlobFromAI", "SAVED", uri("public.txt"));
        input = void 0;
        await select("selected.txt", "Synthetic private region amber violet meadow.");
        await status("soterai.blockSelectionFromAI", "SAVED");
        await retained();
      });
    } else {
      await check("F01-H04", async () => {
        const saved = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(root, RECEIPT), "utf8"));
        import_strict.default.equal(saved.schemaVersion, 1);
        import_strict.default.equal(saved.declaredProfilePath, (0, import_node_path.resolve)(profile));
        import_strict.default.equal(saved.workspace, root);
        import_strict.default.equal(saved.extensionBundleSha256, activationBundleSha256);
        for (const [relative, text] of Object.entries(fixtures)) import_strict.default.equal(await (0, import_promises.readFile)((0, import_node_path.join)(root, relative), "utf8"), text);
        await retained();
      });
    }
    await check("F01-H05", async () => {
      await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
      import_strict.default.equal(config.get(FLAG), false);
      await status("soterai.blockFromAI", "UNAVAILABLE", uri("off-ordinary.txt"));
      await status("soterai.restrictProjectFile", "UNAVAILABLE", uri("off-ordinary.txt"));
      await status("soterai.restrictSensitiveFile", "UNAVAILABLE", uri("off-sensitive.txt"));
      input = "off-glob/**";
      await status("soterai.blockGlobFromAI", "UNAVAILABLE", uri("public.txt"));
      input = void 0;
      await select("off-region.txt", fixtures["off-region.txt"].trim());
      await status("soterai.blockSelectionFromAI", "UNAVAILABLE");
      for (const relative of ["off-ordinary.txt", "off-sensitive.txt", "off-glob/child.txt", "off-region.txt"]) import_strict.default.equal(await preview(relative), fixtures[relative]);
      await retained();
      await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
      const before = pickerCalls;
      cancelPicker = true;
      await status("soterai.restrictProjectFile", "CANCELLED");
      import_strict.default.ok(pickerCalls > before, "explicit picker cancellation must be exercised");
      cancelPicker = false;
    });
    if (phase === "save" && !observations.some((item) => item.status === "FAIL")) {
      await (0, import_promises.writeFile)((0, import_node_path.join)(root, RECEIPT), JSON.stringify({
        schemaVersion: 1,
        declaredProfilePath: (0, import_node_path.resolve)(profile),
        workspace: root,
        extensionBundleSha256: activationBundleSha256
      }, null, 2) + "\n", { flag: "wx" });
    }
  } finally {
    for (const [name, value] of originals) api[name] = value;
    await config.update(FLAG, originalFlag, vscode.ConfigurationTarget.Global);
  }
  const result = {
    schemaVersion: 1,
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    phase,
    syntheticOnly: true,
    workspace: root,
    declaredProfilePath: (0, import_node_path.resolve)(profile),
    hostVersion: vscode.version,
    appName: vscode.env.appName,
    extensionPath: extension.extensionPath,
    extensionVersion: extension.packageJSON.version,
    extensionActive: extension.isActive,
    extensionBundleSha256: activationBundleSha256,
    currentInstalledBundleSha256: sha(await (0, import_promises.readFile)(bundlePath)),
    hostProbeSha256: sha(await (0, import_promises.readFile)(__filename)),
    observations,
    commandStatuses,
    passed: observations.filter((item) => item.status === "PASS").length,
    failed: observations.filter((item) => item.status === "FAIL").length,
    identityScope: "Installed bundle sampled before/after actual activation; no independent authenticated in-memory hash.",
    profileScope: "Launcher-declared isolated profile; compared across launches, launcher must verify actual --user-data-dir.",
    interactionScope: "Actual registered installed-extension commands and document providers; scripted UI decisions, independent human presence untested.",
    externalAgents: "NOT_TESTED",
    ordinaryTerminal: "NOT_TESTED",
    fullClaim: "BLOCKED"
  };
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  import_strict.default.equal(result.currentInstalledBundleSha256, activationBundleSha256, "bundle changed during host run");
  if (result.failed) throw new Error("F01 host assertions failed; inspect scoped evidence.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  run
});
