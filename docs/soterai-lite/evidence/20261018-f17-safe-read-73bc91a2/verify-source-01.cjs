'use strict';
const h=require('./evidence-lib-01.cjs'),{fs,assert,repo,base,sha,hash,read,inside,own,fact,write,git,lines,current,receipt}=h;
const staged=process.argv[2]==='--staged',revision=staged?'':process.argv[2];assert.ok(staged||/^[a-f0-9]{40}$/.test(revision||''));
const indexPath=base+'/f17-evidence-index-01.json',index=read(own('f17-evidence-index-01.json'));
assert.equal(lines(git('rev-parse',staged?'HEAD':revision+'^'))[0],index.parent);
assert.equal(sha(git('show',revision+':'+indexPath)),hash(own('f17-evidence-index-01.json')));
git.preload(revision,index.entries.map(r=>r.path));
for(const entry of index.entries){const blob=git('show',revision+':'+entry.path);assert.equal(blob.length,entry.bytes,entry.path);assert.equal(sha(blob),entry.sha256,entry.path);current(entry);}
const changed=lines(staged?git('diff','--cached','--name-only'):git('diff-tree','--no-commit-id','--name-only','-r',revision)).sort();assert.deepEqual(changed,index.expectedCommitPaths.slice().sort());
const acceptance=read(own('f17-acceptance-01.json'));assert.equal(acceptance.status,'PASS');current(acceptance.artifact);for(const input of acceptance.inputs)current(input);
if(staged)console.log(JSON.stringify({status:'PASS_ALL_INDEXED_STAGED_CURRENT_BYTES',indexed:index.entries.length,paths:changed.length}));
else {const commit=receipt('f17-source-commit-01.txt');assert.ok(commit.arguments.includes('commit'));write('f17-committed-byte-verification-01.json',{status:'PASS',feature:'F17',revision,parent:index.parent,indexedEntries:index.entries.length,committedPaths:changed.length,mismatches:[],unexpectedPaths:0,artifact:{...acceptance.artifact,recheck:'PASS'},index:fact(own('f17-evidence-index-01.json')),commitOutput:commit.log,commitReceipt:commit.receipt,independence:'LOW',time:new Date().toISOString()});console.log(JSON.stringify({status:'PASS_SOURCE_BYTES',revision,indexed:index.entries.length,paths:changed.length}));}
