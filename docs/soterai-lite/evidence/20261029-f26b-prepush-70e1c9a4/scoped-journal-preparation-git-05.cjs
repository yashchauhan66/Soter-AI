'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n);
const git='C:\\Program Files\\Git\\cmd\\git.exe',hooks=own('empty-journal-checkpoint-hooks-05');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const oid=b=>crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^GIT_/i.test(k)));
Object.assign(env,{GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never',GIT_OPTIONAL_LOCKS:'0'});
function run(args,input){return cp.execFileSync(git,['--git-dir='+path.join(repo,'.git'),'--work-tree='+repo,'-c','core.hooksPath='+hooks,'-c','core.fsmonitor=false','-c','commit.gpgSign=false',...args],{cwd:repo,env,input,shell:false,windowsHide:true,maxBuffer:64*1024*1024});}
const text=args=>run(args).toString('utf8').trim();
const names=args=>run(args).toString('utf8').split('\0').filter(Boolean);
function ordinary(relative){
  assert(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.includes('\\')&&!relative.split('/').includes('..')&&!/[\r\n\0"]/.test(relative));
  const file=path.resolve(repo,relative);assert(file.startsWith(repo+path.sep));
  for(let current=file;;current=path.dirname(current)){assert(!fs.lstatSync(current).isSymbolicLink());if(current===repo)break;}
  const stat=fs.lstatSync(file);assert(stat.isFile()&&stat.nlink===1);return file;
}
function fact(relative){const b=fs.readFileSync(ordinary(relative));return{path:relative,bytes:b.length,sha256:sha(b),oid:oid(b),mode:'100644'};}
function same(row){assert.deepEqual(fact(row.path),row);}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{assert(!entry.isSymbolicLink());const file=path.join(dir,entry.name);if(entry.isDirectory())return walk(file);assert(entry.isFile());return[path.relative(repo,file).replaceAll('\\','/')];});}
function preflight(){
 assert.equal(sha(fs.readFileSync(git)),'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');assert.equal(text(['rev-parse','--show-object-format']),'sha1');
 const p=read(own('progress-12.json'));assert.equal(p.status,'NATIVE10_PRIMARY30_UNVERIFIED_RESTART6_NOT_RUN_EXTRA_F26B11_DIAGNOSTIC_PROPOSAL_UNAPPROVED');assert.equal(p.native10.primaryCounts,'UNVERIFIED_NO_SUMMARY_DO_NOT_FABRICATE');assert.deepEqual(p.native10.restartCounts,{passed:0,failed:0,notRun:6});assert.equal(p.native10.terminationTrigger,'UNKNOWN_NOT_ATTRIBUTED_TO_PRODUCT_OR_USER');assert.equal(p.native10.historicalGitShDirectClientEOF,'NOT_OBSERVED_NOT_INFERRED_FROM_CURRENT_ABSENCE');assert(p.native10.currentAssociatedProcessesAbsentTwice&&p.native10.historicalChildEOFNotInferred&&p.native10.codeAndOuterBothEOF);assert.deepEqual([p.native10.codeExit,p.native10.outerExit],[0,1]);
 assert.equal(p.normalImprovementRoundsConsumed,3);assert.deepEqual(p.extraApprovalsConsumed,['F26b native08','F26b native09','F26b native10']);assert.equal(p.f26bNative11,'NOT_AUTHORIZED_NOT_MATERIALIZED_NOT_RUN');assert.equal(p.full.pass,4746);assert.equal(p.full.fail,0);assert.equal(p.f26aNative09,'USER_DEFERRED_NOT_RUN');assert.equal(p.configuredGitPush,'NOT_AUTHORIZED_NOT_RUN');assert.equal(p.component.totalPassed,24);assert.equal(p.component.nativeCoverage,false);assert.equal(p.edgeRefresh.version,'157.0.4341.30');assert.equal(p.edgeRefresh.assistantUpdatedOrDownloaded,false);assert.equal(p.edgeRefresh.livePinListsUpdated,2);
 for(const row of [p.proposal11,p.proposalReview,p.binding11,p.diagnosticDriver,p.driverProvenance,p.readOnlyPreapproval,p.native10.reconciliation,p.native10.approval,p.native10.consumption,p.native10.codeClose,p.native10.outerClose,p.native10.currentAbsenceAndStability,p.native10.vendorLogs,p.component.journal.receipt,p.component.http.receipt,p.correction,p.edgeRefresh.actualSignedPins,p.edgeRefresh.toolingInventory]){const b=fs.readFileSync(ordinary(row.path));assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);}
 for(const n of ['native-journal-component-01','native-journal-http-controls-08','native-journal-static-08','native-journal-driver-build-08','native-journal-proposal-11','native-journal-static-11','native-preapproval-11','native-journal-progress-12']){const r=read(own(n+'.txt.result.json'));assert.equal(r.exitCode,0);assert.equal(sha(fs.readFileSync(own(n+'.txt'))),r.sha256.toLowerCase());}
 for(const n of ['native-launch-candidate-17.ps1','native-launch-materialization-11.json','native-launch-consumption-11.json','native11-user-approval-01.json','native-component-acceptance-01.json'])assert(!fs.existsSync(own(n)));
 const source=read(own('full-inputs-03.json'));assert.equal(source.files.length,1070);for(const row of source.files){const b=fs.readFileSync(ordinary(row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);}
 const b=fs.readFileSync(ordinary(p.vsix.output.replaceAll('\\','/')));assert.equal(b.length,p.vsix.bytes);assert.equal(sha(b),p.vsix.sha256);assert(!fs.existsSync(hooks)||fs.readdirSync(hooks).length===0);return p;
}

const [mode,expectedHash]=process.argv.slice(2);assert(['--prepare','--commit'].includes(mode));
const progress=preflight();assert.equal(names(['diff','--cached','--name-only','-z']).length,0,'Unknown staged changes must remain untouched.');
const manifest='f26b-journal-preparation-manifest-05.json',proof='f26b-journal-preparation-byte-proof-05.json',body='f26b-journal-preparation-body-05.txt';
const parentExpected='2ef4f110815762aac81bf489597d81234b7133c3';
if(mode==='--prepare'){
  assert(!expectedHash&&!fs.existsSync(own(manifest)));assert.equal(text(['rev-parse','HEAD']),parentExpected);
  fs.writeFileSync(own(body),"docs(lite): retain F26b native10 diagnostic journal preparation\n\nRetain the consumed native10 primary30 UNVERIFIED and restart6 NOT_RUN, exact isolated vendor logs and two current known-identity/profile absence observations without inferring historical child EOF. Add tested bounded metadata journal controls10 plus actual Node HTTP controls14, strict driver build, explicit signed installed Edge patch pin refresh and unapproved Proposal11 text/current admission. Preserve original36 assertions, source1070/exact VSIX, all actual production/test source and unrelated work unstaged. F26a09 remains deferred, all pushes unauthorized and F26b incomplete.\n",{flag:'wx'});
  const content=read(own('content-inspection-03.json'));
  const scope=[...new Set([...walk(__dirname),'docs/soterai-lite/ledger.md','docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/NEXT-CHAT-HANDOFF-20261029-F26B.md','docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/native09-user-decision-01.json',content.vsix.output.replaceAll('\\','/'),content.buildReceipt])].sort();
  const tree=new Map(names(['ls-tree','-r','-z','HEAD']).map(line=>{const match=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(line);assert(match);return[match[3],{mode:match[1],oid:match[2]}];}));
  const files=scope.map(fact).filter(row=>tree.get(row.path)?.oid!==row.oid||tree.get(row.path)?.mode!==row.mode);
  assert(files.length>0);
  const record={status:'PREPARED_SCOPED_RAW_BYTE_EVIDENCE_CHECKPOINT_NOT_COMMITTED',feature:'F26b',parent:parentExpected,branch:text(['symbolic-ref','--short','HEAD']),progressSha256:sha(fs.readFileSync(own('progress-12.json'))),body,files,scope:'Current F26b consumed native10 primary30 UNVERIFIED/restart6 NOT_RUN, isolated logs/current absence without historical child EOF inference; bounded journal/HTTP24 component controls, strict driver, explicit signed installed Edge patch refresh and unapproved Proposal11/current admission. Evidence and selected metadata only. No production/test source or unrelated work staged. Feature ACTIVE/INCOMPLETE; F26a09 deferred; no push authority'};
  fs.writeFileSync(own(manifest),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:record.status,files:files.length+1,manifestSha256:sha(fs.readFileSync(own(manifest)))}));
}else{
  assert.match(expectedHash,/^[a-f0-9]{64}$/);assert.equal(sha(fs.readFileSync(own(manifest))),expectedHash);assert(!fs.existsSync(own(proof)));
  const m=read(own(manifest));assert.equal(text(['rev-parse','HEAD']),m.parent);assert.equal(text(['symbolic-ref','--short','HEAD']),m.branch);assert.equal(sha(fs.readFileSync(own('progress-12.json'))),m.progressSha256);
  const files=[...m.files,fact(path.relative(repo,own(manifest)).replaceAll('\\','/'))];assert.equal(new Set(files.map(row=>row.path)).size,files.length);files.forEach(same);
  if(!fs.existsSync(hooks))fs.mkdirSync(hooks);
  const written=run(['hash-object','-w','--no-filters','--stdin-paths'],Buffer.from(files.map(row=>JSON.stringify(row.path)).join('\n')+'\n')).toString('utf8').trim().split('\n');assert.deepEqual(written,files.map(row=>row.oid));
  run(['update-index','-z','--index-info'],Buffer.from(files.map(row=>row.mode+' '+row.oid+'\t'+row.path+'\0').join('')));
  const expected=files.map(row=>row.path).sort();assert.deepEqual(names(['diff','--cached','--name-only','-z']).sort(),expected);
  files.forEach(same);preflight();assert.equal(text(['rev-parse','HEAD']),m.parent);
  run(['commit','--file',own(m.body)]);
  const commit=text(['rev-parse','HEAD']);assert.equal(text(['rev-parse',commit+'^']),m.parent);assert.deepEqual(names(['diff-tree','--no-commit-id','--name-only','-r','-z',commit]).sort(),expected);
  const batch=run(['cat-file','--batch'],Buffer.from(files.map(row=>commit+':'+row.path).join('\n')+'\n'));let offset=0;
  for(const row of files){const end=batch.indexOf(10,offset);assert(end>offset);const header=batch.subarray(offset,end).toString('utf8').split(' ');assert.equal(header[0],row.oid);assert.equal(header[1],'blob');assert.equal(Number(header[2]),row.bytes);const raw=batch.subarray(end+1,end+1+row.bytes);assert.equal(sha(raw),row.sha256);assert.equal(oid(raw),row.oid);assert.equal(batch[end+1+row.bytes],10);offset=end+2+row.bytes;same(row);}
  assert.equal(offset,batch.length);assert.equal(names(['diff','--cached','--name-only','-z']).length,0);
  const result={status:'PASS_EXACT_LOCAL_F26B_NATIVE10_UNVERIFIED_JOURNAL_PROPOSAL11_PREPARATION_BYTES',observedAt:new Date().toISOString(),feature:'F26b',commit,parent:m.parent,fileCount:files.length,mismatches:0,unexpectedPaths:0,indexEmpty:true,featureState:'ACTIVE_INCOMPLETE',configuredGitPush:'NOT_AUTHORIZED_NOT_RUN',f26aNative09:'USER_DEFERRED_NOT_RUN',files,scope:m.scope};
  fs.writeFileSync(own(proof),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:result.status,commit,paths:files.length,mismatches:0,indexEmpty:true,proofSha256:sha(fs.readFileSync(own(proof)))}));
}
