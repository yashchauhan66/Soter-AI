'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),e=require('./scoped-git-lib-01.cjs');
const membership=e.read(e.base+'/transition-membership-01.json');assert.equal(e.git(['rev-parse','HEAD']).toString().trim(),membership.parent);assert.equal(e.cached().length,0);for(const row of membership.records)assert.deepEqual(e.fact(row.path),row);
function checkSourceWorkingBytes(){
 require('./check-inputs-02.cjs');
 const source=e.read(e.base+'/f24-source-byte-verification-01.json');assert.equal(source.status,'PASS');
 assert.equal(source.revision,membership.parent);assert.equal(source.mismatches.length,0);
 for(const row of source.records){if(row.path==='docs/soterai-lite/ledger.md'||row.path==='docs/soterai-lite/FEATURE-QUEUE.json')continue;assert.deepEqual(e.fact(row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256},'Final transition source working bytes');}
 assert.equal(e.fact(source.retainedArtifact.path).sha256,source.retainedArtifact.sha256);
}
checkSourceWorkingBytes();
const frozen=[...membership.records,e.fact(e.base+'/transition-membership-01.json')].sort((a,b)=>a.path.localeCompare(b.path));
const paths=frozen.map(row=>row.path),spec=path.join(__dirname,'transition-pathspec-01.bin');fs.writeFileSync(spec,Buffer.from(paths.join('\0')+'\0'),{flag:'wx'});
e.git(['add','-f','--pathspec-from-file='+path.relative(e.repo,spec),'--pathspec-file-nul']);const staged=e.cached();assert(staged.length>0);assert(staged.every(file=>paths.includes(file)));const records=paths.map(file=>frozen.find(row=>row.path===file));for(const row of records)assert.deepEqual(e.fact(row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256},'Frozen membership working bytes');e.verify(paths.map(file=>':'+file),records);
const output=e.git(['commit','-m','docs(lite): record F24 verification and activate F25 after byte barrier']);fs.writeFileSync(path.join(__dirname,'transition-commit-output-01.txt'),output,{flag:'wx'});
const revision=e.git(['rev-parse','HEAD']).toString().trim(),changed=e.git(['diff-tree','--no-commit-id','--name-only','-z','-r',revision]).toString().split('\0').filter(Boolean).sort();assert.equal(e.git(['rev-parse',revision+'^']).toString().trim(),membership.parent);assert.deepEqual(changed,staged);const verified=e.verify(paths.map(file=>revision+':'+file),records);assert.equal(e.cached().length,0);for(const row of records)assert.deepEqual(e.fact(row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256},'Frozen membership working bytes');assert.equal(e.fact(membership.artifact.path).sha256,membership.artifact.sha256);
checkSourceWorkingBytes();
const proof={status:'PASS',feature:'F24_TRANSITION_F25_ACTIVE',revision,parent:membership.parent,indexedEntries:membership.records.length,committedPaths:changed.length,verifiedMembershipPaths:verified.length,mismatches:[],unexpectedPaths:0,artifact:e.fact(membership.artifact.path),records:verified,time:new Date().toISOString()};fs.writeFileSync(path.join(__dirname,'f24-transition-byte-verification-01.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS_TRANSITION_BYTES_F25_MAY_START',revision,paths:verified.length,artifact:proof.artifact.sha256}));
