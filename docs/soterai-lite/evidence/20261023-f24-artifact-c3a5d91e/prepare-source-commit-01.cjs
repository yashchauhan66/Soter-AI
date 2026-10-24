'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),e=require('./scoped-git-lib-01.cjs');
require('./check-inputs-01.cjs');
const acceptance=e.read(e.base+'/f24-acceptance-01.json');assert.equal(acceptance.status,'PASS_SCOPED_REQUIRED_F24_GATES_BYTE_BARRIERS_PENDING');
assert.equal(e.fact(acceptance.artifact.path).sha256,acceptance.artifact.sha256);
const parent='af50adade9ce01efb0760cb3c96767f1a63fd793';assert.equal(e.git(['rev-parse','HEAD']).toString().trim(),parent);assert.equal(e.cached().length,0);
for(const row of e.read(e.base+'/actual-native-execution-snapshots-01.json').records)assert.equal(e.fact(row.path).sha256,row.sha256);
const qfile=path.join(e.repo,'docs/soterai-lite/FEATURE-QUEUE.json'),q=JSON.parse(fs.readFileSync(qfile,'utf8'));assert.equal(q.activeFeature,'F24');
const card=q.features.find(row=>row.id==='F24');assert.equal(card.status,'ACTIVE');card.status='VERIFYING';card.acceptanceEvidence=e.base+'/f24-acceptance-01.json';
fs.writeFileSync(qfile,JSON.stringify(q,null,2)+'\n');
const text=['','## STEP RECEIPT F24 / scoped required gates PASS; local byte barriers pending','',
 `Exact new VSIX ${acceptance.artifact.sha256} (${acceptance.artifact.bytes}bytes), frontend ${acceptance.frontendSha256}. Actual current full ${acceptance.full.tests}tests/${acceptance.full.pass}PASS/${acceptance.full.skipped}SKIP; focused148tests147PASS1SKIP/compiler/backend/readiness/content14entries3runtimes80machine settings PASS. Actual artifact25/currenthistory25/MCP+9scanners/retained106/functional10/security17same8BLOCKED_SCOPED9LEAK_CONFIRMED PASS; owned phase exit0/bothEOF/signals0/exact runtimes and host, executed fixtures retained. Bounded private canonical analysis/artifact-v1 independently keyed metadata/strict machine withdrawal/native owner review. No original TextDocument, reference/build/config execution, cleanup, vault mutation or past-copy recall. Maps/mapping URLs/unknown syntax/binary/caps are withheld or PARTIAL. Current public assets remain useful, recognized static source/text values become placeholders; H09/H10 and actual publication withdrawal PASS. Original failures/beforebytes/three product corrections/fixture changes/root test-context failure retained unregraded. F24 VERIFYING; F25 requires actual scoped source+transition commits and exhaustive bytes. LOW/no rating/human independence/OS boundary/perfect protection claim. Original L6 HUMAN-ACTIONS STOP, disk waiver and unrelated work persist.`, ''].join('\n');
fs.appendFileSync(path.join(e.repo,'docs/soterai-lite/ledger.md'),text);
const paths=[...new Set([...e.production,...e.walk(e.base)])].sort(),records=paths.map(e.fact);
fs.writeFileSync(path.join(__dirname,'source-membership-01.json'),JSON.stringify({status:'FROZEN_SCOPED_SOURCE_EVIDENCE_MEMBERSHIP',parent,records,retainedArtifact:acceptance.artifact,
 scope:'Explicit F24 source/tests/docs/queue/ledger and retained evidence only. Every indexed record including unchanged paths and membership JSON must match index and actual commit bytes. Artifact retained and freshly rechecked; unrelated paths excluded.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_SCOPED_MEMBERSHIP',paths:records.length}));
