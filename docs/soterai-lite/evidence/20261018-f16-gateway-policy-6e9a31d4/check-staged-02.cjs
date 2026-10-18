'use strict';
const h=require('./f16-evidence-lib.cjs'),{assert,repo,base,bytes,sha,hash,read,inside,own,git,lines}=h,indexPath=base+'/f16-evidence-index-02.json',index=read(own('f16-evidence-index-02.json'));
assert.equal(lines(git('rev-parse','HEAD'))[0],index.parent);assert.deepEqual(lines(git('diff','--cached','--name-only')).sort(),[...index.expectedCommitPaths].sort());assert.equal(sha(git('show',':'+indexPath)),hash(inside(repo,indexPath)));git.preload('',index.entries.map(e=>e.path));
for(const entry of index.entries){const staged=git('show',':'+entry.path),current=bytes(inside(repo,entry.path));assert.equal(staged.length,entry.bytes,entry.path);assert.equal(sha(staged),entry.sha256,entry.path);assert.equal(current.length,entry.bytes,entry.path);assert.equal(sha(current),entry.sha256,entry.path);}
console.log(JSON.stringify({status:'PASS_EVERY_INDEXED_STAGED_AND_CURRENT_BYTE',indexed:index.entries.length,stagedPaths:index.expectedCommitPaths.length}));
