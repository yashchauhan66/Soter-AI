"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const file = path.join(__dirname, "native-prepush-02.host.ts.txt"), raw = fs.readFileSync(file), sha = value => crypto.createHash("sha256").update(value).digest("hex");
const parsed = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), "utf8").replace(/^\uFEFF/, ""));
const check = parsed("native-fixture-static-result-02.json"), receipt = parsed("native-fixture-static-03.txt.result.json");
assert.equal(check.status, "PASS_SOURCE_ONLY_NOT_EXECUTED_NO_DRIVER_EMIT"); assert.equal(check.sha256, sha(raw)); assert.equal(check.diagnostics.length, 0); assert.equal(check.parseErrors.length, 0);
assert.equal(receipt.exitCode, 0); assert.equal(receipt.sha256.toLowerCase(), sha(fs.readFileSync(path.join(__dirname, "native-fixture-static-03.txt"))));
let primary = 0, restart = 0;
const cases = check.cases.map(row => ({ id: "F26B-H" + (row.phase === "primary" ? "P" + String(++primary).padStart(2, "0") : "R" + String(++restart).padStart(2, "0")), ...row, execution: "NOT_RUN" }));
assert.equal(primary, 30); assert.equal(restart, 6);
const source = raw.toString("utf8");
for (const legacy of ["indexFile", "selectedFile", "ownerCommit", "setupGit", "commitProofs", "F26A", "F26a", "preCommit", "PreCommit"]) assert(!source.includes(legacy));
assert(source.includes('"pre-commit-client.js"')); // Existing exact fourth runtime, intentionally shared grammar.
assert(source.includes('environmentDigest() === parentEnvironment') && !source.includes('JSON.stringify(process.env)'));
assert(!/assert\.(?:deepEqual|equal|strictEqual|deepStrictEqual)\(process\.env\s*,/.test(source));
const manifest = { status: "PREPARED_NATIVE36_SOURCE_ONLY_NOT_EXECUTED", source: path.basename(file), bytes: raw.length, sha256: sha(raw), cases,
    expected: { primary: 30, restart: 6 }, syntaxAndStrictTypecheck: "ACTUAL_PASS_NO_DRIVER_EMIT", staticReceipt: "native-fixture-static-03.txt.result.json",
    invocation: { exports: ["beforeActivate", "run", "setupDiagnostic"], environmentPrefix: "SOTERAI_LITE_F26B_HOOK_", requiredSuffixes: ["PROFILE", "EVIDENCE", "PHASE", "DRIVER_KIND", "BUNDLE_SHA256", "WORKER_SHA256"],
        driverKind: "native-bootstrap", phases: ["primary", "restart"], marker: ".synthetic-lite-f26b-prepush-host", markerValue: "synthetic-only-v1", freshPrimaryRepository: "ABSENT_GIT_DIRECTORY_DRIVER_WRITES_MANUAL_LOOSE_SYNTHETIC_OBJECTS", requiredRoot: "D:\\SoterAI-Lite-test-profiles\\" },
    state: { restartState: "prepush-restart-state.json", syntheticTips: "prepush-synthetic-tips.json", primaryEditorClose: "prepush-editor-close.json", closeStatus: "ACTUAL_F26B_PRIMARY_EDITOR_CLOSED" },
    summary: { noTopLevelStatus: true, requiredScope: "F26B_COMPONENT_NATIVE_ROUTE_NOT_CONFIGURED_PUSH", requiredAssertions: ["expectedChecks matches phase", "all observations PASS with exact declared IDs", "failed=0/notRun=0", "busyChildren=0/timedOutChildren=0/signalsRequested=0", "every direct child actual close+bothEOF/no signals/no stream errors", "requests numeric-loopback signed generation/session/nonce/transcript/root identity match", "sourceDocument/body read counters zero", "parent environment digest unchanged", "actual runtime/manifest/source/vendor custody"],
        primaryContinuation: "readyForInterphase=true plus actual natural Code close0/bothEOF/two identity-aware absence observations/streamsStable before restart", restartFinal: "all owner listener records closed; explicit reviewed restore returns absence and original flag/policy facts" },
    externalGates: ["Root must build/bind exact fresh current F26b VSIX/four runtimes/full source proof; never old F26a source guards or VSIX", "Launcher must independently pin Code/Git/sh/vendor bytes before and after actual owned execution", "Launcher must retain natural editor close and both EOF receipts and real identity-aware absence observations; no signal including0", "No launch or executable materialization has occurred in this task", "Actual configured Git push still NOT_AUTHORIZED/NOT_RUN and required for feature DONE"],
    permittedChecks: "Direct installed hook invocation through exact pinned Git sh is COMPONENT_NATIVE_ROUTE only", noGitPush: true, noNative09: true, noDriverExecutable: true, independence: "LOW", observedAt: new Date().toISOString() };
fs.writeFileSync(path.join(__dirname, "native-fixture-manifest-02.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify({ status: manifest.status, sourceSha256: manifest.sha256, primary, restart, noOldIndexApiLeftovers: true, sourceStable: true, noExecutable: true }) + "\n");
