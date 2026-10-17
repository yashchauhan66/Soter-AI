"use strict";
// --prepared: working-tree proof and explicit path barrier before any staging.
// --staged: read-only staged-byte precommit barrier. Neither writes output files.
// <transitionRevision> <sourceRevision> <artifactSHA>: exact committed-byte
// verification, then one new immutable evidence receipt. No queue/ledger edits.
const h = require("./f14-transition-lib-01.cjs");
const { fs, assert, repo, base, sha, bytes, hash, read, inside, own, git, lines, noOutputs, write, fileFact,
  queuePath, ledgerPath, outputs, receipt, sourceProof, queueTransition } = h;
const prepared = process.argv[2] === "--prepared", staged = process.argv[2] === "--staged", precommit = prepared || staged;
const transitionRevision = precommit ? undefined : process.argv[2], expectedSource = precommit ? undefined : process.argv[3], expectedArtifact = precommit ? undefined : process.argv[4];
assert.equal(process.argv.length, precommit ? 3 : 5);
if (!precommit) { assert.match(transitionRevision ?? "", /^[a-f0-9]{40}$/); assert.match(expectedSource ?? "", /^[a-f0-9]{40}$/); assert.match(expectedArtifact ?? "", /^[a-f0-9]{64}$/); }
const indexPath = base + "/" + outputs.index;
const object = name => prepared ? bytes(inside(repo, name)) : git("show", (staged ? ":" : transitionRevision + ":") + name);
const indexBytes = object(indexPath), index = JSON.parse(indexBytes.toString("utf8"));
assert.equal(hash(inside(repo, indexPath)), sha(indexBytes));
assert.equal(index.schemaVersion, 1); assert.equal(index.status, "PREPARED_TRANSITION_NOT_BYTE_VERIFIED"); assert.equal(index.feature, "F14"); assert.equal(index.nextFeature, "F15");
const facts = sourceProof(index.sourceRevision, index.artifact.sha256, index.sourceRunLogName);
assert.equal(index.artifact.path, facts.acceptance.artifact.path); assert.equal(index.artifact.bytes, facts.acceptance.artifact.bytes); assert.equal(index.artifact.runtimeSha256, facts.acceptance.artifact.runtimeSha256);
if (precommit) {
  assert.equal(lines(git("rev-parse", "HEAD"))[0], index.sourceRevision);
  if (prepared) assert.deepEqual(lines(git("diff", "--cached", "--name-only")), []);
}
else {
  assert.equal(index.sourceRevision, expectedSource); assert.equal(index.artifact.sha256, expectedArtifact);
  assert.equal(lines(git("rev-parse", "HEAD"))[0], transitionRevision);
  assert.equal(lines(git("rev-parse", transitionRevision + "^"))[0], expectedSource);
  assert.deepEqual(lines(git("diff", "--cached", "--name-only")), []);
}
assert.ok(Array.isArray(index.entries) && index.entries.length > 0); const indexed = new Set();
const explicit = new Set([queuePath, ledgerPath, ...facts.receiptPaths, base + "/" + outputs.preparation, base + "/" + outputs.allowlist]);
for (const entry of index.entries) {
  assert.ok(explicit.has(entry.path), "Unexpected transition index path."); assert.ok(!indexed.has(entry.path)); indexed.add(entry.path);
  const blob = object(entry.path); assert.equal(blob.length, entry.bytes); assert.equal(sha(blob), entry.sha256);
  assert.equal(hash(inside(repo, entry.path)), entry.sha256); assert.equal(fs.statSync(inside(repo, entry.path)).size, entry.bytes);
}
assert.deepEqual([...indexed].sort(), [...explicit].sort());
const actual = prepared
  ? [...new Set([...lines(git("diff", "--name-only", "HEAD", "--", ...explicit, indexPath)), ...lines(git("ls-files", "--others", "--exclude-standard", "--", ...explicit, indexPath))])].sort()
  : (staged ? lines(git("diff", "--cached", "--name-only")) : lines(git("diff-tree", "--no-commit-id", "--name-only", "-r", transitionRevision))).sort();
