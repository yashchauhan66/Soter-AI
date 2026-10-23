'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),e=require('./scoped-git-lib-01.cjs');
const membership=e.read(e.base+'/source-membership-01.json');assert.equal(e.git(['rev-parse','HEAD']).toString().trim(),membership.parent);assert.equal(e.cached().length,0);
for(const row of membership.records)assert.deepEqual(e.fact(row.path),row);
const paths=[...membership.records.map(row=>row.path),e.base+'/source-membership-01.json'].sort(),pathspec=path.join(__dirname,'source-pathspec-01.bin');fs.writeFileSync(pathspec,Buffer.from(paths.join('\0')+'\0'),{flag:'wx'});
// -f applies only to the explicit allowlist, including retained generated
// runtime/driver evidence under ignored dist folders. No wildcard staging.
e.git(['add','-f','--pathspec-from-file='+path.relative(e.repo,pathspec),'--pathspec-file-nul']);
const staged=e.cached();assert(staged.every(file=>paths.includes(file)));const records=staged.map(e.fact);e.verify(staged.map(file=>':'+file),records);
fs.writeFileSync(path.join(__dirname,'source-stage-byte-check-01.json'),JSON.stringify({status:'PASS',parent:membership.parent,paths:records.length,mismatches:[],records},null,2)+'\n',{flag:'wx'});
const output=e.git(['commit','-m','feat(lite): add owner-reviewed bounded Git history scanning (F23)']);fs.writeFileSync(path.join(__dirname,'source-commit-output-01.txt'),output,{flag:'wx'});
const revision=e.git(['rev-parse','HEAD']).toString().trim();assert.notEqual(revision,membership.parent);assert.equal(e.git(['rev-parse',revision+'^']).toString().trim(),membership.parent);
const changed=e.git(['diff-tree','--no-commit-id','--name-only','-z','-r',revision]).toString().split('\0').filter(Boolean).sort();assert.deepEqual(changed,staged);const verified=e.verify(staged.map(file=>revision+':'+file),records);assert.equal(e.cached().length,0);
const proof={status:'PASS',feature:'F23',revision,parent:membership.parent,indexedEntries:membership.records.length,committedPaths:verified.length,mismatches:[],unexpectedPaths:0,retainedArtifact:e.fact(membership.retainedArtifact.path),records:verified,scope:'Exhaustive actual committed bytes for every changed scoped source/evidence path; unrelated working changes were not staged. Artifact retained locally and freshly byte-rechecked; no publish/push/tag.',time:new Date().toISOString()};
assert.equal(proof.retainedArtifact.sha256,membership.retainedArtifact.sha256);fs.writeFileSync(path.join(__dirname,'f23-source-byte-verification-01.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS_SCOPED_SOURCE_COMMIT_BYTES',revision,paths:verified.length,artifact:proof.retainedArtifact.sha256}));
