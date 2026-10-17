"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), cp = require("node:child_process");
const repo = path.resolve(__dirname, "../../../.."), sha = b => crypto.createHash("sha256").update(b).digest("hex");
const read = p => fs.readFileSync(path.join(repo, p));
const saved = JSON.parse(fs.readFileSync(path.join(__dirname, "handoff-checkpoint-01.json"), "utf8"));
const source = saved.sourceFiles.map(f => ({ path: f.path, expected: f.sha256, actual: sha(read(f.path)) }));
const git = args => cp.execFileSync("git", args, { cwd: repo, encoding: "utf8", windowsHide: true }).trim();
const head = git(["rev-parse", "HEAD"]), staged = git(["diff", "--cached", "--name-only"]);
const checks = { head: head === "24da9ce9907cd6082b7ce3a3e79136cd4c551508", noStaging: staged === "", artifact: sha(read(saved.lastAcceptedArtifact.path)) === saved.lastAcceptedArtifact.sha256,
 catalog: sha(read(saved.catalog.path)) === saved.catalog.sha256, master: sha(read("docs/soterai-lite/MASTER-PROMPT-20261016.txt")) === "2ea0c90b1fe3bdd591e5ae24470dcd8804abfff7a75741ec1f5a1aae7e4679ae" };
const result = { observedAt: new Date().toISOString(), head, staged, checks, source, mismatches: source.filter(f => f.expected !== f.actual), scope: "Checkpoint reconciliation only, no product acceptance" };
fs.writeFileSync(path.join(__dirname, "resume-reconciliation-01.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(result));
if (Object.values(checks).some(v => !v) || result.mismatches.length) process.exitCode = 1;
