'use strict';
if('__F25_BYTE_PROOF_BOUND__'!=='F25_CURRENT_BYTE_PROOF_FACTS_BOUND')throw Error('F25 source preparation PREPARED_NOT_BOUND; no Git, membership freeze or queue mutation authorized by this template');
// Root executes only after final current acceptance and root-written queue/ledger.
const assert=require('node:assert/strict'),e=require('./scoped-git-lib-05.cjs');
const binding=e.checkBoundConfig(),acceptance=require('./current-acceptance-guard-05.cjs').check();
assert.equal(e.head(),binding.parent);assert.equal(e.cached().length,0,'Unrelated index content');
const queue=e.read('docs/soterai-lite/FEATURE-QUEUE.json');assert.equal(queue.activeFeature,'F25');const card=queue.features.find(row=>row.id==='F25');assert.equal(card.status,'VERIFYING');assert.equal(card.acceptanceEvidence,e.base+'/f25-acceptance-01.json');assert.equal(queue.features.find(row=>row.id==='F26').status,'PLANNED');
assert.equal(e.fact('docs/soterai-lite/FEATURE-QUEUE.json').sha256,binding.sourceQueueSha256);assert.equal(e.fact('docs/soterai-lite/ledger.md').sha256,binding.sourceLedgerSha256);
const evidence=e.walk(e.base),paths=[...new Set([...binding.sourcePaths,...evidence])].sort(),records=paths.map(e.fact);e.checkFacts(records,'Preparation frozen scope');
const membership={status:'FROZEN_F25_SCOPED_SOURCE_EVIDENCE_MEMBERSHIP_NOT_COMMITTED',feature:'F25',parent:binding.parent,sourcePaths:binding.sourcePaths,records,acceptance:acceptance.acceptance,retainedArtifact:acceptance.artifact,knownNonPassEvidence:binding.knownNonPassEvidence,scope:'Explicit33root-reviewed production/unit/docs paths plus EVERY current H25 evidence file recursively, including original failures/corrupt NUL bytes as NONPASS. Unrelated ws-bridge/phase2 paths excluded. No queue/ledger write by this helper; root supplied reviewed exact bytes. Source membership JSON itself is additionally frozen before git add and checked in index/actual commit even when unchanged.'};
e.writeNew('source-membership-05.json',membership);
console.log(JSON.stringify({status:membership.status,paths:records.length,acceptanceFacts:acceptance.recursiveFacts,execution:'NO_COMMIT_YET'}));
