'use strict';
const h=require('../20261018-f16-gateway-policy-6e9a31d4/f16-byte-transition-lib-03.cjs');
const {assert,git,read,own,sha,bytes,hash,inside,repo,sourceProof,queueTransition}=h;
const revision='b0f6d15001a1ea37bc80df165df92bae070a12c1';
assert.equal(git('rev-parse','HEAD').toString().trim(),revision);
const proof=read(own('f16-transition-byte-verification-01.json'));
assert.equal(proof.status,'PASS');assert.equal(proof.revision,revision);
const index=read(own('f16-transition-index-01.json'));
git.preload(revision,index.entries.map(e=>e.path));
for(const e of index.entries){const blob=git('show',revision+':'+e.path);assert.equal(blob.length,e.bytes);assert.equal(sha(blob),e.sha256);assert.equal(hash(inside(repo,e.path)),e.sha256);}
assert.deepEqual(git('diff-tree','--no-commit-id','--name-only','-r',revision).toString().trim().split(/\r?\n/).sort(),index.expectedCommitPaths.slice().sort());
const source=sourceProof(proof.sourceRevision,proof.artifact.sha256,index.sourceRunLogName);
queueTransition(JSON.parse(bytes(inside(repo,'docs/soterai-lite/FEATURE-QUEUE.json')).toString('utf8')),proof.sourceRevision);
const result={status:'PASS',head:revision,sourceRevision:proof.sourceRevision,sourceIndexed:source.sourceIndex.entries.length,transitionIndexed:index.entries.length,artifact:proof.artifact.sha256,independence:'LOW',next:'F17 test-first',time:new Date().toISOString()};
require('node:fs').writeFileSync(require('node:path').join(__dirname,'checkpoint-01.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
