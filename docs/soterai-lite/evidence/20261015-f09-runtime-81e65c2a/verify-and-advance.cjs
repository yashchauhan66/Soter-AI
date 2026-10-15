// Root runs after an explicit scoped source/evidence commit. No staging/commit.
const h=require('./f09-evidence-lib.cjs');
const{fs,path,assert,repo,base,sha,bytes,hash,read,relative,inside,own,git,lines,noOutputs,write,fileFact}=h;
const revision=process.argv[2],expectedArtifact=process.argv[3],sourceLogName=process.argv[4];
assert.match(revision??'',/^[a-f0-9]{40}$/);assert.match(expectedArtifact??'',/^[a-f0-9]{64}$/);assert.ok(sourceLogName&&sourceLogName.endsWith('.txt'));
const sourceLog=own(sourceLogName);assert.ok(fs.existsSync(sourceLog));
assert.equal(lines(git('rev-parse','HEAD'))[0],revision);assert.deepEqual(lines(git('diff','--cached','--name-only')),[]);
const indexPath=base+'/f09-evidence-index-01.json',committedIndex=git('show',revision+':'+indexPath);
assert.equal(hash(inside(repo,indexPath)),sha(committedIndex));const index=JSON.parse(committedIndex.toString('utf8'));
const indexed=new Set(index.entries.map(entry=>entry.path));
for(const entry of index.entries){const committed=git('show',revision+':'+entry.path);assert.equal(committed.length,entry.bytes);assert.equal(sha(committed),entry.sha256);assert.equal(hash(inside(repo,entry.path)),entry.sha256);assert.equal(fs.statSync(inside(repo,entry.path)).size,entry.bytes);}
const expected=bytes(own('f09-commit-allowlist-01.txt')).toString('utf8').trim().split(/\r?\n/).filter(Boolean).sort();
const actual=lines(git('diff-tree','--no-commit-id','--name-only','-r',revision)).sort();assert.deepEqual(actual,expected);assert.ok(actual.every(name=>name===indexPath||indexed.has(name)));
const acceptance=JSON.parse(git('show',revision+':'+base+'/f09-acceptance-01.json').toString('utf8'));
assert.equal(acceptance.status,'PASS');assert.equal(acceptance.feature,'F09');assert.equal(lines(git('rev-parse',revision+'^'))[0],acceptance.parent);
assert.equal(acceptance.artifact.sha256,expectedArtifact);const artifactFile=inside(repo,acceptance.artifact.path);assert.equal(hash(artifactFile),expectedArtifact);assert.equal(fs.statSync(artifactFile).size,acceptance.artifact.bytes);
for(const input of acceptance.inputs){const file=inside(repo,input.path);assert.equal(hash(file),input.sha256);assert.equal(fs.statSync(file).size,input.bytes);}
const queueFile=inside(repo,'docs/soterai-lite/FEATURE-QUEUE.json'),queue=read(queueFile),ledgerFile=inside(repo,'docs/soterai-lite/ledger.md');
assert.equal(queue.activeFeature,'F09');const current=queue.features.find(row=>row.id==='F09'),next=queue.features.find(row=>row.id==='F10');assert.ok(current&&next);assert.equal(current.status,'ACTIVE');
let ledger=bytes(ledgerFile).toString('utf8');
const before='F01-F08 DONE; F09 ACTIVE/test-first';assert.ok(ledger.includes(before));ledger=ledger.replace(before,'F01-F09 DONE; F10 ACTIVE/test-first');
ledger=ledger.replace('F10-F32 and L2-L7','F11-F32 and L2-L7');
const oldState='P00-P03 and F01-F08 scoped commits are complete. F09 is the sole active behavior card; production waits for its frozen design and failing regression baseline. No F10 production may start yet.';
assert.ok(ledger.includes(oldState));ledger=ledger.replace(oldState,'P00-P03 and F01-F09 scoped commits are complete. F10 is the sole active behavior card; production waits for its frozen design and failing regression baseline. No F11 production may start yet.');
const outputs=['f09-committed-byte-verification-01.json','f09-transition-index-01.json','f09-transition-allowlist-01.txt'];noOutputs(outputs);
write('f09-committed-byte-verification-01.json',{status:'PASS',revision,indexedEntries:index.entries.length,committedPaths:actual.length,mismatches:[],unexpectedPaths:0,artifact:{path:acceptance.artifact.path,sha256:hash(artifactFile),recheck:'PASS'}});
Object.assign(current,{status:'DONE',result:'PASS',sourceEvidenceCommit:revision,acceptanceEvidence:base+'/f09-acceptance-01.json',commitByteVerification:base+'/f09-committed-byte-verification-01.json'});
Object.assign(next,{status:'ACTIVE',result:'NOT-RUN'});queue.activeFeature='F10';queue.scope='F01-F09 DONE with exact scoped artifacts, current native/affected hosts and byte-verified source commits; F10 alone active, test-first managed PowerShell 5.1 integration.';
fs.writeFileSync(queueFile,JSON.stringify(queue,null,2)+'\n');
ledger+='\n## STEP RECEIPT F09-COMMIT / F10-ACTIVATE\n\nF09 source commit '+revision+' verified: '+index.entries.length+' indexed byte hashes, '+actual.length+' exact changed paths, zero mismatches/unexpected paths; exact artifact freshly rechecked '+expectedArtifact+'. Native12PASS/functional10PASS/security17 unchanged are the retained scoped LOW facts, not independent certification. Selected app code can inspect/transmit values; no source debugger, OS confinement or arbitrary shell/gateway claim. Catalog44UNVERIFIED/ratingPENDING. F10 alone is now active after this source barrier; preserve the separate transition byte-verification gate before further production.\n';
fs.writeFileSync(ledgerFile,ledger);
const transitionPaths=['docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/ledger.md',base+'/verify-and-advance.cjs',base+'/'+sourceLogName,base+'/f09-commit-allowlist-01.txt',base+'/f09-committed-byte-verification-01.json'];
write('f09-transition-index-01.json',{status:'PASS',sourceRevision:revision,artifactSha256:expectedArtifact,entries:transitionPaths.map(name=>fileFact(inside(repo,name)))});
const changed=new Set([...lines(git('diff','--name-only','HEAD','--',...transitionPaths)),...lines(git('ls-files','--others','--exclude-standard','--',...transitionPaths))]);
const transitionAllow=[...transitionPaths.filter(name=>changed.has(name)),base+'/f09-transition-index-01.json'].sort();
fs.writeFileSync(own('f09-transition-allowlist-01.txt'),transitionAllow.join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS_SOURCE_BYTES_PENDING_TRANSITION_COMMIT',revision,indexedEntries:index.entries.length,committedPaths:actual.length,next:'F10 alone',transitionIndexed:transitionPaths.length,transitionChanged:transitionAllow.length}));