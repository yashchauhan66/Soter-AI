'use strict';
// A PASS here proves exact checkpoint bytes only, never F22g acceptance.
const h=require('./evidence-lib-01.cjs');
const {fs,path,assert,repo,base,sha,hash,read,own,fact,write,git,lines,current}=h;
const staged=process.argv[2]==='--staged',revision=staged?'':process.argv[2];assert(staged||/^[a-f0-9]{40}$/.test(revision||''));
const indexPath=base+'/checkpoint-evidence-index-01.json',index=read(own('checkpoint-evidence-index-01.json'));
assert.equal(index.status,'INCOMPLETE');assert.equal(index.feature,'F22g');assert.equal(lines(git('rev-parse',staged?'HEAD':revision+'^'))[0],index.parent);
assert.equal(sha(git('show',revision+':'+indexPath)),hash(own('checkpoint-evidence-index-01.json')));
git.preload(revision,index.entries.map(row=>row.path));const mismatches=[];
for(const row of index.entries){const blob=git('show',revision+':'+row.path);if(blob.length!==row.bytes||sha(blob)!==row.sha256)mismatches.push(row.path);current(row);}assert.deepEqual(mismatches,[]);
const changed=lines(staged?git('diff','--cached','--name-only'):git('diff-tree','--no-commit-id','--name-only','-r',revision)).sort();assert.deepEqual(changed,index.expectedCommitPaths.slice().sort());
for(const mapping of index.generatedInputSnapshots??[]){assert.equal(mapping.snapshot.sha256,mapping.original.sha256);assert.equal(mapping.snapshot.bytes,mapping.original.bytes);assert.equal(sha(git('show',revision+':'+mapping.snapshot.path)),mapping.original.sha256);current(mapping.original);}
const checkpoint=read(own('checkpoint-receipt-01.json'));assert.equal(checkpoint.status,'INCOMPLETE');assert.equal(checkpoint.acceptance,'NOT_GRANTED');assert.equal(checkpoint.nextFeature,'NOT_STARTED');
current(checkpoint.artifact);for(const row of [...checkpoint.inputs,...checkpoint.parserInputs])current(row);
for(const attempt of checkpoint.nativeAttempts){current(attempt.freeze);current(attempt.close);current(attempt.stdout);current(attempt.stderr);assert.equal(attempt.status,'FAILED_STARTUP_NO_NATIVE_ASSERTION_RESULT');assert.equal(attempt.observedExit,1);assert.equal(attempt.bothEOF,true);assert.equal(attempt.signalsRequested,0);}
const queue=read(path.join(repo,'docs/soterai-lite/FEATURE-QUEUE.json')),card=queue.features.find(row=>row.id==='F22');assert.equal(queue.activeFeature,'F22');assert.equal(card.activeSubcard,'F22g');assert(['ACTIVE','INCOMPLETE'].includes(card.subcards.find(row=>row.id==='F22g')?.status));assert.notEqual(card.subcards.find(row=>row.id==='F22h')?.status,'ACTIVE');
if(staged)console.log(JSON.stringify({status:'PASS_CHECKPOINT_STAGED_BYTES_FEATURE_INCOMPLETE',indexed:index.entries.length,paths:changed.length,mismatches:0,feature:'F22g',acceptance:'NOT_GRANTED'}));
else{
 assert.equal(lines(git('rev-parse','HEAD'))[0],revision);assert.deepEqual(lines(git('diff','--cached','--name-only')),[]);
 write('checkpoint-committed-byte-verification-01.json',{
  status:'PASS_CHECKPOINT_BYTES_ONLY',feature:'F22g',featureStatus:'INCOMPLETE',acceptance:'NOT_GRANTED',nextFeature:'NOT_STARTED',revision,parent:index.parent,indexedEntries:index.entries.length,generatedRuntimeSnapshots:(index.generatedInputSnapshots??[]).length,committedPaths:changed.length,mismatches:[],unexpectedPaths:0,
  artifact:{...checkpoint.artifact,recheck:'PASS'},checkpoint:fact(own('checkpoint-receipt-01.json')),index:fact(own('checkpoint-evidence-index-01.json')),native:checkpoint.native,affected:checkpoint.affected,
  scope:'Committed object, index, working inputs, original-byte runtime snapshots and exact changed-path allowlist match. This is custody of an unfinished feature, not native verification, acceptance or advancement. The post-commit proof itself requires a later scoped evidence commit for committed custody.',independence:'LOW',time:new Date().toISOString()
 });
 console.log(JSON.stringify({status:'PASS_CHECKPOINT_COMMITTED_BYTES_FEATURE_INCOMPLETE',revision,indexed:index.entries.length,paths:changed.length,acceptance:'NOT_GRANTED'}));
}
