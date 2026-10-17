"use strict";
// Deferred execution only. Explicit final root bindings are required; no result
// discovery, old-artifact fallback, publication or serial-queue transition.
const h = require("./f12-evidence-lib.cjs");
const { fs, path, assert, repo, base, sha, bytes, hash, read, inside, own, relative, fileFact, bound, git, lines, noOutputs, write, check, sourcePaths, indexOnlyPaths } = h;
const planFile = own(process.argv[2] ?? ""), plan = read(planFile), parent = "d46b845d047dc14d64bcdcbb6d8b3e9330a74334";
assert.equal(plan.schemaVersion, 1); assert.equal(plan.feature, "F12"); assert.equal(plan.parentCommit, parent);
assert.equal(lines(git("rev-parse", "HEAD"))[0], parent); assert.deepEqual(lines(git("diff", "--cached", "--name-only")), []);
assert.match(plan.artifact.path, /^packages\/soterai-lite\/soterai-lite-0\.7\.0-f12-202610(?:16|17)-attempt\d{2}\.vsix$/); assert.match(plan.artifact.sha256, /^[a-f0-9]{64}$/);
const artifactFile = inside(repo, plan.artifact.path); assert.equal(hash(artifactFile), plan.artifact.sha256);
const catalogPath = "docs/soterai-lite/LITE-CATALOG.json", catalogSha256 = hash(inside(repo, catalogPath));
assert.equal(catalogSha256, "1ce46192e9f315b5f2142c9f61542f1d513143dc2e19d4def6d95cea38c73ed4");
assert.deepEqual(lines(git("diff", "--name-only", "HEAD", "--", catalogPath)), []);
const linkedCatalogIds = read(inside(repo, catalogPath)).checks.filter(row => row.featureCards.includes("F12")).map(row => row.id);
const inspectionFile = bound(plan.inspection), inspection = read(inspectionFile);
assert.equal(path.resolve(inspection.vsix), artifactFile); assert.equal(inspection.sha256, plan.artifact.sha256);
assert.equal(inspection.status, "PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED"); assert.equal(inspection.entryCount, 14); assert.equal(inspection.runtimeCount, 3); assert.equal(inspection.forbiddenRuntimeInputs, 0);
assert.equal(inspection.machineSettings, 50); assert.equal(inspection.runtimeFlag, "soterai.lite.cmdTerminal"); assert.equal(inspection.profileId, "soterai.cmd.checked");
assert.deepEqual([...inspection.runtimeCommands].sort(), ["soterai.configureCheckedCmd", "soterai.openCheckedCmd", "soterai.runCheckedCmd", "soterai.restoreCheckedCmd", "soterai.checkedCmdStatus"].sort());
assert.deepEqual(inspection.sourceProvenance.inventory.map(row => row.name).sort(), ["extension.js", "local-ai-broker.js", "soterai-mcp-server.js"].sort());
const runtime = inspection.sourceProvenance.inventory.find(row => row.name === "extension.js").sha256, inputs = new Map();
for (const output of inspection.sourceProvenance.inventory) {
 const extracted = inside(inspection.extractedExtensionRoot, "dist/" + output.name); assert.equal(hash(extracted), output.sha256); assert.equal(fs.statSync(extracted).size, output.bytes);
 for (const input of output.inputs) { const file = inside(repo, input.path); assert.equal(hash(file), input.sha256); assert.equal(fs.statSync(file).size, input.bytes); if (inputs.has(input.path)) assert.equal(inputs.get(input.path).sha256, input.sha256); inputs.set(input.path, { path: input.path, bytes: input.bytes, sha256: input.sha256 }); }
}
assert.ok(Array.isArray(plan.checks)); assert.deepEqual(plan.checks.map(row => row.role).sort(), ["focused", "typecheck", "full", "readiness", "package", "hostBuild", "native", "nativePs51", "affected"].sort());
for (const role of ["focused", "full"]) assert.equal(plan.checks.find(row => row.role === role).kind, "tap");
const checks = plan.checks.map(check), focused = checks.find(row => row.role === "focused").counts, full = checks.find(row => row.role === "full").counts;
assert.ok(Number.isInteger(plan.focusedPartition.f12) && plan.focusedPartition.f12 >= 160); assert.equal(plan.focusedPartition.extensionParity, 76); assert.equal(plan.focusedPartition.retainedPs51, 342);
assert.equal(focused.tests, plan.focusedPartition.f12 + plan.focusedPartition.retainedPs51 + plan.focusedPartition.extensionParity); assert.equal(focused.skipped, 0); assert.ok(full.tests >= focused.tests);
const probeFile = bound(plan.native.probe), nativeSummaryFile = bound(plan.native.summary), nativeSummary = read(nativeSummaryFile), freezeFile = bound(plan.native.freeze), freeze = read(freezeFile);
assert.equal(nativeSummary.status, "PASS_SCOPED"); assert.equal(nativeSummary.nativeChecks, 19); assert.equal(nativeSummary.extensionBundleSha256, runtime); assert.equal(nativeSummary.vsixSha256, plan.artifact.sha256); assert.equal(nativeSummary.independence, "LOW");
assert.deepEqual(nativeSummary.phases.map(row => row.phase), ["primary", "restart"]); assert.equal(freeze.extensionBundleSha256, runtime); assert.equal(freeze.vsixSha256, plan.artifact.sha256); assert.equal(path.resolve(freeze.exactVsix), artifactFile);
assert.equal(path.resolve(freeze.sourceExtension), path.resolve(inspection.extractedExtensionRoot)); assert.equal(freeze.hostProbeSha256, hash(probeFile));
const execution = path.resolve(freeze.executionEvidenceRoot), profileParent = path.resolve("D:/SoterAI-Lite-test-profiles"); assert.ok(execution.toLowerCase().startsWith(profileParent.toLowerCase() + path.sep));
const nativeFacts = [], externalCopies = [];
for (const [phase, count, offset] of [["primary", 16, 0], ["restart", 3, 16]]) {
 const resultFile = bound(plan.native[phase]), result = read(resultFile), summaryRow = nativeSummary.phases.find(row => row.phase === phase), external = inside(execution, phase + "-results.json");
 assert.equal(path.resolve(summaryRow.result), external); assert.equal(hash(external), hash(resultFile)); assert.equal(summaryRow.sha256, hash(resultFile)); assert.equal(summaryRow.passed, count);
 assert.equal(result.phase, phase); assert.equal(result.passed, count); assert.equal(result.failed, 0); assert.equal(result.notRun, 0); assert.equal(result.driverFailure, undefined); assert.equal(result.syntheticOnly, true); assert.equal(result.independence, "LOW");
 assert.deepEqual(result.observations.map(row => row.id), Array.from({ length: count }, (_, index) => "F12-H" + String(offset + index + 1).padStart(2, "0"))); assert.ok(result.observations.every(row => row.status === "PASS"));
 assert.equal(result.extensionBundleSha256, runtime); assert.equal(result.currentDeveloperBundleSha256, runtime); assert.equal(result.hostProbeSha256, hash(probeFile)); assert.equal(result.sourceDocumentCalls, 0); assert.equal(result.sourceDocumentEvents, 0); assert.equal(result.nativeTerminalsAfterClose, 0);
 assert.ok(result.terminalRuns.length > 0 && result.terminalRuns.every(row => row.closed === true && row.safe === true));
 if (phase === "primary") assert.ok(result.taskRuns.length > 0 && result.taskRuns.every(row => row.closed === true && row.taskEnded === true && row.safe === true));
 nativeFacts.push({ phase, pass: count, result: fileFact(resultFile) }); externalCopies.push({ source: external, retainedCopy: relative(resultFile), sha256: hash(resultFile), bytes: fs.statSync(resultFile).size });
}
const ps51Facts = [], ps51Copies = [];
{
const probeFile = bound(plan.ps51Native.probe), nativeSummaryFile = bound(plan.ps51Native.summary), nativeSummary = read(nativeSummaryFile), freezeFile = bound(plan.ps51Native.freeze), freeze = read(freezeFile);
assert.equal(nativeSummary.status, "PASS_SCOPED"); assert.equal(nativeSummary.nativeChecks, 19); assert.equal(nativeSummary.extensionBundleSha256, runtime); assert.equal(nativeSummary.vsixSha256, plan.artifact.sha256); assert.equal(nativeSummary.independence, "LOW");
assert.deepEqual(nativeSummary.phases.map(row => row.phase), ["primary", "restart"]); assert.equal(freeze.extensionBundleSha256, runtime); assert.equal(freeze.vsixSha256, plan.artifact.sha256); assert.equal(path.resolve(freeze.exactVsix), artifactFile);
assert.equal(path.resolve(freeze.sourceExtension), path.resolve(inspection.extractedExtensionRoot)); assert.equal(freeze.hostProbeSha256, hash(probeFile));
const execution = path.resolve(freeze.executionEvidenceRoot), profileParent = path.resolve("D:/SoterAI-Lite-test-profiles"); assert.ok(execution.toLowerCase().startsWith(profileParent.toLowerCase() + path.sep));
const nativeFacts = [], externalCopies = [];
for (const [phase, count, offset] of [["primary", 16, 0], ["restart", 3, 16]]) {
 const resultFile = bound(plan.ps51Native[phase]), result = read(resultFile), summaryRow = nativeSummary.phases.find(row => row.phase === phase), external = inside(execution, phase + "-results.json");
 assert.equal(path.resolve(summaryRow.result), external); assert.equal(hash(external), hash(resultFile)); assert.equal(summaryRow.sha256, hash(resultFile)); assert.equal(summaryRow.passed, count);
 assert.equal(result.phase, phase); assert.equal(result.passed, count); assert.equal(result.failed, 0); assert.equal(result.notRun, 0); assert.equal(result.driverFailure, undefined); assert.equal(result.syntheticOnly, true); assert.equal(result.independence, "LOW");
 assert.deepEqual(result.observations.map(row => row.id), Array.from({ length: count }, (_, index) => "F10-H" + String(offset + index + 1).padStart(2, "0"))); assert.ok(result.observations.every(row => row.status === "PASS"));
 assert.equal(result.extensionBundleSha256, runtime); assert.equal(result.currentDeveloperBundleSha256, runtime); assert.equal(result.hostProbeSha256, hash(probeFile)); assert.equal(result.sourceDocumentCalls, 0); assert.equal(result.sourceDocumentEvents, 0); assert.equal(result.nativeTerminalsAfterClose, 0);
 assert.ok(result.terminalRuns.length > 0 && result.terminalRuns.every(row => row.closed === true && row.safe === true));
 if (phase === "primary") assert.ok(result.taskRuns.length > 0 && result.taskRuns.every(row => row.closed === true && row.taskEnded === true && row.safe === true));
 nativeFacts.push({ phase, pass: count, result: fileFact(resultFile) }); externalCopies.push({ source: external, retainedCopy: relative(resultFile), sha256: hash(resultFile), bytes: fs.statSync(resultFile).size });
}
ps51Facts.push(...nativeFacts); ps51Copies.push(...externalCopies);
}
const affectedFile = bound(plan.affected.summary), affected = read(affectedFile), functionalFile = bound(plan.affected.functional), securityFile = bound(plan.affected.security), comparisonFile = bound(plan.affected.comparison);
assert.equal(affected.status, "PASS_SCOPED"); assert.equal(affected.extensionBundleSha256, runtime); assert.equal(affected.vsixSha256, plan.artifact.sha256); assert.equal(path.resolve(affected.vsixPath), artifactFile); assert.equal(affected.functionalPassed, 10); assert.equal(affected.securityCompared, 17); assert.equal(affected.changed, 0);
assert.equal(path.resolve(affected.functionalResult), functionalFile); assert.equal(path.resolve(affected.securityResult), securityFile);
const functional = read(functionalFile), security = read(securityFile), comparison = read(comparisonFile);
assert.equal(functional.extensionBundleSha256, runtime); assert.equal(functional.passed, 10); assert.equal(functional.failed, 0); assert.equal(functional.observations.length, 10); assert.ok(functional.observations.every(row => row.status === "PASS"));
assert.equal(security.extensionBundleSha256, runtime); assert.equal(security.results.length, 17); assert.equal(comparison.changed, 0); assert.equal(comparison.comparedRows, 17); assert.equal(comparison.rows.length, 17);
assert.equal(security.results.filter(row => row.status === "BLOCKED_SCOPED").length, 8); assert.equal(security.results.filter(row => row.status === "LEAK_CONFIRMED").length, 9);
const attacks = new Set(); for (const row of comparison.rows) { assert.ok(!attacks.has(row.attack)); attacks.add(row.attack); const matches = security.results.filter(current => current.attack === row.attack); assert.equal(matches.length, 1); assert.equal(row.current, matches[0].status); assert.equal(row.previous, row.current); }
assert.ok(Array.isArray(plan.reviews) && plan.reviews.length > 0); assert.equal(plan.reviewDisposition, "NO_OPEN_SCOPED_BLOCKERS"); const reviews = plan.reviews.map(spec => fileFact(bound(spec)));
const queue = read(inside(repo, "docs/soterai-lite/FEATURE-QUEUE.json")); assert.equal(queue.features.find(row => row.id === "F11").coverage, "NOT_TESTED/NOT_COVERED"); assert.equal(queue.activeFeature, "F12"); assert.equal(queue.features.find(row => row.id === "F12").status, "ACTIVE");
for (const name of indexOnlyPaths) assert.deepEqual(lines(git("diff", "--name-only", "HEAD", "--", name)), []);
const priorEvidence = plan.priorEvidence ?? []; assert.ok(Array.isArray(priorEvidence) && priorEvidence.length <= 32);
for (const name of priorEvidence) assert.match(name, /^docs\/soterai-lite\/evidence\/20261017-f11-ps7-availability-6f721c9d\/[A-Za-z0-9.-]+\.(?:json|txt|ps1|cjs)$/);
const outputs = ["f12-external-phase-evidence-01.json", "f12-acceptance-01.json", "f12-evidence-index-01.json", "f12-commit-allowlist-01.txt"]; noOutputs(outputs);
const ledgerPath = inside(repo, "docs/soterai-lite/ledger.md"), marker = "## STEP RECEIPT F12 - scoped checked cmd acceptance"; assert.ok(!bytes(ledgerPath).toString("utf8").includes(marker));
write(outputs[0], { status: "PASS_BYTE_IDENTICAL", syntheticOnly: true, profilesRetained: true, sqliteContentsRead: false, entries: [...externalCopies, ...ps51Copies] });
write(outputs[1], { status: "PASS", feature: "F12", observedAt: new Date().toISOString(), parent, completion: "Scoped local acceptance passed; source commit and byte verification remain the serial barrier.", artifact: { path: plan.artifact.path, bytes: fs.statSync(artifactFile).size, sha256: hash(artifactFile), runtimeSha256: runtime }, flag: { name: "soterai.lite.cmdTerminal", scope: "machine", withdrawal: "AVAILABILITY_ONLY" }, checks: { focused, focusedPartition: plan.focusedPartition, full, native: { distinct: 19, pass: 19, phases: nativeFacts, summary: fileFact(nativeSummaryFile), probe: fileFact(probeFile) }, nativePs51: { distinct: 19, pass: 19, phases: ps51Facts, summary: fileFact(bound(plan.ps51Native.summary)) }, functional: { path: relative(functionalFile), pass: 10, fail: 0 }, security: { path: relative(securityFile), scenarios: 17, blockedScoped: 8, leakConfirmed: 9, changed: 0 } }, inspection: fileFact(inspectionFile), inputs: [...inputs.values()], commands: checks, reviews, reviewDisposition: { value: plan.reviewDisposition, authority: "Explicit final root binding; same lineage LOW" }, bindings: fileFact(planFile), independence: "LOW", catalog: { status: "44_UNVERIFIED", definitionSha256: catalogSha256, featureLinkedIds: linkedCatalogIds, graded: false }, ratings: "PENDING", limitations: "Finite declared cmd checked commands only. type/find/set/copy are managed safe-view routes; cmd public output uses bounded UTF16LE decoding. PS5.1 staged Git metadata is retained separately. No arbitrary native terminal mediation, OS confinement, original buffer protection, independent upload/gateway or perfect-protection claim. Cancellation preserves ownership until actual completion. Scripted developer-window native checks do not prove human approval/usability or clean installed-VSIX lifecycle.", notTested: ["Independent human/vendor review", "External AI tool routes", "Unmanaged shells and uploads", "Gateway routing", "Linux/macOS/remote", "Clean installed-VSIX lifecycle", "Human usability/accessibility"] });
fs.appendFileSync(ledgerPath, "\n" + marker + "\n\nScoped local acceptance PASS; source commit/byte verification remain the serial barrier. Focused " + focused.tests + " PASS (" + plan.focusedPartition.f12 + " F12,342 retained PS5.1 and76 retained extension parity); full " + full.tests + " tests/" + full.pass + " PASS/" + full.skipped + " SKIP; zero failures/cancellations. Exact VSIX " + plan.artifact.path + " SHA" + hash(artifactFile) + " (" + fs.statSync(artifactFile).size + " bytes), runtime " + runtime + ". Cmd native19PASS plus affected PS5.1 native19PASS, functional10PASS/security17 unchanged8BLOCKED_SCOPED9LEAK_CONFIRMED. All historical failures retained, including commands missing-module baseline NOT_EXECUTED. Declared finite cmd and affected PS5.1/staged-only Git metadata; LOW scripted API evidence, no independent/human/native-bypass/OS boundary claim. Catalog44UNVERIFIED/ratingPENDING. F12 remains ACTIVE pending its scoped commit/byte verification; no F13 production.\n");
const sources = [...sourcePaths, ...indexOnlyPaths, ...priorEvidence], excluded = new Set(["f12-evidence-index-01.json", "f12-commit-allowlist-01.txt"]);
function walk(directory) { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const file = path.join(directory, entry.name); assert.ok(!entry.isSymbolicLink(), "Linked evidence refused."); if (entry.isDirectory()) { if (["extension", "extensions", "profile", "profiles", "node_modules", "dist", "builds", "runtime", ".git"].includes(entry.name) || /^(?:vsix-extracted-|prebuilt)/.test(entry.name)) continue; walk(file); } else if (!excluded.has(entry.name) && /\.(?:json|txt|md|ps1|cjs)$/.test(entry.name)) sources.push(relative(file)); } }
walk(__dirname); const unique = [...new Set(sources)].sort(); assert.ok(unique.every(name => !name.includes("/profile/") && !name.includes("/runtime/") && !name.includes("/dist/") && !name.endsWith(".vsix") && !name.endsWith(".js")));
const scope = [...sourcePaths, ...priorEvidence, base], changed = new Set([...lines(git("diff", "--name-only", "HEAD", "--", ...scope)), ...lines(git("ls-files", "--others", "--exclude-standard", "--", ...scope))]);
const indexPath = base + "/f12-evidence-index-01.json", allow = [...unique.filter(name => changed.has(name)), indexPath].sort(); assert.equal(new Set(allow).size, allow.length);
write(outputs[2], { schemaVersion: 1, parent, scope: "Explicit F12 source plus retained evidence, including failed drafts. Copied extensions/profiles/prebuilt bundles/runtime/VSIX bytes excluded. Unrelated changes remain outside the allowlist.", entries: unique.map(name => fileFact(inside(repo, name))), expectedCommitPaths: allow });
fs.writeFileSync(own(outputs[3]), allow.join("\n") + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "PASS_LOCAL_PENDING_SCOPED_COMMIT", indexedEntries: unique.length, exactChangedCommitPaths: allow.length, artifact: hash(artifactFile), focused, full, nativeDistinct: 19, functional: 10, securityComparisonChanges: 0 }));
