'use strict';
if('__F25_BYTE_PROOF_BOUND__'!=='F25_CURRENT_BYTE_PROOF_FACTS_BOUND')throw Error('F25 source commit PREPARED_NOT_BOUND; root must bind final current facts and explicitly execute a NEW owned copy');
const assert=require('node:assert/strict'),e=require('./scoped-git-lib-05.cjs'),guard=require('./current-acceptance-guard-05.cjs');
const binding=e.checkBoundConfig();guard.check();const memberFact=e.fact(e.base+'/source-membership-05.json'),membership=e.read(memberFact.path);
assert.equal(membership.status,'FROZEN_F25_SCOPED_SOURCE_EVIDENCE_MEMBERSHIP_NOT_COMMITTED');assert.equal(membership.parent,binding.parent);assert.equal(e.head(),binding.parent);assert.equal(e.cached().length,0);assert.deepEqual([...membership.sourcePaths].sort(),[...binding.sourcePaths].sort());
const frozen=[...membership.records,memberFact].sort((a,b)=>a.path.localeCompare(b.path));assert.equal(new Set(frozen.map(row=>row.path)).size,frozen.length);
e.checkFacts(frozen,'Before source stage');e.assertEvidenceMembership(frozen);
const spec=e.pathspec('source-pathspec-05.bin',frozen);e.assertEvidenceMembership(frozen,[spec.path]);
// Every frozen membership (including unchanged paths and JSON itself) is verified
// BEFORE git add, in the index after add, and in the actual commit after commit.
guard.check();e.checkFacts(frozen,'Immediately before source git add');const staged=e.stageFrozen(frozen,spec);
const stagedCheck=e.writeNew('source-stage-byte-check-05.json',{status:'PASS_FROZEN_INDEX_BYTES_ONLY_NOT_COMMITTED',parent:membership.parent,allMembershipPaths:frozen.length,changedIndexPaths:staged.length,records:frozen,mismatches:[],unexpectedPaths:0});
e.assertEvidenceMembership(frozen,[spec.path,stagedCheck.path]);guard.check();e.checkFacts(frozen,'Immediately before source commit');assert.equal(e.head(),membership.parent);assert.deepEqual(e.cached(),staged);
const output=e.git(['commit','-m','feat(lite): protect saved logs and owned app task debug output (F25)']);
const commitOutput=e.writeNew('source-commit-output-05.txt',output),revision=e.head();assert.notEqual(revision,membership.parent);assert.equal(e.git(['rev-parse',revision+'^']).toString().trim(),membership.parent);
const changed=e.changed(revision);assert.deepEqual(changed,staged,'Actual committed changed membership differs from verified index');
const verified=e.verify(frozen.map(row=>revision+':'+row.path),frozen);assert.equal(e.cached().length,0);e.checkFacts(frozen,'After actual source commit');e.assertEvidenceMembership(frozen,[spec.path,stagedCheck.path,commitOutput.path]);const acceptance=guard.check();assert.deepEqual(acceptance.artifact,e.rawFact(membership.retainedArtifact));
const proof={status:'PASS',feature:'F25',revision,parent:membership.parent,indexedEntries:membership.records.length,committedPaths:changed.length,verifiedMembershipPaths:verified.length,membership:memberFact,sourcePaths:binding.sourcePaths,changedPaths:changed,records:verified,mismatches:[],unexpectedPaths:0,retainedArtifact:acceptance.artifact,acceptance:acceptance.acceptance,sourceCommitAuxiliary:[spec,stagedCheck,commitOutput],scope:'Actual Git index/commit bytes checked for EVERY frozen membership including unchanged files and source membership JSON itself; exact changed set checked. All original H25 evidence retained, NONPASS unchanged. No push/tag/publish/reset or unrelated staging. Queue/ledger root-written before freeze. F26a remains prohibited until separate transition actual-byte proof.',time:new Date().toISOString()};
e.writeNew('f25-source-byte-verification-05.json',proof);console.log(JSON.stringify({status:'PASS_SCOPED_F25_SOURCE_COMMIT_BYTES',revision,verifiedMembershipPaths:verified.length,artifact:proof.retainedArtifact.sha256}));
