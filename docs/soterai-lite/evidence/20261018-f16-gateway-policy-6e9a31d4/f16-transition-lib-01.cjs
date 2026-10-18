"use strict";
// Evidence-only transition support. Git calls are read-only. No feature work,
// artifact build, native execution, staging or publication is performed here.
const h = require("./f16-evidence-lib.cjs");
const { fs, path, assert, repo, base, sha, bytes, hash, read, inside, own, git, lines, fileFact } = h;
const queuePath = "docs/soterai-lite/FEATURE-QUEUE.json", ledgerPath = "docs/soterai-lite/ledger.md";
const outputs = {
  preparation: "f16-transition-preparation-01.json", index: "f16-transition-index-01.json",
  allowlist: "f16-transition-allowlist-01.txt", commit: "f16-transition-commit-01.txt",
  verification: "f16-transition-byte-verification-01.json",
};
function safeLogName(value) {
  assert.match(value ?? "", /^[a-z0-9][a-z0-9-]*\.txt$/);
  assert.ok(!["f16-commit-01.txt", outputs.commit].includes(value)); return value;
}
function receipt(logFile, expectedFile) {
  const fact = fileFact(logFile), result = read(logFile + ".result.json");
  assert.equal(result.exitCode, 0); assert.equal(result.sha256.toLowerCase(), fact.sha256);
  assert.equal(path.resolve(result.output), path.resolve(logFile));
  assert.ok(Array.isArray(result.arguments));
  if (expectedFile) assert.equal(path.basename(result.file).toLowerCase().replace(/\.exe$/, ""), expectedFile);
  return result;
}
function committed(revision, name) { return git("show", revision + ":" + name); }
function sameCurrent(name, fact) {
  const file = inside(repo, name); assert.equal(hash(file), fact.sha256); assert.equal(fs.statSync(file).size, fact.bytes);
}
function sourceProof(sourceRevision, expectedArtifact, sourceRunLogName) {
  assert.match(sourceRevision ?? "", /^[a-f0-9]{40}$/); assert.match(expectedArtifact ?? "", /^[a-f0-9]{64}$/); safeLogName(sourceRunLogName);
  const sourceIndexPath = base + "/f16-evidence-index-01.json", sourceIndexBytes = committed(sourceRevision, sourceIndexPath);
  assert.equal(hash(inside(repo, sourceIndexPath)), sha(sourceIndexBytes));
  const sourceIndex = JSON.parse(sourceIndexBytes.toString("utf8")); assert.ok(Array.isArray(sourceIndex.entries));git.preload(sourceRevision,sourceIndex.entries.map(entry=>entry.path));
  const sourcePaths = new Set();
  for (const entry of sourceIndex.entries) {
    assert.ok(!sourcePaths.has(entry.path)); sourcePaths.add(entry.path);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/); assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
    const blob=committed(sourceRevision,entry.path);assert.equal(blob.length,entry.bytes);assert.equal(sha(blob),entry.sha256);
    // Queue/ledger are the only source-index bytes that the transition changes.
    if (![queuePath, ledgerPath].includes(entry.path)) sameCurrent(entry.path, entry);
  }
  const sourceChanged = lines(git("diff-tree", "--no-commit-id", "--name-only", "-r", sourceRevision)).sort();
  assert.deepEqual(sourceChanged, [...sourceIndex.expectedCommitPaths].sort());
  assert.ok(sourceChanged.every(name => name === sourceIndexPath || sourcePaths.has(name)));
  const acceptancePath = base + "/f16-acceptance-01.json", acceptanceBytes = committed(sourceRevision, acceptancePath);
  assert.equal(hash(inside(repo, acceptancePath)), sha(acceptanceBytes));
  const acceptance = JSON.parse(acceptanceBytes.toString("utf8"));
  assert.equal(acceptance.status, "PASS"); assert.equal(acceptance.feature, "F16");
  assert.equal(lines(git("rev-parse", sourceRevision + "^"))[0], acceptance.parent); assert.equal(sourceIndex.parent, acceptance.parent);
  assert.equal(acceptance.artifact.sha256, expectedArtifact); assert.match(acceptance.artifact.runtimeSha256, /^[a-f0-9]{64}$/);
  const artifact = inside(repo, acceptance.artifact.path); assert.equal(hash(artifact), expectedArtifact); assert.equal(fs.statSync(artifact).size, acceptance.artifact.bytes);
  assert.equal(acceptance.checks.native.distinct, 94); assert.equal(acceptance.checks.native.pass, 94);
  assert.equal(acceptance.checks.functional.pass, 10); assert.equal(acceptance.checks.security.scenarios, 17); assert.equal(acceptance.checks.security.changed, 0);
  for (const input of acceptance.inputs) sameCurrent(input.path, input);
  const inspection = read(inside(repo, acceptance.inspection.path)); assert.equal(hash(inside(repo, acceptance.inspection.path)), acceptance.inspection.sha256);
  for (const output of inspection.sourceProvenance.inventory) {
    const file = inside(inspection.extractedExtensionRoot, "dist/" + output.name);
    assert.equal(hash(file), output.sha256); assert.equal(fs.statSync(file).size, output.bytes);
  }
  const proofFile = own("f16-committed-byte-verification-01.json"), proof = read(proofFile);
  assert.equal(proof.status, "PASS"); assert.equal(proof.feature, "F16"); assert.equal(proof.revision, sourceRevision);
  assert.equal(proof.indexedEntries, sourceIndex.entries.length); assert.equal(proof.committedPaths, sourceChanged.length);
  assert.deepEqual(proof.mismatches, []); assert.equal(proof.unexpectedPaths, 0);
  assert.equal(proof.artifact.path, acceptance.artifact.path); assert.equal(proof.artifact.bytes, acceptance.artifact.bytes);
  assert.equal(proof.artifact.sha256, expectedArtifact); assert.equal(proof.artifact.recheck, "PASS");
  assert.equal(proof.runtimeSha256, acceptance.artifact.runtimeSha256);
  const sourceLog = own("f16-commit-01.txt"), sourceCommitReceipt = receipt(sourceLog, "git");
  assert.equal(proof.commitOutput.path, base + "/f16-commit-01.txt"); assert.equal(proof.commitOutput.sha256, hash(sourceLog));
  assert.ok(sourceCommitReceipt.arguments.includes("commit"));
  const sourceAllowlist = bytes(own("f16-commit-allowlist-01.txt")).toString("utf8").trim().split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(sourceAllowlist, sourceChanged);
  const runLog = own(sourceRunLogName), runReceipt = receipt(runLog, "node");
  assert.equal(runReceipt.arguments.length, 3);
  assert.equal(path.resolve(repo, runReceipt.arguments[0]), own("verify-commit-01.cjs"));
  assert.deepEqual(runReceipt.arguments.slice(1), [sourceRevision, expectedArtifact]);
  const sourceQueue = JSON.parse(committed(sourceRevision, queuePath).toString("utf8"));
  assert.equal(sourceQueue.activeFeature, "F16"); assert.equal(sourceQueue.features.find(row => row.id === "F16").status, "ACTIVE");
  assert.equal(sourceQueue.features.find(row => row.id === "F17").status, "PLANNED");
  return { sourceRevision, expectedArtifact, sourceRunLogName, sourceIndex, sourceIndexPath, sourceChanged, acceptance, artifact, proof,
    receiptPaths: [base + "/f16-commit-01.txt", base + "/f16-commit-01.txt.result.json", base + "/f16-commit-allowlist-01.txt",
      base + "/f16-committed-byte-verification-01.json", base + "/" + sourceRunLogName, base + "/" + sourceRunLogName + ".result.json"] };
}
function queueTransition(queue, sourceRevision) {
  assert.equal(queue.activeFeature, "F17");
  const current = queue.features.find(row => row.id === "F16"), next = queue.features.find(row => row.id === "F17");
  assert.equal(current.status, "DONE"); assert.equal(current.result, "PASS"); assert.equal(current.sourceEvidenceCommit, sourceRevision);
  assert.equal(current.acceptanceEvidence, base + "/f16-acceptance-01.json");
  assert.equal(current.commitByteVerification, base + "/f16-committed-byte-verification-01.json");
  assert.equal(current.transitionByteVerification, base + "/" + outputs.verification);
  assert.equal(next.status, "ACTIVE"); assert.equal(next.result, "NOT-RUN");
  assert.equal(queue.implementationConcurrency, 1); assert.equal(queue.finalRating.status, "PENDING"); assert.equal(queue.finalRating.allowed, false);
}
module.exports = { ...h, queuePath, ledgerPath, outputs, safeLogName, receipt, committed, sameCurrent, sourceProof, queueTransition };
