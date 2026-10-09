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

// packages/vscode-extension/src/__tests__/host/securityReview.host.ts
var securityReview_host_exports = {};
__export(securityReview_host_exports, {
  run: () => run
});
module.exports = __toCommonJS(securityReview_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var fs = __toESM(require("node:fs/promises"));
var import_node_path2 = __toESM(require("node:path"));
var import_node_crypto = require("node:crypto");
var import_node_child_process = require("node:child_process");
var import_node_util = require("node:util");
var import_node_http = require("node:http");

// packages/vscode-extension/src/security/ReviewEvidence.ts
var import_promises = require("node:fs/promises");
var import_node_path = __toESM(require("node:path"));
async function writeReviewEvidence(filename, record, enabled = process.env.SOTERAI_REVIEW_UNIQUE_EVIDENCE === "1") {
  if (!enabled) throw new Error("Unique review evidence is disabled. The host review cannot run safely.");
  if (!import_node_path.default.isAbsolute(filename)) throw new Error("Review evidence requires an absolute per-run path.");
  await (0, import_promises.writeFile)(filename, JSON.stringify(record, null, 2), { encoding: "utf8", flag: "wx" });
}

// packages/vscode-extension/src/__tests__/host/securityReview.host.ts
var execute = (0, import_node_util.promisify)(import_node_child_process.execFile);
async function run() {
  const root = await fs.realpath(process.env.SOTERAI_REVIEW_WORKSPACE);
  import_strict.default.equal(await fs.readFile(import_node_path2.default.join(root, ".synthetic-review-lab"), "utf8"), "synthetic-only-v1");
  import_strict.default.equal(vscode.workspace.workspaceFolders?.[0].uri.fsPath.toLowerCase(), root.toLowerCase());
  const evidence = process.env.SOTERAI_REVIEW_EVIDENCE;
  import_strict.default.equal(process.env.SOTERAI_REVIEW_UNIQUE_EVIDENCE, "1", "unique evidence recording is required");
  import_strict.default.ok(import_node_path2.default.isAbsolute(evidence), "per-run evidence path is required");
  const results = [];
  const canary = () => "amber ridge " + (0, import_node_crypto.randomBytes)(8).toString("hex").match(/.{4}/g).join(" ");
  const report = (attack, leaked, boundary, value) => results.push({
    attack,
    status: leaked ? "LEAK_CONFIRMED" : "BLOCKED_SCOPED",
    boundary,
    canarySha256: value ? (0, import_node_crypto.createHash)("sha256").update(value).digest("hex") : void 0
  });
  const values = /* @__PURE__ */ new Map([[".env", canary()], ["nested/private.txt", canary()], ["private.pem", canary()], ["selected.txt", canary()]]);
  await fs.mkdir(import_node_path2.default.join(root, "nested"));
  for (const [relative, value] of values) await fs.writeFile(import_node_path2.default.join(root, relative), relative === "private.pem" ? "-----BEGIN PRIVATE KEY-----\n" + value + "\n-----END PRIVATE KEY-----\n" : value);
  const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
  import_strict.default.ok(extension, "development extension is missing");
  await extension.activate();
  import_strict.default.ok(extension.isActive);
  await vscode.commands.executeCommand("soterai.enableProtectedWorkspace");
  const preview = async (relative) => {
    await vscode.commands.executeCommand("soterai.openRedactedPreview", vscode.Uri.file(import_node_path2.default.join(root, relative)));
    import_strict.default.equal(vscode.window.activeTextEditor?.document.uri.scheme, "soterai-redacted");
    return vscode.window.activeTextEditor.document.getText();
  };
  for (const relative of [".env", "nested", "private.pem"]) {
    await vscode.commands.executeCommand("soterai.blockFromAI", vscode.Uri.file(import_node_path2.default.join(root, relative)));
  }
  const selection = await vscode.workspace.openTextDocument(vscode.Uri.file(import_node_path2.default.join(root, "selected.txt")));
  const editor = await vscode.window.showTextDocument(selection);
  editor.selection = new vscode.Selection(selection.positionAt(0), selection.positionAt(selection.getText().length));
  await vscode.commands.executeCommand("soterai.blockSelectionFromAI");
  for (const [relative, value] of values) {
    const redacted = await preview(relative);
    import_strict.default.ok(!redacted.includes(value), relative + " leaked through redacted preview");
    report(relative + " redacted preview", false, "actual SoterAI preview", value);
    import_strict.default.ok((await fs.readFile(import_node_path2.default.join(root, relative), "utf8")).includes(value));
    report(relative + " direct filesystem read", true, "Node fs in actual extension host", value);
  }
  const raw = values.get(".env");
  await fs.link(import_node_path2.default.join(root, ".env"), import_node_path2.default.join(root, "hardlink.txt"));
  import_strict.default.ok((await fs.readFile(import_node_path2.default.join(root, "hardlink.txt"), "utf8")).includes(raw));
  report("hardlink direct read", true, "unmanaged filesystem alias", raw);
  import_strict.default.ok(!(await preview("hardlink.txt")).includes(raw));
  report("hardlink redacted preview", false, "SoterAI path validation", raw);
  await fs.symlink(import_node_path2.default.join(root, "nested"), import_node_path2.default.join(root, "junction"), process.platform === "win32" ? "junction" : "dir");
  const nested = values.get("nested/private.txt");
  import_strict.default.ok((await fs.readFile(import_node_path2.default.join(root, "junction/private.txt"), "utf8")).includes(nested));
  report("junction direct read", true, "unmanaged filesystem alias", nested);
  import_strict.default.ok(!(await preview("junction/private.txt")).includes(nested));
  report("junction redacted preview", false, "SoterAI path validation", nested);
  const custom = "note " + (0, import_node_crypto.randomBytes)(4).toString("hex");
  await fs.writeFile(import_node_path2.default.join(root, "custom.txt"), custom);
  import_strict.default.ok((await preview("custom.txt")).includes(custom), "negative control was unexpectedly withheld");
  await fs.writeFile(import_node_path2.default.join(root, ".aiignore"), "custom.txt\n");
  import_strict.default.ok(!(await preview("custom.txt")).includes(custom));
  report("repository deny rule", false, "SoterAI preview", custom);
  await fs.writeFile(import_node_path2.default.join(root, ".aiignore"), "");
  import_strict.default.ok((await preview("custom.txt")).includes(custom));
  report("agent edits repository deny policy", true, "writable .aiignore", custom);
  const envResult = await execute(process.execPath, ["-e", "process.stdout.write(process.env.SOTERAI_SYNTHETIC_CANARY)"], {
    env: { SystemRoot: process.env.SystemRoot, ELECTRON_RUN_AS_NODE: "1", SOTERAI_SYNTHETIC_CANARY: raw },
    windowsHide: true,
    timeout: 1e4
  });
  import_strict.default.equal(envResult.stdout, raw);
  report("runtime environment and command output", true, "synthetic injected child environment; not the broker child", raw);
  const git = process.env.SOTERAI_REVIEW_GIT;
  if (git) {
    const hooks = import_node_path2.default.join(root, "empty-hooks");
    await fs.mkdir(hooks);
    const gitRun = (args) => execute(git, [
      "-c",
      "core.hooksPath=" + hooks,
      "-c",
      "core.fsmonitor=false",
      "-c",
      "commit.gpgSign=false",
      "-c",
      "user.name=Synthetic Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      ...args
    ], {
      cwd: root,
      env: { SystemRoot: process.env.SystemRoot, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_TERMINAL_PROMPT: "0" },
      windowsHide: true,
      timeout: 15e3
    });
    await gitRun(["init", "--quiet", "--template=" + hooks]);
    await fs.writeFile(import_node_path2.default.join(root, "history.txt"), custom);
    await gitRun(["add", "--", "history.txt"]);
    await gitRun(["commit", "--quiet", "-m", "Synthetic canary only"]);
    await fs.writeFile(import_node_path2.default.join(root, "history.txt"), "Public replacement.");
    const old = await gitRun(["show", "HEAD:history.txt"]);
    import_strict.default.equal(old.stdout, custom);
    report("Git object after working-tree replacement", true, "unmanaged git show", custom);
  }
  let capture = "";
  const receiver = (0, import_node_http.createServer)((req, res) => {
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      capture += chunk;
    });
    req.on("end", () => res.end("public-control"));
  });
  await new Promise((resolve) => receiver.listen(0, "127.0.0.1", resolve));
  try {
    const address = receiver.address();
    import_strict.default.ok(address && typeof address === "object");
    const payload = JSON.stringify({ fragments: [Buffer.from(raw).toString("base64").slice(0, 12), Buffer.from(raw).toString("base64").slice(12)] });
    const response = await fetch(`http://127.0.0.1:${address.port}/synthetic-only`, { method: "POST", body: payload });
    import_strict.default.equal(await response.text(), "public-control");
    import_strict.default.equal(JSON.parse(capture).fragments.join(""), Buffer.from(raw).toString("base64"));
    report("encoded chunked exfiltration", true, "independent HTTP to local synthetic receiver only", raw);
  } finally {
    receiver.closeAllConnections();
    await new Promise((resolve) => receiver.close(() => resolve()));
  }
  await writeReviewEvidence(evidence, {
    runId: process.env.SOTERAI_REVIEW_RUN_ID,
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    host: vscode.version,
    extension: extension.packageJSON.version,
    extensionBundleSha256: (0, import_node_crypto.createHash)("sha256").update(await fs.readFile(import_node_path2.default.join(extension.extensionPath, "dist", "extension.js"))).digest("hex"),
    hostProbeSha256: (0, import_node_crypto.createHash)("sha256").update(await fs.readFile(__filename)).digest("hex"),
    extensionActive: extension.isActive,
    protectedWorkspaceEnabled: true,
    syntheticOnly: true,
    liveModelContacted: false,
    results,
    limitations: ["No third-party assistant or remote provider was invoked", "File symlinks, screenshots, clipboard races, live disablement, /proc and privileged OS isolation not tested"]
  });
  console.log(JSON.stringify({
    syntheticReview: "completed",
    scopedBlocks: results.filter((r) => r.status === "BLOCKED_SCOPED").length,
    confirmedLeaks: results.filter((r) => r.status === "LEAK_CONFIRMED").length
  }));
  await vscode.commands.executeCommand("soterai.stopLocalAIBroker");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  run
});
