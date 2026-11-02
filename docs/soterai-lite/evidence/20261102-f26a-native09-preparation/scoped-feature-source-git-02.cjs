'use strict';
// TEXT-ONLY successor for the ONE explicitly approved native10 attempt.
// Native10 was running when authored; no result or feature completion is inferred.
// Root must review and invoke only after authentic native34/offline acceptance.
// No manifest, Git, host or verification operation was run by this author.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=name=>path.join(__dirname,name),base=path.relative(repo,__dirname).replaceAll('\\','/');
const git='C:\\Program Files\\Git\\cmd\\git.exe',hooks=own('empty-f26a-feature-source-hooks-02');
const parentExpected='5f5df0b365331c5426af64c4da29ef7127b3f41e';
const sourcePaths=Object.freeze(['packages/vscode-extension/src/history-hooks/PreCommitController.ts','packages/vscode-extension/src/__tests__/preCommitStorageUri.review.test.ts','packages/vscode-extension/src/__tests__/protectionCenter.model.test.ts']);
const selectedMetadata=Object.freeze(['docs/soterai-lite/ledger.md','docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/NEXT-CHAT-HANDOFF-20261102-F26A.md']);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const oid=bytes=>crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^GIT_/i.test(key)));
Object.assign(env,{GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never',GIT_OPTIONAL_LOCKS:'0'});
function run(args,input){return cp.execFileSync(git,['--git-dir='+path.join(repo,'.git'),'--work-tree='+repo,'-c','core.hooksPath='+hooks,'-c','core.fsmonitor=false','-c','commit.gpgSign=false','-c','gc.auto=0','-c','maintenance.auto=false',...args],{cwd:repo,env,input,shell:false,windowsHide:true,maxBuffer:64*1024*1024});}
const text=args=>run(args).toString('utf8').trim(),names=args=>run(args).toString('utf8').split('\0').filter(Boolean);
function ordinary(relative){
 assert(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.includes('\\')&&!/[\x00-\x1f\x7f":]/.test(relative));assert(relative.split('/').every(part=>part&&part!=='.'&&part!=='..'));
 const file=path.resolve(repo,relative);assert(file.startsWith(repo+path.sep));
 for(let current=file;;current=path.dirname(current)){assert(!fs.lstatSync(current).isSymbolicLink());if(current===repo)break;}
 const stat=fs.lstatSync(file);assert(stat.isFile()&&stat.nlink===1);return file;
}
function fact(relative){const bytes=fs.readFileSync(ordinary(relative));return{path:relative,bytes:bytes.length,sha256:sha(bytes),oid:oid(bytes),mode:'100644'};}
function same(row){assert.deepEqual(fact(row.path),row);}
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{assert(!entry.isSymbolicLink());const file=path.join(directory,entry.name);if(entry.isDirectory())return walk(file);assert(entry.isFile());return[path.relative(repo,file).replaceAll('\\','/')];});}
function admitted(relative){return sourcePaths.includes(relative)||selectedMetadata.includes(relative)||relative.startsWith(base+'/');}
function sameFrozen(row,frozen){assert(frozen,row.path);for(const key of ['path','bytes','sha256'])assert.equal(row[key],frozen[key],row.path+':'+key);}
function canonical(name){const file=own(name+'.txt'),receipt=read(file+'.result.json');assert.equal(receipt.exitCode,0,name);assert.equal(path.resolve(receipt.output),path.resolve(file),name);assert.equal(sha(fs.readFileSync(file)),receipt.sha256.toLowerCase(),name);return receipt;}
function assertStaged(files){
 const expected=files.map(row=>row.path).sort();assert.deepEqual(names(['diff','--cached','--name-only','-z']).sort(),expected,'Only manifest paths may be staged.');
 const stages=new Map();for(const row of names(['ls-files','--stage','-z'])){const match=/^(\d+) ([a-f0-9]{40}) (\d)\t(.+)$/.exec(row);assert(match);if(!expected.includes(match[4]))continue;assert.equal(match[3],'0');assert(!stages.has(match[4]));stages.set(match[4],{mode:match[1],oid:match[2]});}
 for(const row of files)assert.deepEqual(stages.get(row.path),{mode:row.mode,oid:row.oid},row.path);
}
async function preflight(){
 assert.equal(sha(fs.readFileSync(git)),'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');assert.equal(text(['rev-parse','--show-object-format']),'sha1');assert(!fs.existsSync(hooks)||fs.readdirSync(hooks).length===0);
 const C=require('./native09-current-admission-01.cjs'),binding=C.guard();assert.equal(binding.fileCount,1076);assert.equal(binding.nativeOracles.primary,30);assert.equal(binding.nativeOracles.restart,4);assert.equal(binding.nativeOracles.total,34);
 const accepted=read(own('acceptance-01.json')),revalidated=require('./finalize-feature-acceptance-02.cjs').verify();assert.deepEqual({...revalidated,observedAt:accepted.observedAt},accepted);
 assert.equal(accepted.status,'PASS_SCOPED_F26A_GATES_SOURCE_TRANSITION_PENDING');assert.equal(accepted.feature,'F26a');assert.equal(accepted.sourceCount,1076);assert.equal(accepted.nativeChecks,34);assert.equal(accepted.primaryChecks,30);assert.equal(accepted.restartChecks,4);assert.equal(accepted.releaseReady,false);assert.equal(accepted.configuredGitPush,'NO_REMAINING_AUTHORITY_NOT_RUN');
 assert.deepEqual(accepted.sourceProof,binding.sourceProof);assert.deepEqual(accepted.vsix,binding.vsix);assert.equal(accepted.sourceScope.length,3);assert.deepEqual(accepted.sourceScope.map(row=>row.path).sort(),[...sourcePaths].sort());
 const sourceProof=read(C.relativeFile(binding.sourceProof.path));assert.equal(sourceProof.fileCount,1076);assert.equal(sourceProof.files.length,1076);
 for(const row of accepted.sourceScope){sameFrozen(row,binding.facts.find(input=>input.path===row.path));sameFrozen(row,sourceProof.files.find(input=>input.path===row.path));sameFrozen(fact(row.path),row);}
 assert.equal(accepted.fullAndAffected.mode,'REUSED_CURRENT_EXACT_OBJECT_REVALIDATED_BYTES_NO_NATIVE_RERUN');
 const reused=accepted.fullAndAffected;assert.equal(reused.acceptance.sha256,'3a598a322e6ad742faa47ac8f076505b28e02c0ff90665cbe8bc8ea59026c2b2');assert.equal(reused.affected.sha256,'dd9eb811d709c6db28aef1cb0b2a145f40b6c1087e4734ca6f84b911de3ce2f5');C.pin(reused.acceptance);C.pin(reused.affected);sameFrozen(reused.acceptance,binding.f28ByteBarriers.acceptance);
 for(const [key,value]of Object.entries({affectedFamilies:20,affectedChecks:509,affectedPhases:37,functionalChecks:10,securityCompared:17}))assert.equal(reused[key],value,key);
 C.pin(accepted.nativeAcceptance);assert.equal(C.relativeFile(accepted.nativeAcceptance.path),own('native10-acceptance-01.json'));
 const native=read(own('native10-acceptance-01.json')),observed=require('./verify-native10-result-01.cjs').verify(native.runName);assert.deepEqual({...observed,observedAt:native.observedAt},native);assert.equal(native.status,'PASS_SCOPED_CURRENT_F26A_NATIVE34_OFFLINE_WITHDRAWAL');assert.deepEqual(native.checks,{primary:30,restart:4,total:34,failed:0,notRun:0});assert.deepEqual(native.vsix,binding.vsix);assert.deepEqual(native.sourceProof,binding.sourceProof);assert.equal(native.signalsRequested,0);
 const chain=read(own('native10-chain-result-01.json'));assert.equal(chain.status,'APPROVED_NATIVE10_WRAPPER_CLOSED_PASS_ROOT_AGGREGATION_PENDING');assert.equal(chain.wrapperExit,0);assert.equal(chain.innerExit,0);assert.equal(chain.actualClose,true);assert.equal(chain.signal,null);assert.equal(chain.stdoutEOF,true);assert.equal(chain.stderrEOF,true);assert.equal(chain.deadlineExceeded,false);assert.equal(chain.signalsRequested,0);assert.equal(chain.vsixSha256,binding.vsix.sha256);
 const approval=read(own('native10-user-approval-01.json')),consumed=read(own('native10-consumption-01.json'));assert.equal(approval.status,'EXPLICIT_USER_AUTHORIZATION_ONE_F26A_NATIVE10');assert.equal(approval.replyId,'call_0d76e0002c6c4bc684183d1ee61ff5a0');assert.equal(approval.allowedAttempts,1);assert.equal(approval.checkpoint,parentExpected);assert.equal(approval.checkpointProof.sha256,'b9ab6598de997a122fe552697adab9e528f7933c3b88efb08391f74dc9d59198');C.pin(approval.checkpointProof);
 assert.equal(consumed.status,'SINGLE_APPROVED_F26A_NATIVE10_CONSUMED_NO_AUTO_RETRY');assert.equal(consumed.signalsRequested,0);assert.equal(consumed.approvalSha256,sha(fs.readFileSync(own('native10-user-approval-01.json'))));assert.equal(consumed.candidateSha256,approval.candidateSha256);assert.equal(consumed.proposalSha256,approval.proposalSha256);assert.equal(consumed.candidateSha256,sha(fs.readFileSync(own('run-precommit-native10-current-01.ps1'))));assert.equal(consumed.proposalSha256,sha(fs.readFileSync(own('NATIVE10-CURRENT-JSON-PINS-PROPOSAL01.md'))));assert.deepEqual(fs.readdirSync(__dirname).filter(name=>/^native10-consumption-\d+\.json$/.test(name)),['native10-consumption-01.json']);
 canonical('native10-run-01');canonical('feature-acceptance-01');
 return accepted;
}
(async()=>{
 const [mode,expectedHash]=process.argv.slice(2);assert(['--prepare','--commit'].includes(mode));
 // This empty-index precondition belongs only at entry. Post-staging revalidation
 // checks the exact manifest index, never an incorrectly repeated empty-index rule.
 const progress=await preflight();assert.equal(names(['diff','--cached','--name-only','-z']).length,0,'Unknown staged changes remain untouched.');
 const manifest='f26a-source-manifest-02.json',proof='f26a-source-byte-proof-02.json',body='f26a-source-body-02.txt';
 if(mode==='--prepare'){
  assert(!expectedHash&&!fs.existsSync(own(manifest))&&!fs.existsSync(own(body))&&!fs.existsSync(own(proof)));assert.equal(text(['rev-parse','HEAD']),parentExpected);
  fs.writeFileSync(own(body),'feat(lite): validate pre-commit storage URI custody\n\nScope exactly three frozen F26a production/review-test paths plus current native10 evidence and selected ledger/queue/November2 handoff. Reuse byte-current F28 full4780 zeroFAIL and affected509/37/functional10/security17 baseline; separate current approved F26a primary30/restart4/offline-owner refusal and natural closure must actually pass before this helper admits a commit. Preserve all failed and deferred attempts, historical closure gaps, four privileged symlink skips, baseline8blocked9leaks, cooperative-route limits and unknown hook edits. No release readiness, push, publish, rating or parentF26 completion. Separate scoped DONE transition/raw-byte proof remains required.\n',{flag:'wx'});
  const scope=[...new Set([...sourcePaths,...walk(__dirname),...selectedMetadata])].sort();assert(scope.every(admitted));
  const tree=new Map(names(['ls-tree','-r','-z','HEAD']).map(row=>{const match=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(row);assert(match);return[match[3],{mode:match[1],oid:match[2]}];}));
  const files=scope.map(fact).filter(row=>tree.get(row.path)?.oid!==row.oid||tree.get(row.path)?.mode!==row.mode);assert(files.length>0);assert.equal(files.filter(row=>sourcePaths.includes(row.path)).length,3);
  const record={status:'PREPARED_SCOPED_F26A_SOURCE3_AND_CURRENT_EVIDENCE_NOT_COMMITTED',feature:'F26a',parent:parentExpected,branch:text(['symbolic-ref','--short','HEAD']),progressSha256:sha(fs.readFileSync(own('acceptance-01.json'))),bindingSha256:sha(fs.readFileSync(own('native10-current-binding-01.json'))),nativeAcceptanceSha256:sha(fs.readFileSync(own('native10-acceptance-01.json'))),body,sourceCount:1076,sourcePaths:[...sourcePaths],files,scope:'Exactly three frozen F26a production/review-test paths, all current F26a native10 preparation/evidence files and selected ledger/queue/November2 handoff. Native34/offline/withdrawal acceptance must pass; current F28 full/affected results are reused only by exact bytes. All failures retained. Unrelated work and sibling release-readiness directory excluded. No push/publish/rating/release-ready/parentF26 completion; separate DONE transition bytes pending.'};
  fs.writeFileSync(own(manifest),JSON.stringify(record,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:record.status,files:files.length+1,sourcePaths:3,manifestSha256:sha(fs.readFileSync(own(manifest)))}));
 }else{
  assert.match(expectedHash,/^[a-f0-9]{64}$/);assert.equal(sha(fs.readFileSync(own(manifest))),expectedHash);assert(!fs.existsSync(own(proof)));
  const m=read(own(manifest));assert.equal(m.status,'PREPARED_SCOPED_F26A_SOURCE3_AND_CURRENT_EVIDENCE_NOT_COMMITTED');assert.equal(m.feature,'F26a');assert.equal(m.parent,parentExpected);assert.deepEqual(m.sourcePaths,[...sourcePaths]);assert.equal(text(['rev-parse','HEAD']),m.parent);assert.equal(text(['symbolic-ref','--short','HEAD']),m.branch);assert.equal(sha(fs.readFileSync(own('acceptance-01.json'))),m.progressSha256);assert.equal(sha(fs.readFileSync(own('native10-current-binding-01.json'))),m.bindingSha256);assert.equal(sha(fs.readFileSync(own('native10-acceptance-01.json'))),m.nativeAcceptanceSha256);
  const files=[...m.files,fact(path.relative(repo,own(manifest)).replaceAll('\\','/'))];assert.equal(new Set(files.map(row=>row.path)).size,files.length);assert(files.every(row=>admitted(row.path)));files.forEach(same);
  if(!fs.existsSync(hooks))fs.mkdirSync(hooks);
  const written=run(['hash-object','-w','--no-filters','--stdin-paths'],Buffer.from(files.map(row=>JSON.stringify(row.path)).join('\n')+'\n')).toString('utf8').trim().split('\n');assert.deepEqual(written,files.map(row=>row.oid));
  run(['update-index','-z','--index-info'],Buffer.from(files.map(row=>row.mode+' '+row.oid+'\t'+row.path+'\0').join('')));
  assertStaged(files);files.forEach(same);await preflight();assert.equal(text(['rev-parse','HEAD']),m.parent);assert.equal(text(['symbolic-ref','--short','HEAD']),m.branch);assertStaged(files);files.forEach(same);
  run(['commit','--file',own(m.body)]);
  const commit=text(['rev-parse','HEAD']),expected=files.map(row=>row.path).sort();assert.equal(text(['rev-parse',commit+'^']),m.parent);assert.deepEqual(names(['diff-tree','--no-commit-id','--name-only','-r','-z',commit]).sort(),expected);
  const batch=run(['cat-file','--batch'],Buffer.from(files.map(row=>commit+':'+row.path).join('\n')+'\n'));let offset=0;
  for(const row of files){const end=batch.indexOf(10,offset);assert(end>offset);const header=batch.subarray(offset,end).toString('utf8').split(' ');assert.equal(header[0],row.oid);assert.equal(header[1],'blob');assert.equal(Number(header[2]),row.bytes);const raw=batch.subarray(end+1,end+1+row.bytes);assert.equal(sha(raw),row.sha256);assert.equal(oid(raw),row.oid);assert.equal(batch[end+1+row.bytes],10);offset=end+2+row.bytes;same(row);}
  assert.equal(offset,batch.length);assert.equal(names(['diff','--cached','--name-only','-z']).length,0);
  const result={status:'PASS_EXACT_LOCAL_F26A_SOURCE3_AND_EVIDENCE_BYTES_TRANSITION_PENDING',observedAt:new Date().toISOString(),feature:'F26a',commit,parent:m.parent,fileCount:files.length,sourceCount:1076,sourcePaths:3,nativeChecks:34,mismatches:0,unexpectedPaths:0,indexEmpty:true,featureState:'VERIFYING_SCOPED_GATES_PASS_TRANSITION_BYTES_PENDING',configuredGitPush:'NO_REMAINING_AUTHORITY_NOT_RUN',releaseReady:false,rating:'NOT_ISSUED',files,scope:m.scope};
  fs.writeFileSync(own(proof),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,commit,paths:files.length,mismatches:0,indexEmpty:true,proofSha256:sha(fs.readFileSync(own(proof)))}));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
