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

// packages/vscode-extension/src/__tests__/host/liteVersionedPolicy.host.ts
var liteVersionedPolicy_host_exports = {};
__export(liteVersionedPolicy_host_exports, {
  run: () => run
});
module.exports = __toCommonJS(liteVersionedPolicy_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var FLAG = "lite.versionedPolicy";
var PRIVATE = "SYNTHETIC_F02_HOST_PRIVATE_NOTE_20261013";
var PUBLIC = "Useful F02 public control.\n";
var sha = (bytes) => (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
var policy = (sensitiveGlobs = [], paths = [], presets = []) => ({ schemaVersion: 1, presets, rules: { paths, regions: [] }, sensitiveGlobs });
async function run() {
  const output = process.env.SOTERAI_LITE_F02_EVIDENCE, profile = process.env.SOTERAI_LITE_F02_PROFILE, phase = process.env.SOTERAI_LITE_F02_PHASE;
  import_strict.default.ok(output && (0, import_node_path.isAbsolute)(output));
  import_strict.default.ok(profile && (0, import_node_path.isAbsolute)(profile));
  import_strict.default.ok(phase === "save" || phase === "reload");
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  const folder = vscode.workspace.workspaceFolders[0], root = folder.uri.fsPath;
  import_strict.default.equal(await (0, import_promises.readFile)((0, import_node_path.join)(root, ".synthetic-lite-f02-host"), "utf8"), "synthetic-only-v1");
  import_strict.default.ok(vscode.workspace.isTrusted);
  const ext = vscode.extensions.getExtension("soterai.soterai-ide-guard");
  import_strict.default.ok(ext);
  const bundle = (0, import_node_path.join)(ext.extensionPath, "dist/extension.js"), runtime = sha(await (0, import_promises.readFile)(bundle));
  import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F02_BUNDLE_SHA256);
  await ext.activate();
  import_strict.default.ok(ext.isActive);
  const api = vscode.window, originals = /* @__PURE__ */ new Map(), config = vscode.workspace.getConfiguration("soterai"), oldFlag = config.inspect(FLAG)?.globalValue;
  const messages = [], statuses = [], observations = [];
  let pick, dest, allow = true, lastPreview;
  const patch = (name, value) => {
    originals.set(name, api[name]);
    api[name] = value;
  };
  const uri = (relative) => vscode.Uri.joinPath(folder.uri, relative);
  const write = async (relative, text) => {
    await (0, import_promises.mkdir)((0, import_node_path.dirname)((0, import_node_path.join)(root, relative)), { recursive: true });
    await (0, import_promises.writeFile)((0, import_node_path.join)(root, relative), text, { flag: "wx" });
  };
  const status = async (command, expected, target) => {
    const result2 = await vscode.commands.executeCommand(command, ...target ? [target] : []);
    statuses.push({ command, status: result2?.status });
    import_strict.default.deepEqual(result2, { status: expected });
  };
  const check = async (id, action) => {
    const observation = { id, status: "NOT_RUN" };
    observations.push(observation);
    try {
      await action();
      observation.status = "PASS";
    } catch (error) {
      observation.status = "FAIL";
      observation.diagnostic = error instanceof Error ? error.name + ": " + error.message.split("\n")[0].slice(0, 160) : "UnknownFailure";
    }
    console.log(`LITE_POLICY_HOST ${phase} ${id} ${observation.status}`);
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
    import_strict.default.ok(!text.includes(PRIVATE));
  };
  const retained = async () => {
    await withheld(".config/gcloud/application_default_credentials.json");
    await withheld("imported.txt");
    await withheld("team.txt");
    const safe = await vscode.commands.executeCommand("soterai.readProjectFileSafely", uri("memo.txt"));
    import_strict.default.equal(safe.status, "ALLOWED_ONCE");
    import_strict.default.match(safe.text ?? "", /MASKED/);
    import_strict.default.ok(!safe.text?.includes(PRIVATE));
    import_strict.default.equal(await preview("public.txt"), PUBLIC);
  };
  try {
    patch("showInformationMessage", async (message) => {
      messages.push(message);
      return void 0;
    });
    patch("showErrorMessage", async () => void 0);
    patch("showWarningMessage", async (_message, ...items) => items.includes("Allow safe read once") ? "Allow safe read once" : allow && items.includes("Add protection") ? "Add protection" : void 0);
    patch("showWorkspaceFolderPick", async () => folder);
    patch("showOpenDialog", async () => pick ? [pick] : void 0);
    patch("showSaveDialog", async () => dest);
    patch("showQuickPick", async (items) => items.find((item) => item.id === "ci"));
    patch("showTextDocument", async (document, ...args) => {
      if (document.uri.scheme === "soterai-redacted") lastPreview = document.getText();
      return originals.get("showTextDocument")(document, ...args);
    });
    await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
    if (phase === "save") {
      for (const relative of ["memo.txt", "imported.txt", "team.txt", "manual-sensitive.txt", ".config/gcloud/application_default_credentials.json"]) await write(relative, PRIVATE);
      await write("public.txt", PUBLIC);
      await write(".vscode/settings.json", "{}");
      await write(".soterai/incoming.json", JSON.stringify(policy(["memo.txt"], [{ kind: "file", pattern: "imported.txt" }])));
      await check("F02-H01", async () => {
        await withheld(".config/gcloud/application_default_credentials.json");
        import_strict.default.equal(await preview("public.txt"), PUBLIC);
      });
      await check("F02-H02", async () => {
        await write(".soterai/team-policy.json", JSON.stringify(policy(["memo.txt"], [{ kind: "file", pattern: "team.txt" }])));
        await withheld("team.txt");
        await (0, import_promises.unlink)((0, import_node_path.join)(root, ".soterai/team-policy.json"));
        await withheld("team.txt");
      });
      await check("F02-H03", async () => {
        pick = void 0;
        await status("soterai.importLitePolicy", "CANCELLED");
        pick = uri(".soterai/incoming.json");
        allow = false;
        await status("soterai.importLitePolicy", "CANCELLED");
        allow = true;
        await status("soterai.importLitePolicy", "SAVED");
        await write(".soterai/future.json", JSON.stringify({ ...policy(), schemaVersion: 99 }));
        pick = uri(".soterai/future.json");
        const before = messages.length;
        await status("soterai.importLitePolicy", "FAILED");
        import_strict.default.ok(!messages.slice(before).some((text) => /saved/i.test(text)));
        await retained();
      });
      await check("F02-H04", async () => {
        await status("soterai.applyLitePolicyPreset", "SAVED");
        await withheld(".vscode/settings.json");
      });
      await check("F02-H05", async () => {
        await status("soterai.restrictSensitiveFile", "SAVED", uri("manual-sensitive.txt"));
        dest = uri("policy.export.json");
        await status("soterai.exportLitePolicy", "EXPORTED");
        const text = await (0, import_promises.readFile)(dest.fsPath, "utf8"), exported = JSON.parse(text);
        import_strict.default.equal(exported.schemaVersion, 1);
        import_strict.default.ok(exported.sensitiveGlobs.length >= 200);
        import_strict.default.equal(new Set(exported.sensitiveGlobs).size, exported.sensitiveGlobs.length);
        import_strict.default.ok(exported.rules.paths.some((rule) => rule.pattern === "manual-sensitive.txt" && rule.sensitive === true));
        import_strict.default.ok(exported.presets.includes("ci"));
        import_strict.default.ok(exported.sensitiveGlobs.includes("memo.txt"));
        import_strict.default.ok(!text.includes(PRIVATE));
        await status("soterai.exportLitePolicy", "FAILED");
        import_strict.default.equal(await (0, import_promises.readFile)(dest.fsPath, "utf8"), text);
      });
      if (!observations.some((row) => row.status === "FAIL")) await write(".f02-save-receipt.json", JSON.stringify({ runtime, profile: (0, import_node_path.resolve)(profile), workspace: root }));
    } else await check("F02-H07", async () => {
      const saved = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(root, ".f02-save-receipt.json"), "utf8"));
      import_strict.default.equal(saved.runtime, runtime);
      import_strict.default.equal(saved.profile, (0, import_node_path.resolve)(profile));
      import_strict.default.equal(saved.workspace, root);
      await retained();
      await withheld(".vscode/settings.json");
    });
    await check("F02-H06", async () => {
      await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
      for (const command of ["soterai.importLitePolicy", "soterai.exportLitePolicy", "soterai.applyLitePolicyPreset"]) await status(command, "UNAVAILABLE");
      await retained();
      await withheld(".vscode/settings.json");
    });
  } finally {
    for (const [name, value] of originals) api[name] = value;
    await config.update(FLAG, oldFlag, vscode.ConfigurationTarget.Global);
  }
  const result = {
    schemaVersion: 1,
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    phase,
    syntheticOnly: true,
    workspace: root,
    declaredProfilePath: (0, import_node_path.resolve)(profile),
    hostVersion: vscode.version,
    extensionBundleSha256: runtime,
    currentDeveloperBundleSha256: sha(await (0, import_promises.readFile)(bundle)),
    hostProbeSha256: sha(await (0, import_promises.readFile)(__filename)),
    observations,
    commandStatuses: statuses,
    passed: observations.filter((row) => row.status === "PASS").length,
    failed: observations.filter((row) => row.status === "FAIL").length,
    identityScope: "Byte-identical packaged runtime in a normal isolated developer window with a test-only bootstrap; no clean-profile installed-VSIX or authenticated memory claim.",
    independence: "LOW",
    externalAgents: "NOT_TESTED"
  };
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  import_strict.default.equal(result.currentDeveloperBundleSha256, runtime);
  if (result.failed) throw new Error("F02 host assertions failed; inspect raw observations.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  run
});
