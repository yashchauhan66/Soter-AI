"use strict";
// Offline evidence helpers; Git calls are read-only. No application execution.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), cp = require("node:child_process"), assert = require("node:assert/strict");
const repo = path.resolve(__dirname, "../../../.."), base = path.relative(repo, __dirname).replaceAll("\\", "/");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex"), bytes = file => fs.readFileSync(file), hash = file => sha(bytes(file));
const read = file => JSON.parse(bytes(file).toString("utf8").replace(/^\uFEFF/, ""));
function inside(root, name) { const file = path.resolve(root, name), rel = path.relative(root, file); assert.ok(rel && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel), "Path escaped declared root."); return file; }
function own(name) { assert.equal(typeof name, "string"); assert.ok(!path.isAbsolute(name) && !name.split(/[\\/]/).includes("..")); return inside(__dirname, name); }
const relative = file => path.relative(repo, path.resolve(file)).replaceAll("\\", "/");
function fileFact(file) { const stat = fs.lstatSync(file); assert.ok(stat.isFile() && !stat.isSymbolicLink()); return { path: relative(file), bytes: stat.size, sha256: hash(file) }; }
function bound(spec) { assert.ok(spec && typeof spec === "object"); assert.match(spec.sha256 ?? "", /^[a-f0-9]{64}$/); const file = own(spec.path); assert.equal(hash(file), spec.sha256); return file; }
const git = (...args) => cp.execFileSync("git", ["-c", "core.autocrlf=false", ...args], { cwd: repo, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
const lines = buffer => buffer.toString("utf8").trim().split(/\r?\n/).filter(Boolean);
function noOutputs(names) { for (const name of names) assert.ok(!fs.existsSync(own(name)), "Immutable output exists: " + name); }
function write(name, value) { fs.writeFileSync(own(name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" }); }
function tap(file) { const text = bytes(file).toString("utf8"), result = {}; for (const key of ["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"]) { const matches = [...text.matchAll(new RegExp("^# " + key + " (\\d+)\\r?$", "gm"))]; assert.equal(matches.length, 1, "One final TAP summary required: " + key); result[key] = Number(matches[0][1]); } return result; }
function check(spec) { const log = own(spec.log), receipt = read(log + ".result.json"); assert.equal(receipt.exitCode, 0); assert.equal(hash(log), receipt.sha256.toLowerCase()); assert.equal(path.resolve(receipt.output), log); let counts;
 if (spec.kind === "tap") { counts = tap(log); for (const key of ["tests", "pass", "fail", "cancelled", "skipped"]) assert.equal(counts[key], spec.expected[key]); assert.equal(counts.fail, 0); assert.equal(counts.cancelled, 0); assert.equal(counts.todo, 0); assert.equal(counts.tests, counts.pass + counts.skipped); }
 return { role: spec.role, log: relative(log), receipt: relative(log + ".result.json"), ...receipt, ...(counts ? { counts } : {}), logSha256: hash(log), receiptSha256: hash(log + ".result.json") }; }
const sourcePaths = [
  "docs/soterai-lite/FEATURE-QUEUE.json",
  "docs/soterai-lite/ledger.md",
  "docs/vscode-extension-readiness.md",
  "packages/core/src/GitBashCommand.ts",
  "packages/core/src/index.ts",
  "packages/soterai-lite/README.md",
  "packages/soterai-lite/package.json",
  "packages/vscode-extension/README.md",
  "packages/vscode-extension/package.json",
  "packages/vscode-extension/src/__tests__/checkedGitBashCommands.test.ts",
  "packages/vscode-extension/src/__tests__/checkedGitBashControllerReview.test.ts",
  "packages/vscode-extension/src/__tests__/checkedGitBashProfile.test.ts",
  "packages/vscode-extension/src/__tests__/gitBashBomReview.test.ts",
  "packages/vscode-extension/src/__tests__/gitBashCommand.test.ts",
  "packages/vscode-extension/src/__tests__/gitBashOutputBinding.test.ts",
  "packages/vscode-extension/src/__tests__/gitBashWorker.test.ts",
  "packages/vscode-extension/src/__tests__/host/liteCmdBom.host.ts",
  "packages/vscode-extension/src/__tests__/host/liteGitBash.host.ts",
  "packages/vscode-extension/src/ai-boundary/BoundarySnapshot.ts",
  "packages/vscode-extension/src/extension.ts",
  "packages/vscode-extension/src/firewall/VaultManager.ts",
  "packages/vscode-extension/src/firewall/commands.ts",
  "packages/vscode-extension/src/terminal/CheckedGitBashProfile.ts",
  "packages/vscode-extension/src/terminal/CheckedPowerShellSession.ts",
  "packages/vscode-extension/src/terminal/CmdWorker.ts",
  "packages/vscode-extension/src/terminal/GitBashWorker.ts",
  "packages/vscode-extension/src/terminal/gitBashCommands.ts"
];
const indexOnlyPaths = [
  "docs/soterai-lite/LITE-CATALOG.json",
  "packages/vscode-extension/src/__tests__/checkedCmdCommands.test.ts",
  "packages/vscode-extension/src/__tests__/checkedCmdControllerReview.test.ts",
  "packages/vscode-extension/src/__tests__/checkedCmdProfile.test.ts",
  "packages/vscode-extension/src/__tests__/checkedGitMetadata.test.ts",
  "packages/vscode-extension/src/__tests__/checkedGitMetadataActual.test.ts",
  "packages/vscode-extension/src/__tests__/checkedGitMetadataAliases.test.ts",
  "packages/vscode-extension/src/__tests__/checkedGitMetadataAttributes.test.ts",
  "packages/vscode-extension/src/__tests__/checkedGitMetadataNativeEnvironment.test.ts",
  "packages/vscode-extension/src/__tests__/checkedGitMetadataObjectInfo.test.ts",
  "packages/vscode-extension/src/__tests__/checkedGitMetadataQuotedNames.test.ts",
  "packages/vscode-extension/src/__tests__/checkedPowerShellCommands.test.ts",
  "packages/vscode-extension/src/__tests__/checkedPowerShellControllerReview.test.ts",
  "packages/vscode-extension/src/__tests__/checkedPowerShellProfile.test.ts",
  "packages/vscode-extension/src/__tests__/checkedPowerShellPublicationReview.test.ts",
  "packages/vscode-extension/src/__tests__/checkedPowerShellRootListing.test.ts",
  "packages/vscode-extension/src/__tests__/checkedPowerShellSession.test.ts",
  "packages/vscode-extension/src/__tests__/checkedPowerShellSessionOwnership.test.ts",
  "packages/vscode-extension/src/__tests__/checkedPowerShellSessionReview.test.ts",
  "packages/vscode-extension/src/__tests__/cmdCommand.test.ts",
  "packages/vscode-extension/src/__tests__/cmdLiteralReview.test.ts",
  "packages/vscode-extension/src/__tests__/cmdOutputBinding.test.ts",
  "packages/vscode-extension/src/__tests__/cmdTerminal.test.ts",
  "packages/vscode-extension/src/__tests__/cmdWorker.test.ts",
  "packages/vscode-extension/src/__tests__/extension.test.ts",
  "packages/vscode-extension/src/__tests__/host/liteCmd.host.ts",
  "packages/vscode-extension/src/__tests__/host/litePowerShell51.host.ts",
  "packages/vscode-extension/src/__tests__/managedOutputFilter.test.ts",
  "packages/vscode-extension/src/__tests__/managedOutputFilterReview.test.ts",
  "packages/vscode-extension/src/__tests__/powerShell51Command.test.ts",
  "packages/vscode-extension/src/__tests__/powerShell51Terminal.test.ts",
  "packages/vscode-extension/src/__tests__/powerShell51TerminalReview.test.ts",
  "packages/vscode-extension/src/__tests__/powerShell51Worker.test.ts"
];
module.exports = { fs, path, assert, repo, base, sha, bytes, hash, read, inside, own, relative, fileFact, bound, git, lines, noOutputs, write, tap, check, sourcePaths, indexOnlyPaths };
