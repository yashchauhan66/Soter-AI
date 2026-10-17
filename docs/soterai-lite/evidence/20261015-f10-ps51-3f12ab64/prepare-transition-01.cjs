"use strict";
// DEFERRED: modifies only the already-committed queue/ledger plus new transition
// evidence, after the separate F10 source-byte PASS and successful run receipt.
const h = require("./f10-transition-lib-01.cjs");
const { fs, assert, repo, base, bytes, hash, read, inside, own, git, lines, fileFact, noOutputs, write, queuePath, ledgerPath, outputs, sourceProof, queueTransition } = h;
const revision = process.argv[2], expectedArtifact = process.argv[3], sourceRunLogName = process.argv[4];
const facts = sourceProof(revision, expectedArtifact, sourceRunLogName);
assert.equal(lines(git("rev-parse", "HEAD"))[0], revision); assert.deepEqual(lines(git("diff", "--cached", "--name-only")), []);
assert.deepEqual(lines(git("diff", "--name-only", "HEAD", "--", queuePath, ledgerPath)), []);
noOutputs([outputs.preparation, outputs.index, outputs.allowlist, outputs.commit, outputs.commit + ".result.json", outputs.verification]);
const queueFile = inside(repo, queuePath), ledgerFile = inside(repo, ledgerPath), queueBefore = fileFact(queueFile), ledgerBefore = fileFact(ledgerFile);
const queue = read(queueFile); assert.equal(queue.activeFeature, "F10"); assert.equal(queue.implementationConcurrency, 1);
const current = queue.features.find(row => row.id === "F10"), next = queue.features.find(row => row.id === "F11");
assert.equal(current.status, "ACTIVE"); assert.equal(next.status, "PLANNED"); assert.equal(next.result, "NOT-RUN");
let ledger = bytes(ledgerFile).toString("utf8");
const marker = "## STEP RECEIPT F10-COMMIT / F11-ACTIVATE"; assert.ok(!ledger.includes(marker));
function replaceOne(before, after) { assert.equal(ledger.split(before).length, 2, "Exactly one current-state marker is required."); ledger = ledger.replace(before, after); }
replaceOne("F01-F09 DONE; F10 ACTIVE/test-first", "F01-F10 DONE; F11 ACTIVE/test-first");
replaceOne("F11-F32 and L2-L7", "F12-F32 and L2-L7");
replaceOne("P00-P03 and F01-F09 scoped commits are complete. F10 is the sole active behavior card; production waits for its frozen design and failing regression baseline. No F11 production may start yet.",
  "P00-P03 and F01-F10 scoped source commits are complete. F11 is the sole active behavior card. Before F11 production, require the separate F10 transition commit and f10-transition-byte-verification-01.json PASS; then follow the existing F11 applicability, design and regression gates.");
Object.assign(current, { status: "DONE", result: "PASS", sourceEvidenceCommit: revision, acceptanceEvidence: base + "/f10-acceptance-01.json",
  commitByteVerification: base + "/f10-committed-byte-verification-01.json", transitionByteVerification: base + "/" + outputs.verification });
Object.assign(next, { status: "ACTIVE", result: "NOT-RUN" }); queue.activeFeature = "F11";
queue.scope = "F01-F10 DONE for their exact scoped artifacts and byte-verified source commits; F11 alone active. F11 production waits for the separately byte-verified F10 transition and existing applicability/design/regression gates.";
queueTransition(queue, revision);
ledger += "\n" + marker + "\n\nF10 source commit " + revision + " verified: " + facts.sourceIndex.entries.length + " indexed byte hashes, " + facts.sourceChanged.length + " exact changed paths, zero mismatches/unexpected paths. Exact physical artifact freshly rechecked " + expectedArtifact + "; runtime " + facts.acceptance.artifact.runtimeSha256 + ". Native19 (primary16/restart3), functional10 and unchanged security17 (8 BLOCKED_SCOPED/9 LEAK_CONFIRMED) remain the scoped LOW evidence in the committed acceptance. Declared finite PS5.1/staged-only Git metadata, not OS confinement, unmanaged native interception or independent/human certification. Catalog44UNVERIFIED/ratingPENDING. F11 is the sole next active card; no F11 production before the separate transition commit and " + outputs.verification + " PASS. All prior failures, evidence, synthetic profiles, user20GBwaiver and unrelated changes retained.\n";
// All guards above finish before either already-authorized state file changes.
fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2) + "\n"); fs.writeFileSync(ledgerFile, ledger);
write(outputs.preparation, { status: "PASS_SOURCE_BYTES_TRANSITION_PREPARED_NOT_COMMITTED", feature: "F10", nextFeature: "F11", sourceRevision: revision,
  sourceVerification: fileFact(own("f10-committed-byte-verification-01.json")), sourceVerificationRun: fileFact(own(sourceRunLogName)),
  sourceVerificationRunReceipt: fileFact(own(sourceRunLogName + ".result.json")), before: [queueBefore, ledgerBefore],
  artifact: { path: facts.acceptance.artifact.path, bytes: facts.acceptance.artifact.bytes, sha256: hash(facts.artifact), runtimeSha256: facts.acceptance.artifact.runtimeSha256 },
  serialBarrier: "No F11 production until the separate transition commit and its byte verification PASS.", observedAt: new Date().toISOString() });
const candidates = [queuePath, ledgerPath, ...facts.receiptPaths, base + "/" + outputs.preparation];
assert.equal(new Set(candidates).size, candidates.length);
const changed = new Set([...lines(git("diff", "--name-only", "HEAD", "--", ...candidates)), ...lines(git("ls-files", "--others", "--exclude-standard", "--", ...candidates))]);
const indexPath = base + "/" + outputs.index, allowlistPath = base + "/" + outputs.allowlist;
const expected = [...candidates.filter(name => changed.has(name)), indexPath, allowlistPath].sort(); assert.equal(new Set(expected).size, expected.length);
assert.ok(expected.includes(queuePath) && expected.includes(ledgerPath));
fs.writeFileSync(own(outputs.allowlist), expected.join("\n") + "\n", { flag: "wx" });
write(outputs.index, { schemaVersion: 1, status: "PREPARED_TRANSITION_NOT_BYTE_VERIFIED", feature: "F10", nextFeature: "F11", sourceRevision: revision,
  sourceRunLogName, artifact: { path: facts.acceptance.artifact.path, bytes: facts.acceptance.artifact.bytes, sha256: expectedArtifact, runtimeSha256: facts.acceptance.artifact.runtimeSha256 },
  entries: [...candidates, allowlistPath].map(name => fileFact(inside(repo, name))), expectedCommitPaths: expected,
  scope: "Only existing queue/ledger transition plus explicit source commit and source-byte-verification receipts. No F11 production or unrelated changes.", observedAt: new Date().toISOString() });
console.log(JSON.stringify({ status: "PASS_SOURCE_BYTES_PENDING_TRANSITION_COMMIT", sourceRevision: revision, nextFeature: "F11", indexedEntries: candidates.length + 1, changedPaths: expected.length, artifact: hash(facts.artifact) }));
