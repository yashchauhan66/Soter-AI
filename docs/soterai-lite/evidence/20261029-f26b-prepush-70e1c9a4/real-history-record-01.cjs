"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const root = process.cwd(), evidence = __dirname;
function record(relative) { const file = path.join(root, relative), raw = fs.readFileSync(file); return { path: relative, bytes: raw.length, sha256: sha(raw) }; }
const actualPath = path.join(evidence, "real-history-focused-02.txt"), actual = fs.readFileSync(actualPath), actualText = actual.toString("utf8");
const fakePath = path.join(evidence, "git-reader-focused-02.txt"), fake = fs.readFileSync(fakePath), fakeText = fake.toString("utf8");
const receipt = file => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
for (const [file, bytes] of [[actualPath, actual], [fakePath, fake]]) { const r = receipt(file + ".result.json"); assert.equal(r.exitCode, 0); assert.equal(r.sha256.toLowerCase(), sha(bytes)); }
assert(/^# tests 14\r?$/m.test(actualText) && /^# pass 14\r?$/m.test(actualText) && /^# fail 0\r?$/m.test(actualText));
assert(/^# tests 29\r?$/m.test(fakeText) && /^# pass 29\r?$/m.test(fakeText) && /^# fail 0\r?$/m.test(fakeText));
const scans = actualText.split(/\r?\n/).filter(line => line.startsWith('# {"fixture":')).map(line => JSON.parse(line.slice(2)));
assert.equal(scans.length, 18);
const children = scans.flatMap(scan => scan.children);
assert(children.length > 0);
for (const child of children) { assert(child.close && child.stdoutEOF && child.stderrEOF); assert.equal(child.signal, null); assert.equal(child.signalsRequested, 0); }
for (const scan of scans) { assert(scan.fixture.startsWith("D:\\SoterAI-Lite-test-profiles\\f03-unit-temp\\soter-f26b-real-history-")); assert(scan.operations.every(operation => ["version", "commits", "tree", "batch"].includes(operation))); }
const redaction = receipt(path.join(evidence, "real-history-privacy-redaction-01.json"));
assert.equal(redaction.diagnosticBlocksRedacted, 14); assert.equal(redaction.redactedSha256, sha(fs.readFileSync(path.join(evidence, "real-history-focused-01.txt"))));
const result = { status: "FOCUSED_43_PASS_REAL_READONLY_HISTORY_AND_FAKE_LIFECYCLE_NOT_FEATURE_ACCEPTANCE", observedAt: new Date().toISOString(),
    fakeLifecycleTests: 29, actualHistoryTests: 14, actualScans: scans.length, actualChildren: children.length,
    actualChildOwnership: "ALL_ACTUAL_CLOSE_BOTH_EOF_NO_SIGNALS", operationCounts: Object.fromEntries(["version", "commits", "tree", "batch"].map(kind => [kind, children.filter(child => child.operation === kind).length])),
    outcomes: Object.fromEntries(["ALLOW", "BLOCK", "UNAVAILABLE", "STOP_UNCONFIRMED"].map(status => [status, scans.filter(scan => scan.status === status).length])),
    sources: ["packages/vscode-extension/src/__tests__/prePushGitProcess.test.ts", "packages/vscode-extension/src/__tests__/prePushActualHistory.test.ts"].map(record),
    testedProduction: ["packages/vscode-extension/src/history-hooks/CheckedPushRefs.ts", "packages/vscode-extension/src/history-hooks/PushRootSnapshot.ts", "packages/vscode-extension/src/history-hooks/PrePushGitProcess.ts", "packages/vscode-extension/src/history-hooks/PrePushScan.ts"].map(record),
    outputHashes: { fake: sha(fake), actual: sha(actual) },
    baselines: { fake01: "SANDBOX_WORKER_SPAWN_EPERM_NO_TESTS_EXECUTED", actual01: "14_TEST_FAILURES_PROCESS_ENV_EXOTIC_OBJECT_VS_PLAIN_SNAPSHOT_ASSERTION; PRIVACY_DIAGNOSTIC_BLOCKS_REDACTED; NO_BEHAVIORAL_PASS_INFERRED", redaction },
    seams: { fakeLifecycle: "Manual synthetic metadata with genuine checked capability; all spawn/child lifecycle events are fake", actualHistory: "Manually authored genuine loose Git objects; real installed Git; spawn observer adds assertions/ownership observations only; no response substitution" },
    scope: "Synthetic D: roots retained; exact installed Git hash; fixed argv and minimal environment; no worktree/index scan, push, network, native09, Code, deletion or signals",
    limitations: "Focused tests do not establish signed endpoint/client/controller/native VSIX route, real owner push, restore, packaging, full-suite/affected acceptance, or feature DONE", signalsRequested: 0 };
fs.writeFileSync(path.join(evidence, "real-history-summary-01.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify({ status: result.status, fakeTests: 29, actualTests: 14, scans: scans.length, children: children.length, operations: result.operationCounts, outcomes: result.outcomes }) + "\n");
