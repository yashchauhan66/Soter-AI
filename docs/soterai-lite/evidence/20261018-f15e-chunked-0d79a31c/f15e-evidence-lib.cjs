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
const git = require("./git-batch-01.cjs").createGit(repo);
const lines = buffer => buffer.toString("utf8").trim().split(/\r?\n/).filter(Boolean);
function noOutputs(names) { for (const name of names) assert.ok(!fs.existsSync(own(name)), "Immutable output exists: " + name); }
function write(name, value) { fs.writeFileSync(own(name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" }); }
function tap(file) { const text = bytes(file).toString("utf8"), result = {}; for (const key of ["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"]) { const matches = [...text.matchAll(new RegExp("^# " + key + " (\\d+)\\r?$", "gm"))]; assert.equal(matches.length, 1, "One final TAP summary required: " + key); result[key] = Number(matches[0][1]); } return result; }
function check(spec) { const log = own(spec.log), receipt = read(log + ".result.json"); assert.equal(receipt.exitCode, 0); assert.equal(hash(log), receipt.sha256.toLowerCase()); assert.equal(path.resolve(receipt.output), log); let counts;
 if (spec.kind === "tap") { counts = tap(log); for (const key of ["tests", "pass", "fail", "cancelled", "skipped"]) assert.equal(counts[key], spec.expected[key]); assert.equal(counts.fail, 0); assert.equal(counts.cancelled, 0); assert.equal(counts.todo, 0); assert.equal(counts.tests, counts.pass + counts.skipped); }
 return { role: spec.role, log: relative(log), receipt: relative(log + ".result.json"), ...receipt, ...(counts ? { counts } : {}), logSha256: hash(log), receiptSha256: hash(log + ".result.json") }; }
const sourcePaths = [
  "packages/vscode-extension/src/__tests__/gatewayChunkedHeaders.test.ts",
  "packages/vscode-extension/src/__tests__/gatewayChunkedWire.test.ts",
  "apps/local-ai-broker/src/__tests__/broker.test.ts",
  "apps/local-ai-broker/src/BoundedJson.ts",
  "apps/local-ai-broker/src/BoundedGzip.ts",
  "apps/local-ai-broker/src/BoundedBrotli.ts",
  "apps/local-ai-broker/src/BoundedDeflate.ts",
  "packages/vscode-extension/src/__tests__/gatewayDeflateDecoder.test.ts",
  "packages/vscode-extension/src/__tests__/gatewayDeflateWire.test.ts",
  "packages/vscode-extension/src/__tests__/gatewayBrotliDecoder.test.ts",
  "packages/vscode-extension/src/__tests__/gatewayBrotliWire.test.ts",
  "packages/vscode-extension/src/__tests__/gatewayGzipDecoder.test.ts",
  "packages/vscode-extension/src/__tests__/gatewayGzipWire.test.ts",
  "apps/local-ai-broker/src/BrokerServer.ts",
  "apps/local-ai-broker/src/cli.ts",
  "packages/vscode-extension/src/broker/BrokerManager.ts",
  "packages/vscode-extension/src/__tests__/gatewayJsonDecoder.test.ts",
  "packages/vscode-extension/src/__tests__/gatewayJsonWire.test.ts",
  "packages/vscode-extension/src/__tests__/ownedBrokerManager.test.ts",
  "packages/vscode-extension/src/__tests__/host/liteGatewayChunked.host.ts",
  "packages/vscode-extension/src/ai-boundary/BoundarySnapshot.ts",
  "packages/vscode-extension/package.json",
  "packages/soterai-lite/package.json",
  "packages/vscode-extension/README.md",
  "packages/soterai-lite/README.md",
  "docs/vscode-extension-readiness.md",
  "docs/soterai-lite/FEATURE-QUEUE.json",
  "docs/soterai-lite/ledger.md"
];
const indexOnlyPaths = ["docs/soterai-lite/LITE-CATALOG.json"];
module.exports = { fs, path, assert, repo, base, sha, bytes, hash, read, inside, own, relative, fileFact, bound, git, lines, noOutputs, write, tap, check, sourcePaths, indexOnlyPaths };
