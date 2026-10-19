'use strict';
const h=require('../20261019-f19-claude-89c1e602/evidence-lib-01.cjs');
const {fs,path,assert,repo,sha,read,git,lines,current,fact}=h;
const prior=path.resolve(__dirname,'../20261019-f19-claude-89c1e602');
const head=lines(git('rev-parse','HEAD'))[0];
assert.equal(head,'6e98442f025c3a839428f4eafff23c3e8e4f3086');
const index=read(path.join(prior,'f19-evidence-index-01.json'));
const transition=read(path.join(prior,'f19-transition-index-01.json'));
const source='f1d1fd1bfe1717c29fc411c3945965120455ecc2';
git.preload(source,index.entries.map(e=>e.path));
for(const e of index.entries){const b=git('show',source+':'+e.path);assert.equal(sha(b),e.sha256,e.path);assert.equal(b.length,e.bytes);if(!['docs/soterai-lite/ledger.md','docs/soterai-lite/FEATURE-QUEUE.json'].includes(e.path))current(e);}
for(const m of index.generatedInputSnapshots){assert.equal(m.snapshot.sha256,m.original.sha256);current(m.original);}
git.preload(head,transition.entries.map(e=>e.path));
for(const e of transition.entries){assert.equal(sha(git('show',head+':'+e.path)),e.sha256);current(e);}
const acceptance=read(path.join(prior,'f19-acceptance-01.json'));current(acceptance.artifact);for(const e of acceptance.inputs)current(e);
const q=read(path.join(repo,'docs/soterai-lite/FEATURE-QUEUE.json'));assert.equal(q.activeFeature,'F20');assert.equal(q.features.filter(r=>r.status==='ACTIVE').length,1);
const receipt={status:'PASS',head,source,indexedSourceEntries:index.entries.length,indexedTransitionEntries:transition.entries.length,originalRuntimeSnapshots:index.generatedInputSnapshots.length,artifact:acceptance.artifact,proofs:['f19-committed-byte-verification-01.json','f19-transition-byte-verification-01.json'].map(n=>{const f=path.join(prior,n);assert.equal(read(f).status,'PASS');return fact(f);}),trackedDiff:git('status','--short','--untracked-files=no').toString('utf8'),frozenCatalog:fact(path.join(repo,'docs/soterai-lite/LITE-CATALOG.json')),master:fact(path.join(repo,'docs/soterai-lite/MASTER-PROMPT-20261016.txt')),time:new Date().toISOString(),independence:'LOW'};
fs.writeFileSync(path.join(__dirname,'checkpoint-01.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS',head,sourceEntries:index.entries.length,runtimeSnapshots:index.generatedInputSnapshots.length}));