const expected = [...index.expectedCommitPaths].sort(); assert.equal(new Set(expected).size, expected.length); assert.deepEqual(actual, expected);
assert.ok(actual.every(name => name === indexPath || indexed.has(name))); assert.ok(actual.includes(queuePath) && actual.includes(ledgerPath) && actual.includes(indexPath));
const allowlist = bytes(own(outputs.allowlist)).toString("utf8").trim().split(/\r?\n/).filter(Boolean).sort(); assert.deepEqual(allowlist, expected);
const queue = JSON.parse(object(queuePath).toString("utf8")); queueTransition(queue, index.sourceRevision);
const oldQueue = JSON.parse(git("show", index.sourceRevision + ":" + queuePath).toString("utf8"));
for (const row of oldQueue.features.filter(row => !["F14", "F15"].includes(row.id))) assert.deepEqual(queue.features.find(current => current.id === row.id), row);
assert.equal(queue.features.length, oldQueue.features.length);
for (const key of Object.keys(oldQueue).filter(key => !["activeFeature", "scope", "features"].includes(key))) assert.deepEqual(queue[key], oldQueue[key]);
assert.deepEqual(Object.keys(queue).sort(), Object.keys(oldQueue).sort());
const ledger = object(ledgerPath).toString("utf8"); assert.ok(ledger.includes("## STEP RECEIPT F14-COMMIT / F15-ACTIVATE")); assert.ok(ledger.includes(index.sourceRevision));
assert.ok(ledger.includes("F01-F10 and F12-F14 DONE; F11 optional unavailable/unimplemented NOT_TESTED/NOT_COVERED; F15 ACTIVE/test-first")); assert.ok(ledger.includes("no F15 production before the separate transition commit and " + outputs.verification + " PASS"));
const preparation = read(own(outputs.preparation));
assert.equal(preparation.status, "PASS_SOURCE_BYTES_TRANSITION_PREPARED_NOT_COMMITTED"); assert.equal(preparation.sourceRevision, index.sourceRevision);
assert.equal(preparation.artifact.sha256, index.artifact.sha256); assert.equal(preparation.artifact.runtimeSha256, index.artifact.runtimeSha256);
assert.equal(preparation.sourceVerification.sha256, hash(own("f14-committed-byte-verification-01.json")));
assert.equal(preparation.sourceVerificationRun.sha256, hash(own(index.sourceRunLogName)));
assert.equal(preparation.sourceVerificationRunReceipt.sha256, hash(own(index.sourceRunLogName + ".result.json")));
assert.equal(hash(facts.artifact), index.artifact.sha256); assert.equal(fs.statSync(facts.artifact).size, index.artifact.bytes);
if (precommit) {
  noOutputs([outputs.commit, outputs.commit + ".result.json", outputs.verification]);
  console.log(JSON.stringify({ status: prepared ? "PASS_PREPARED_TRANSITION_BYTES_NOT_STAGED" : "PASS_STAGED_TRANSITION_BYTES_NOT_COMMITTED", sourceRevision: index.sourceRevision, indexedEntries: index.entries.length,
    ...(prepared ? { preparedPaths: actual.length } : { stagedPaths: actual.length }), artifact: index.artifact.sha256 }));
} else {
  const commitFile = own(outputs.commit), result = receipt(commitFile, "git"); assert.ok(result.arguments.includes("commit"));
  noOutputs([outputs.verification]);
  write(outputs.verification, { status: "PASS", feature: "F14", nextFeature: "F15", revision: transitionRevision, sourceRevision: index.sourceRevision,
    indexedEntries: index.entries.length, committedPaths: actual.length, mismatches: [], unexpectedPaths: 0, parent: index.sourceRevision,
    sourceByteVerification: fileFact(own("f14-committed-byte-verification-01.json")), transitionIndex: fileFact(own(outputs.index)),
    commitOutput: fileFact(commitFile), commitReceipt: fileFact(commitFile + ".result.json"), artifact: { ...index.artifact, recheck: "PASS" },
    serialBarrier: "F14 source and separate transition bytes verified. F15 may follow its existing applicability/design/failing-regression gates; no F15 production is claimed by this receipt.",
    independence: "LOW", finalRating: "PENDING", observedAt: new Date().toISOString() });
  console.log(JSON.stringify({ status: "PASS_TRANSITION_BYTES", revision: transitionRevision, sourceRevision: index.sourceRevision, indexedEntries: index.entries.length, committedPaths: actual.length, artifact: index.artifact.sha256 }));
}
