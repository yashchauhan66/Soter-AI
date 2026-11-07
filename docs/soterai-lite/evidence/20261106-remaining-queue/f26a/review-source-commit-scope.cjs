'use strict';
// Input: git -c core.quotepath=false ls-tree -r HEAD on stdin. Reads only Git
// observations and current files; writes new review packets, never stages.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../../..'), rel=file=>path.relative(repo,file).replaceAll('\\','/');
const read=file=>JSON.parse(fs.readFileSync(path.resolve(repo,file),'utf8').replace(/^\uFEFF/,''));
const hash=(raw,kind='sha256')=>crypto.createHash(kind).update(raw).digest('hex');
const blob=raw=>hash(Buffer.concat([Buffer.from('blob '+raw.length+'\0'),raw]),'sha1');
function fact(file){file=path.resolve(repo,file);const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink());const raw=fs.readFileSync(file);return{path:rel(file),bytes:raw.length,sha256:hash(raw)};}
function pin(row){const current=fact(row.path);assert.equal(current.bytes,row.bytes,row.path);assert.equal(current.sha256,row.sha256,row.path);return current;}
function write(name,data){const file=path.join(__dirname,name);fs.writeFileSync(file,typeof data==='string'?data:JSON.stringify(data,null,2)+'\n',{flag:'wx'});return fact(file);}
const sourcePaths=[
 'packages/soterai-lite/CHANGELOG.md','packages/soterai-lite/README.md','packages/soterai-lite/package.json',
 'packages/soterai-lite/scripts/__tests__/release-package.test.cjs','packages/soterai-lite/scripts/audit-release.cjs',
 'packages/vscode-extension/package.json','packages/vscode-extension/src/__tests__/preCommitCommands.test.ts',
 'packages/vscode-extension/src/history-hooks/PreCommitController.ts','packages/vscode-extension/src/__tests__/preCommitStorageUri.review.test.ts'
].sort();
const proofPath='docs/soterai-lite/evidence/20261106-remaining-queue/candidate-01/full-inputs-02.json',proof=read(proofPath);
assert.equal(fact(proofPath).sha256,'23fd63bb04122bf055f656a77424085b75ff3e3c813121c15034cd209fd1c8f6');
const tree=new Map();for(const line of fs.readFileSync(0,'utf8').split(/\r?\n/)){if(!line)continue;const m=/^(\d+) (\w+) ([a-f0-9]{40})\t(.+)$/.exec(line);assert(m,'Expected git ls-tree text');tree.set(m[4],{mode:m[1],type:m[2],sha1:m[3]});}
assert(tree.size>0);const rows=proof.files.map(row=>{pin(row);const raw=fs.readFileSync(path.resolve(repo,row.path)),head=tree.get(row.path),currentBlobSha1=blob(raw);let comparison='HEAD_RAW_BYTES_EQUAL';if(!head)comparison='ABSENT_FROM_HEAD';else if(head.sha1!==currentBlobSha1){const normalized=Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n'));comparison=blob(normalized)===head.sha1?'ONLY_CRLF_WORKTREE_NORMALIZATION':'CONTENT_DIFFERS_FROM_HEAD';}return{...row,currentBlobSha1,head:head??null,comparison,selected:sourcePaths.includes(row.path)};});
const source=sourcePaths.map(file=>{const row=rows.find(row=>row.path===file);assert(row,'Selected source absent from tested proof');return row;});
const evidence=new Set(),base='docs/soterai-lite/evidence/20261106-remaining-queue';
function add(file){const full=path.resolve(repo,file),name=rel(full);assert(!name.startsWith('../'));assert(!/(^|\/)(?:node_modules|extensions|public-vendor|workspace|profile|dist|dist-test|staging|exact-vsix[^/]*|extracted[^/]*)\//i.test(name),'Bulk runtime/profile excluded: '+name);assert(!/(?:^|\/)(?:\.env(?:\..*)?|auth\.json|credentials(?:\.[^/]*)?|.*\.(?:db|sqlite|pem|key))$/i.test(name),'Private state-shaped path excluded');fact(full);evidence.add(name);}
function top(dir){for(const ent of fs.readdirSync(path.resolve(repo,dir),{withFileTypes:true})){assert(!ent.isSymbolicLink());if(ent.isFile())add(dir+'/'+ent.name);}}
for(const name of ['owner-resumption-01.json','prepare-current-candidate.cjs','run-check.cjs'])add(base+'/'+name);
for(const dir of ['candidate-01','focused-01','focused-02'])top(base+'/'+dir);
for(const ent of fs.readdirSync(__dirname,{withFileTypes:true}))if(ent.isFile()&&!ent.name.startsWith('codex-')&&!ent.name.startsWith('commit-scope-'))add(path.join(__dirname,ent.name));
top(base+'/f26a/native14-owned-run');top(base+'/f26a/f26a-precommit-native-20261106T134427Z-39d7828b');
for(const name of ['f26a-capability-red.txt','f26a-capability-green.txt','f26a-capability-offline-green-02.txt','f26a-command-capability-green.txt'])add(base+'/final/'+name);
const affectedPath='docs/soterai-lite/evidence/20261106-v01-current-01/affected-acceptance.json',affected=read(affectedPath);
assert.equal(affected.status,'PASS_CURRENT_AFFECTED175_FUNCTIONAL10_SECURITY17_BASELINE_ONLY');assert.equal(affected.sourceProof.sha256,fact(proofPath).sha256);assert.equal(affected.vsix.sha256,'011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec');
top(path.posix.dirname(affectedPath));for(const row of affected.evidence){pin(row);if(row.path.startsWith(path.posix.dirname(affectedPath)+'/'))add(row.path);}
for(const family of affected.families)for(const phase of family.phases){pin(phase.result);add(phase.result.path);}
const native=read(base+'/f26a/native14-acceptance.json');assert.equal(native.status,'PASS_CURRENT_FINAL_CANDIDATE_ORIGINAL_NATIVE34');assert.equal(native.sourceProof.sha256,affected.sourceProof.sha256);assert.equal(native.vsix.sha256,affected.vsix.sha256);
const build='packages/soterai-lite/builds/2026-11-06T13-36-02-803Z-e0fb49c7';
for(const name of ['build-provenance.json','extension.js.metafile.json','final-release-inventory.json','local-ai-broker.js.metafile.json','package-receipt.json','package.json','pre-commit-client.js.metafile.json','soterai-mcp-server.js.metafile.json'])add(build+'/'+name);
const sourceAllowlist=write('commit-scope-source-allowlist-01.txt',sourcePaths.join('\n')+'\n');
const evidenceRows=[...evidence].sort().map(fact),evidenceAllowlist=write('commit-scope-evidence-allowlist-01.txt',evidenceRows.map(row=>row.path).join('\n')+'\n');
const other=rows.filter(row=>!row.selected&&row.comparison!=='HEAD_RAW_BYTES_EQUAL');
const report={status:'REVIEWED_ALLOWLIST_ONLY_NOT_STAGED_NOT_COMMITTED_NOT_FEATURE_DONE',observedAt:new Date().toISOString(),sourceProof:fact(proofPath),sourceParent:proof.sourceParent,sourceFilesRehashed:rows.length,selectedSourceFiles:source,sourceAllowlist,evidenceAllowlist,evidenceCount:evidenceRows.length,evidenceBytes:evidenceRows.reduce((sum,row)=>sum+row.bytes,0),evidenceFiles:evidenceRows,artifactRetainSeparately:pin(affected.vsix),acceptedNative14:fact(base+'/f26a/native14-acceptance.json'),acceptedAffected175:fact(affectedPath),otherTestedInputDifferencesExcluded:other,comparisonCounts:rows.reduce((a,row)=>(a[row.comparison]=(a[row.comparison]||0)+1,a),{}),scopeNotes:['Source ownership is the explicit nine-path root assignment; raw CRLF or other tested-input differences never imply staging authority.','List contains stable candidate/native14/affected175/focused receipts, inert predecessor evidence and final build metadata. No bulk extracted extension/vendor/profile/workspace trees or duplicate built VSIX are included.','Canonical exact VSIX is separately identified; root may include that single artifact explicitly.','Mutable queue/ledger/claims/final handoff, F32 lifecycle and pending tool-route receipts require their own reviewed transition/final allowlist after completion.','The tested full source snapshot includes excluded unrelated/normalization differences; this scoped commit alone is not claimed to reproduce every tested byte.','Git staging/commit and raw committed-byte/transition verification have not been performed by this review.']};
const result=write('commit-scope-review-01.json',report);console.log(JSON.stringify({status:report.status,sourceFiles:source.length,proofRows:rows.length,evidenceFiles:evidenceRows.length,evidenceBytes:report.evidenceBytes,comparisonCounts:report.comparisonCounts,otherContentDifferences:other.filter(row=>row.comparison!=='ONLY_CRLF_WORKTREE_NORMALIZATION').map(row=>row.path),sourceAllowlist,evidenceAllowlist,report:result}));
