"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), cp = require("node:child_process");
const repo = path.resolve(__dirname, "../../../.."), relative = p => path.relative(repo, p).replaceAll("\\", "/");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const record = file => { const bytes = fs.readFileSync(file); return { path: relative(file), bytes: bytes.length, sha256: hash(bytes) }; };
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const git = args => { const r = cp.spawnSync("git", args, { cwd: repo, encoding: "utf8", windowsHide: true }); return { args, exitCode: r.status, stdout: r.stdout, stderr: r.stderr }; };
const sources = ["packages/core/src/PowerShell51Command.ts", "packages/core/src/index.ts",
 "packages/vscode-extension/src/firewall/VaultManager.ts", "packages/vscode-extension/src/firewall/VaultStorage.ts",
 "packages/vscode-extension/src/terminal/PowerShell51Worker.ts", "packages/vscode-extension/src/terminal/ManagedOutputBinding.ts",
 "packages/vscode-extension/src/terminal/ManagedOutputFilter.ts", "packages/vscode-extension/src/terminal/CheckedPowerShellSession.ts",
 "packages/vscode-extension/src/terminal/CheckedPowerShellProfile.ts",
 ...["powerShell51Command", "powerShell51Worker", "managedOutputFilter", "managedOutputFilterReview", "checkedPowerShellSession", "checkedPowerShellSessionReview", "checkedPowerShellProfile", "powerShell51Terminal", "checkedPowerShellCommands"].map(n => "packages/vscode-extension/src/__tests__/" + n + ".test.ts")];
const evidence = fs.readdirSync(__dirname).filter(n => fs.statSync(path.join(__dirname, n)).isFile()).sort();
const runs = evidence.filter(n => n.endsWith(".txt.result.json")).map(n => {
 const receipt = readJson(path.join(__dirname, n)), raw = fs.readFileSync(receipt.output), text = raw.toString("utf8");
 const totals = Object.fromEntries([...text.matchAll(/^# (tests|pass|fail|cancelled|skipped|suites) (\d+)\s*$/gm)].map(m => [m[1], +m[2]]));
 return { receipt: relative(path.join(__dirname, n)), command: receipt.file, arguments: receipt.arguments, observedAt: receipt.observedAt,
   exitCode: receipt.exitCode, rawSha256: hash(raw), receiptHashMatchesRaw: String(receipt.sha256).toLowerCase() === hash(raw), totals };
});
const result = { schemaVersion: 1, capturedAt: new Date().toISOString(), purpose: "User-requested new-chat handoff; F10 remains incomplete/uncommitted",
 git: { branch: git(["branch", "--show-current"]), head: git(["rev-parse", "HEAD"]), trackedChanges: git(["diff", "--name-only"]), staged: git(["diff", "--cached", "--name-only"]) },
 sourceFiles: sources.map(p => record(path.join(repo, p))), evidenceFiles: evidence.map(n => record(path.join(__dirname, n))), runs,
 lastAcceptedArtifact: record(path.join(repo, "packages/soterai-lite/soterai-lite-0.7.0-f09-20261015-attempt01.vsix")),
 catalog: record(path.join(repo, "docs/soterai-lite/LITE-CATALOG.json")), masterCopy: record(path.join(repo, "docs/soterai-lite/MASTER-PROMPT-20261016.txt")),
 notExecuted: ["F10 full-suite on final source", "F10 final typecheck after latest review fixes/new fixtures", "F10 VSIX/native/affected hosts", "PTY22 baseline", "registration fixture validation/baseline", "GIT metadata extension"],
 noActiveDelegatesAtHandoff: true, notes: ["Tracked ML/Gradle/results changes are unrelated; preserve and exclude them from F10 commits.", "The latest targeted75 PASS is a subset, not an aggregate current164-test suite PASS."] };
const target = path.join(__dirname, "handoff-checkpoint-01.json"); fs.writeFileSync(target, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify({ checkpoint: relative(target), sha256: hash(fs.readFileSync(target)), sourceFiles: result.sourceFiles.length, runs: result.runs.length,
 allRunReceiptHashesMatch: runs.every(r => r.receiptHashMatchesRaw), acceptedArtifact: result.lastAcceptedArtifact, catalog: result.catalog }, null, 2) + "\n");
