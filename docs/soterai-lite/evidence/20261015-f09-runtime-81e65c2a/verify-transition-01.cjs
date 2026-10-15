// Read-only Git verification after the explicit scoped transition commit.
const h=require('./f09-evidence-lib.cjs');
const{assert,repo,base,sha,bytes,hash,inside,own,git,lines,noOutputs,write}=h;
const revision=process.argv[2],sourceRevision=process.argv[3],artifactSha256=process.argv[4];
assert.match(revision??'',/^[a-f0-9]{40}$/);assert.match(sourceRevision??'',/^[a-f0-9]{40}$/);assert.match(artifactSha256??'',/^[a-f0-9]{64}$/);
assert.equal(lines(git('rev-parse','HEAD'))[0],revision);assert.equal(lines(git('rev-parse',revision+'^'))[0],sourceRevision);assert.deepEqual(lines(git('diff','--cached','--name-only')),[]);
const indexPath=base+'/f09-transition-index-01.json',committedIndex=git('show',revision+':'+indexPath);assert.equal(hash(inside(repo,indexPath)),sha(committedIndex));
const index=JSON.parse(committedIndex.toString('utf8'));assert.equal(index.status,'PASS');assert.equal(index.sourceRevision,sourceRevision);assert.equal(index.artifactSha256,artifactSha256);
const indexed=new Set(index.entries.map(entry=>entry.path));
for(const entry of index.entries){const committed=git('show',revision+':'+entry.path);assert.equal(committed.length,entry.bytes);assert.equal(sha(committed),entry.sha256);assert.equal(hash(inside(repo,entry.path)),entry.sha256);}
const expected=bytes(own('f09-transition-allowlist-01.txt')).toString('utf8').trim().split(/\r?\n/).filter(Boolean).sort();
const actual=lines(git('diff-tree','--no-commit-id','--name-only','-r',revision)).sort();assert.deepEqual(actual,expected);assert.ok(actual.every(name=>name===indexPath||indexed.has(name)));
const acceptance=JSON.parse(git('show',sourceRevision+':'+base+'/f09-acceptance-01.json').toString('utf8'));assert.equal(acceptance.artifact.sha256,artifactSha256);assert.equal(hash(inside(repo,acceptance.artifact.path)),artifactSha256);
const queue=JSON.parse(git('show',revision+':docs/soterai-lite/FEATURE-QUEUE.json').toString('utf8'));
assert.equal(queue.activeFeature,'F10');assert.equal(queue.features.find(row=>row.id==='F09').sourceEvidenceCommit,sourceRevision);
noOutputs(['f09-transition-byte-verification-01.json']);
write('f09-transition-byte-verification-01.json',{status:'PASS',revision,sourceRevision,indexedEntries:index.entries.length,committedPaths:actual.length,mismatches:[],unexpectedPaths:0,artifactRecheck:'PASS',artifactSha256});
console.log(JSON.stringify({status:'PASS',revision,indexedEntries:index.entries.length,committedPaths:actual.length}));