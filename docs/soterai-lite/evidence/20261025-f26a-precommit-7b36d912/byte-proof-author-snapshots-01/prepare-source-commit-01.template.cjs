"use strict";
if ("__F26A_BYTE_PROOF_BOUND__" !== "F26A_CURRENT_BYTE_PROOF_FACTS_BOUND") throw Error("PREPARED_NOT_BOUND: final acceptance, root-reviewed scope, queue and ledger required first.");
const assert = require("node:assert/strict"), e = require("./scoped-git-lib-02.cjs"), guard = require("./current-acceptance-guard-01.cjs");
const binding = e.checkBoundConfig(), acceptance = guard.check(), scope = e.checkPlannedDelta(binding); e.checkQueue("source");
assert.equal(e.fact(e.MUTABLE[0]).sha256, binding.sourceQueueSha256); assert.equal(e.fact(e.MUTABLE[1]).sha256, binding.sourceLedgerSha256);
const evidence = e.walk(e.base), records = e.sorted([...scope.records.map(e.rawFact), ...evidence.map(e.fact)]); e.unique(records); e.checkFacts(records, "Source preparation exact frozen membership");
const membership = { status: "FROZEN_F26A_SCOPED_SOURCE_EVIDENCE_MEMBERSHIP_NOT_COMMITTED", feature: "F26a", parent: binding.parent, sourcePaths: binding.sourcePaths,
    records, acceptance: acceptance.acceptance, retainedArtifact: acceptance.artifact, binding: e.fact(e.base + "/byte-proof-binding-current-01.json"), plannedSourceScope: binding.plannedSourceScope,
    knownNonPassEvidence: binding.knownNonPassEvidence, unrelatedPreserved: scope.unrelatedPreserved,
    scope: "Root-reviewed exact source/unit/docs memberships including explicit deletions plus EVERY current H26 evidence file recursively, preserving original failures/corrupt bytes as NONPASS. Membership JSON itself is additionally frozen before staging and verified in index and actual commit even if unchanged. No queue/ledger edits, Git mutation, or scope approval by this preparation helper." };
e.writeNew("source-membership-01.json", membership); console.log(JSON.stringify({ status: membership.status, paths: records.length, acceptanceFacts: acceptance.recursiveFacts, execution: "NO_COMMIT_YET" }));
