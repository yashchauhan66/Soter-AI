'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const prior=path.resolve(__dirname,'../20261023-f24-artifact-c3a5d91e'),e=require(path.join(prior,'scoped-git-lib-01.cjs'));
require(path.join(prior,'check-inputs-02.cjs'));require(path.join(prior,'current-acceptance-guard-01.cjs')).check();
const read=name=>JSON.parse(fs.readFileSync(path.join(prior,name),'utf8').replace(/^\uFEFF/,''));
const source=read('f24-source-byte-verification-01.json'),transition=read('f24-transition-byte-verification-01.json');
assert.equal(source.status,'PASS');assert.equal(transition.status,'PASS');assert.equal(source.revision,transition.parent);
assert.equal(source.verifiedMembershipPaths,660);assert.equal(transition.verifiedMembershipPaths,11);
assert.equal(e.git(['rev-parse','HEAD']).toString().trim(),'10d3916f1fa0000300813b8696b068a6c880b6d9');assert.equal(e.cached().length,0);
for(const proof of [source,transition]){assert.equal(proof.mismatches.length,0);assert.equal(proof.unexpectedPaths,0);e.verify(proof.records.map(row=>proof.revision+':'+row.path),proof.records);}
for(const row of transition.records)assert.deepEqual(e.fact(row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256});
assert.equal(e.fact(source.retainedArtifact.path).sha256,source.retainedArtifact.sha256);
const queue=e.read('docs/soterai-lite/FEATURE-QUEUE.json');assert.equal(queue.activeFeature,'F25');assert.equal(queue.features.find(row=>row.id==='F24').status,'DONE');
const out=path.join(__dirname,'prerequisite-proof-originals-01');fs.mkdirSync(out);const records=[];
for(const name of ['f24-source-byte-verification-01.json','source-commit-run-04.txt','source-commit-run-04.txt.result.json','f24-transition-byte-verification-01.json','transition-commit-run-04.txt','transition-commit-run-04.txt.result.json']){
 const bytes=fs.readFileSync(path.join(prior,name));fs.writeFileSync(path.join(out,name),bytes,{flag:'wx'});records.push({source:path.relative(e.repo,path.join(prior,name)).replaceAll('\\','/'),path:path.relative(e.repo,path.join(out,name)).replaceAll('\\','/'),bytes:bytes.length,sha256:e.sha(bytes)});
}
const value={status:'PASS_F24_PREREQUISITE_EXHAUSTIVE_BYTES_F25_TEST_FIRST_ACTIVE',parent:transition.revision,sourcePaths:660,transitionPaths:11,artifact:source.retainedArtifact,records,productionImplemented:false,independence:'LOW',time:new Date().toISOString()};
fs.writeFileSync(path.join(__dirname,'start-checkpoint-01.json'),JSON.stringify(value,null,2),{flag:'wx'});
const base=path.relative(e.repo,__dirname).replaceAll('\\','/');
fs.appendFileSync(path.join(e.repo,'docs/soterai-lite/ledger.md'),['','## STEP RECEIPT F25-START / F24 byte barriers PASS; saved-log and owned-output tests first','',`F24 source${source.revision} all660paths and transition${transition.revision} all11paths freshly actual-Git-byte-verified, zero mismatch/unexpected; current917input/acceptancefacts/exactVSIXfd19ddd440164b540bdf786b6cded0f8aea0c6a2bab2175847e782355a3bdaa2 rechecked/indexempty. ActualF24 full3570tests3566PASS4SKIP/focused148tests147PASS1SKIP/compiler/backend/readiness/content80settings/native383checks26phases13families/44executedfixtures/functional10/security17same8BLOCKED9LEAK PASS; failures retained. ${base}/work-card-01.md executes existingF25/U7/LS41LS42, strictmachinelogProtection, bounded owner-reviewed savedlogs andF08 owned app/task/lifecycle-debug collectors with final exact-result release guards. Preparedparalleltests only; actualmissingmodule/before-regression baseline pending, no F25production or native/artifact claim. F26-F32/V01-V05 pending; LOW/no rating/L6HUMAN-ACTIONSSTOP/diskwaiver/unrelatedwork persist.`,''].join('\n'));
console.log(JSON.stringify({status:value.status,parent:value.parent,sourcePaths:660,transitionPaths:11}));
