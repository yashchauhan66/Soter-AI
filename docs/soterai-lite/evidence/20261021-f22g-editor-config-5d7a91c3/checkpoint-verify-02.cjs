'use strict';
// Exhaustive object/index/current-byte proof for unfinished F22g custody only.
const h=require('./evidence-lib-01.cjs');
const {fs,path,assert,repo,base,sha,hash,read,own,fact,write,git,lines,current,receipt}=h;
const staged=process.argv[2]==='--staged',revision=staged?'':process.argv[2];assert(staged||/^[a-f0-9]{40}$/.test(revision||''));
const indexPath=base+'/checkpoint-evidence-index-02.json',index=read(own('checkpoint-evidence-index-02.json'));assert.equal(index.status,'INCOMPLETE');assert.equal(index.feature,'F22g');assert.equal(index.parent,'91f5820f337f00ad4da89ab9b8dcc9975f8a13a8');assert.equal(lines(git('rev-parse',staged?'HEAD':revision+'^'))[0],index.parent);
assert.equal(sha(git('show',revision+':'+indexPath)),hash(own('checkpoint-evidence-index-02.json')));
git.preload(revision,index.entries.map(row=>row.path));const mismatches=[];
for(const row of index.entries){const blob=git('show',revision+':'+row.path);if(blob.length!==row.bytes||sha(blob)!==row.sha256)mismatches.push(row.path);current(row);}assert.deepEqual(mismatches,[]);
const changed=lines(staged?git('diff','--cached','--name-only'):git('diff-tree','--no-commit-id','--name-only','-r',revision)).sort();assert.deepEqual(changed,index.expectedCommitPaths.slice().sort());
for(const mapping of index.generatedInputSnapshots??[]){assert.equal(mapping.snapshot.sha256,mapping.original.sha256);assert.equal(mapping.snapshot.bytes,mapping.original.bytes);assert.equal(sha(git('show',revision+':'+mapping.snapshot.path)),mapping.original.sha256);current(mapping.original);}
const checkpoint=read(own('checkpoint-receipt-02.json'));assert.equal(checkpoint.status,'INCOMPLETE');assert.equal(checkpoint.featureStatus,'ACTIVE');assert.equal(checkpoint.acceptance,'NOT_GRANTED');assert.equal(checkpoint.nextFeature,'NOT_STARTED');current(checkpoint.artifact);assert.equal(checkpoint.artifact.sha256,'f27ecdf71536d8ce6cf50b97d3824e8178c2c19e5ca640fd378331788c15b500');for(const row of [...checkpoint.inputs,...checkpoint.parserInputs])current(row);current(checkpoint.failureStability);
for(const row of checkpoint.stableStreams){assert.equal(hash(own(row.path)),row.sha256);assert.equal(fs.statSync(own(row.path)).size,row.bytes);}
for(const command of checkpoint.failedCommands){assert.equal(command.exitCode,1);current(command.log);current(command.receipt);const raw=read(path.join(repo,command.receipt.path));assert.equal(raw.exitCode,1);assert.equal(raw.sha256.toLowerCase(),command.log.sha256);}
for(const failure of checkpoint.ciFailures){current(failure.freeze);current(failure.close);for(const row of failure.files)current(row);assert.equal(failure.bothEOF,true);assert.equal(failure.signalsRequested,0);}
current(index.executionSnapshots);const execution=read(own('execution-snapshot-index-02.json'));assert.equal(execution.status,'PASS_EXPLICIT_OWNED_EXECUTION_BYTES');for(const row of execution.files){current(row.snapshot);assert.equal(row.snapshot.sha256,row.original.sha256);assert.equal(row.snapshot.bytes,row.original.bytes);assert.equal(hash(row.original.path),row.original.sha256);}
const queue=read(path.join(repo,'docs/soterai-lite/FEATURE-QUEUE.json')),card=queue.features.find(row=>row.id==='F22');assert.equal(queue.activeFeature,'F22');assert.equal(card.activeSubcard,'F22g');assert.equal(card.subcards.find(row=>row.id==='F22g')?.status,'ACTIVE');assert.notEqual(card.subcards.find(row=>row.id==='F22h')?.status,'ACTIVE');assert(!fs.existsSync(own('f22g-acceptance-01.json')));
if(staged)console.log(JSON.stringify({status:'PASS_CHECKPOINT_STAGED_BYTES_FEATURE_ACTIVE_INCOMPLETE',indexed:index.entries.length,paths:changed.length,mismatches:0,feature:'F22g',acceptance:'NOT_GRANTED',nextFeature:'NOT_STARTED'}));
else{
 assert.equal(lines(git('rev-parse','HEAD'))[0],revision);assert.deepEqual(lines(git('diff','--cached','--name-only')),[]);
 const commit=receipt('checkpoint-local-commit-02.txt');assert(commit.arguments.includes('commit'));
 write('checkpoint-committed-byte-verification-02.json',{
  schemaVersion:2,status:'PASS_CHECKPOINT_BYTES_ONLY',feature:'F22g',featureStatus:'ACTIVE',completion:'INCOMPLETE',acceptance:'NOT_GRANTED',nextFeature:'NOT_STARTED',revision,parent:index.parent,indexedEntries:index.entries.length,generatedRuntimeSnapshots:(index.generatedInputSnapshots??[]).length,executionSnapshots:execution.files.length,committedPaths:changed.length,mismatches:[],unexpectedPaths:0,
  artifact:{...checkpoint.artifact,recheck:'PASS'},checkpoint:fact(own('checkpoint-receipt-02.json')),index:fact(own('checkpoint-evidence-index-02.json')),executionIndex:fact(own('execution-snapshot-index-02.json')),failureStability:checkpoint.failureStability,commitOutput:commit.log,commitReceipt:commit.receipt,
  componentEvidence:{full:checkpoint.full,backend:checkpoint.backend,focused:checkpoint.focused,editor:checkpoint.editor},native:checkpoint.native,affected:checkpoint.affected,safeWithdrawal:checkpoint.safeWithdrawal,
  resume:{oldParent:index.parent,newParent:revision,oldNormalParentBoundToolsStale:true,rebaseRequiredBeforeEventualFinalAcceptance:true,queueRemains:'F22g ACTIVE / F22h NOT_STARTED',noFurtherHostRetryAuthorizedByCheckpoint:true,readLedgerFirst:true},
  scope:'Exhaustive committed object/index/working bytes and exact scoped changed paths agree, including retained failures and original-byte runtime/test/native execution snapshots. This proves custody of unfinished F22g only. The post-commit proof and verification/commit logs are late evidence outside this commit, retained for a later scoped custody commit; no normal source-acceptance or feature-transition operation ran.',independence:'LOW',rating:'PENDING',time:new Date().toISOString()
 });
 console.log(JSON.stringify({status:'PASS_CHECKPOINT_COMMITTED_BYTES_FEATURE_ACTIVE_INCOMPLETE',revision,indexed:index.entries.length,paths:changed.length,acceptance:'NOT_GRANTED',nextFeature:'NOT_STARTED'}));
}
