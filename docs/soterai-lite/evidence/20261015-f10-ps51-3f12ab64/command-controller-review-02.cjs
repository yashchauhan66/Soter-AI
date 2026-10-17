"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "../../../..");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const files = ["packages/vscode-extension/src/__tests__/checkedPowerShellCommands.test.ts", "packages/vscode-extension/src/__tests__/checkedPowerShellControllerReview.test.ts",
    "packages/vscode-extension/src/terminal/commands.ts", "packages/vscode-extension/src/terminal/CheckedPowerShellProfile.ts", "packages/vscode-extension/src/terminal/CheckedPowerShellSession.ts"].map(file => {
    const bytes = fs.readFileSync(path.join(root, file)); return { file, bytes: bytes.length, sha256: hash(bytes) };
});
const result = { schemaVersion: 1, observedAt: new Date().toISOString(), scope: "LOW same-lineage static review and synthetic fixture authoring; no compiler/full/native execution by reviewer.", files,
    commandFixture: { freeze: "command-fixtures-freeze-02.json", declarations: 30, expandedTests: 42,
        correctedUnexecutedSetup: "Rest-tuple register helper preserves explicit undefined bridge; default parameter previously substituted the real fixture bridge.",
        missingModuleBaseline: "NOT_EXECUTED. Frozen before production; sandbox commands-before-02 failed spawn EPERM before assertions; required-escalation commands-before-03 tool call was aborted after 754.4 seconds, with no raw output files. Production target was authored subsequently. No simulated missing-module result is claimed.",
        attemptedCommand: "& '.\\docs\\soterai-lite\\evidence\\20261015-f10-ps51-3f12ab64\\run-f10-check.ps1' -Name 'commands-before-02' -Tests 'checkedPowerShellCommands.test.ts'",
        escalationAttempt: "Same harness -Name commands-before-03 -Tests checkedPowerShellCommands.test.ts, sandbox_permissions=require_escalated; aborted by user.",
        raw: "commands-before-02.txt", rawSha256: hash(fs.readFileSync(path.join(__dirname, "commands-before-02.txt"))) },
    findings: [{ id: "F10-CR02", statusAtReview: "FAIL", issue: "Sparse persisted ownership arrays skip validation because Array.map skips holes, allowing malformed admission and later rewriting corrupt metadata.", requested: "Require a dense plain array with exact data-element descriptors before parsing all rows; on any failure retain bytes and withhold admission." },
        { id: "F10-CR04", statusAtReview: "FAIL", issue: "shutdown awaits an unbounded globalState.update Promise through persist(), so storage stalls can block deactivation indefinitely.", requested: "Use a bounded shutdown flush while preserving pending ownership and cooperative cancellation; never force child completion or signal a PID." }],
    reviewFixture: { tests: 6, currentSha256: files[1].sha256, note: "before-01 ran first revision with weak shutdown-only CR03 positive. CR03 then strengthened to actual PUBLIC session admission with fake worker.start that cannot spawn; rejected durable write must prevent start and later tab admission. Current six-test fixture was frozen before root fixes.",
        initialBaseline: "controller-review-before-01.txt", initialRawSha256: hash(fs.readFileSync(path.join(__dirname, "controller-review-before-01.txt"))), testsBefore01: 6, passBefore01: 2, failBefore01: 4 },
    reviewedExistingControls: "Session O01/O02/O03/O04/O05/O06/O11 cover awaited READY admission, refusal/withdrawal, root and policy drift, actual completion and observer failure. Profile receipt uses PREPARED-before-settings, selected-scope/root/current-value rechecks and recoverable undo; no new concrete profile data-loss finding from this review.",
    residualLimits: "No independent/human verification, OS boundary, arbitrary shell mediation or new coverage/rating claim. Existing root-owned later test results remain separate receipts." };
fs.writeFileSync(path.join(__dirname, "command-controller-review-02.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify({ review: "command-controller-review-02.json", sha256: hash(fs.readFileSync(path.join(__dirname, "command-controller-review-02.json"))) }) + "\n");
