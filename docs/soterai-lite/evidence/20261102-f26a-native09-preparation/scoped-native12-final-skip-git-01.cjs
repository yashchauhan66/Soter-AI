'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n);
const git='C:\\Program Files\\Git\\cmd\\git.exe',hooks=own('empty-f26a-native12-final-skip-hooks-01');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const oid=b=>crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^GIT_/i.test(k)));
Object.assign(env,{GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never',GIT_OPTIONAL_LOCKS:'0'});
function run(args,input){return cp.execFileSync(git,['--git-dir='+path.join(repo,'.git'),'--work-tree='+repo,'-c','core.hooksPath='+hooks,'-c','core.fsmonitor=false','-c','commit.gpgSign=false','-c','gc.auto=0','-c','maintenance.auto=false',...args],{cwd:repo,env,input,shell:false,windowsHide:true,maxBuffer:64*1024*1024});}
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
async function preflight(){
 assert.equal(sha(fs.readFileSync(git)),'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');assert.equal(text(['rev-parse','--show-object-format']),'sha1');
 const b=read(own('native09-current-binding-01.json'));assert.equal(sha(fs.readFileSync(own('native09-current-binding-01.json'))),'9a6e8cac4f1ef74618565faf9c4bb5c6f71e0f36b2f7c6f755996d685d131616');
 const source=read(path.resolve(repo,b.sourceProof.path));assert.equal(sha(fs.readFileSync(path.resolve(repo,b.sourceProof.path))),b.sourceProof.sha256);assert.equal(source.files.length,1076);
 for(const row of source.files){const raw=fs.readFileSync(ordinary(row.path));assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256,row.path);}
 for(const n of ['native12-materialization-01','native12-postfailure-owners-03','native12-final-skip-01']){const r=read(own(n+'.txt.result.json'));assert.equal(r.exitCode,0,n);assert.equal(sha(fs.readFileSync(own(n+'.txt'))),r.sha256.toLowerCase());}
 const failed=read(own('native12-run-01.txt.result.json'));assert.equal(failed.exitCode,1);assert.equal(sha(fs.readFileSync(own('native12-run-01.txt'))),failed.sha256.toLowerCase());
 const final=read(own('native12-final-reconciliation-01.json'));assert.equal(final.status,'INCOMPLETE_FINAL_NATIVE12_RESULT_MISSING_USER_SKIPPED_NO_RETRY');assert.equal(final.furtherF26aNativeAttemptsAllowed,0);assert.equal(final.native12.totalAcceptedChecks,0);assert.equal(final.featureComplete,false);
 const a=read(own('native12-user-approval-01.json')),c=read(own('native12-consumption-01.json'));assert.equal(a.replyId,'call_3d1ca86cdb034f82a9ea32aa1bc401ab');assert.equal(a.finalAttempt,true);assert.equal(c.approvalSha256,sha(fs.readFileSync(own('native12-user-approval-01.json'))));
 const q=read(path.join(repo,'docs/soterai-lite/FEATURE-QUEUE.json')),f=q.features.find(x=>x.id==='F26'),s=f.subcards.find(x=>x.id==='F26a');assert.notEqual(f.status,'DONE');assert.notEqual(s.status,'DONE');assert.equal(s.supported,false);assert.equal(s.executionState,'USER_SKIPPED_FINAL_ATTEMPT_EXHAUSTED');assert.equal(q.activeSubcard,'F31b');assert.equal(q.supportedExecutionExclusions.F26a.countsAsDone,false);
 assert(!fs.existsSync(own('native12-acceptance-01.json')));assert(!fs.existsSync(own('acceptance-01.json')));assert(!fs.readdirSync(__dirname).some(n=>/native13/.test(n)));
 return{...b,sourceScope:[]};
}
function checkpointFile(relative){return true;}

(async()=>{
const [mode,expectedHash]=process.argv.slice(2);assert(['--prepare','--commit'].includes(mode));
const progress=await preflight();assert.equal(names(['diff','--cached','--name-only','-z']).length,0,'Unknown staged changes must remain untouched.');
const manifest='f26a-native12-final-skip-manifest-01.json',proof='f26a-native12-final-skip-byte-proof-01.json',body='f26a-native12-final-skip-body-01.txt';
const parentExpected='5901a05b6b040334ad9c3e83c9ba474df35be3a6';
if(mode==='--prepare'){
  assert(!expectedHash&&!fs.existsSync(own(manifest)));assert.equal(text(['rev-parse','HEAD']),parentExpected);
  fs.writeFileSync(own(body),"docs(lite): retain final F26a failure and owner-authorized skip\n\nFinal native12 exactly once: missing primary result, offline/restart not run, Code0/wrapper1/bothEOF/no deadlines or signals. Owner explicitly ordered last attempt then skip/delete if incomplete; reversible skip selected, source and failures retained. F26a and parentF26 remain incomplete/unsupported, no further native runs. F31b supported-scope selection preserves original unmet F26 requirement and requires honest pre-commit exclusions. Evidence/documentation only; production3/unrelated work preserved. No release-ready/push/publish/rating or originalL6 bypass.\n",{flag:'wx'});
  const content=read(path.resolve(__dirname,'../20261101-f28-reliability-9a4c2e71/content-inspection-02.json'));
  const scope=[...new Set([...progress.sourceScope.map(row=>row.path),...walk(__dirname).filter(checkpointFile),'docs/soterai-lite/ledger.md','docs/soterai-lite/IMPLEMENTATION-PLAN.md','docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/NEXT-CHAT-HANDOFF-20261101-F28.md','docs/soterai-lite/NEXT-CHAT-HANDOFF-20261102-F26A.md','docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/f28-transition-byte-proof-01.json','docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/transition-commit-01.txt','docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/transition-commit-01.txt.result.json','docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/transition-barrier-01.json','docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/record-transition-bytes-01.cjs','docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/native09-user-decision-01.json',content.vsix.output.replaceAll('\\','/'),content.buildReceipt])].sort();
  const tree=new Map(names(['ls-tree','-r','-z','HEAD']).map(line=>{const match=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(line);assert(match);return[match[3],{mode:match[1],oid:match[2]}];}));
  const files=scope.map(fact).filter(row=>tree.get(row.path)?.oid!==row.oid||tree.get(row.path)?.mode!==row.mode);
  assert(files.length>0);
  const record={status:'PREPARED_FINAL_F26A_USER_SKIP_AND_F31B_SELECTION_NOT_COMMITTED',feature:'F26a',parent:parentExpected,branch:text(['symbolic-ref','--short','HEAD']),progressSha256:sha(fs.readFileSync(own('native09-current-binding-01.json'))),body,files,scope:"Final native12 failure and explicit owner reversible skip; F26a/parentF26 incomplete/unsupported, zero further F26a runs, original requirements and failures retained. Current1076 bytes checked; evidence/plan/queue/ledger/handoff only, production3 and unrelated/release-readiness changes excluded. F31b selected after exact byte barrier; no release-ready/push/publish/rating or originalL6 bypass."};
  fs.writeFileSync(own(manifest),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:record.status,files:files.length+1,manifestSha256:sha(fs.readFileSync(own(manifest)))}));
}else{
  assert.match(expectedHash,/^[a-f0-9]{64}$/);assert.equal(sha(fs.readFileSync(own(manifest))),expectedHash);assert(!fs.existsSync(own(proof)));
  const m=read(own(manifest));assert.equal(text(['rev-parse','HEAD']),m.parent);assert.equal(text(['symbolic-ref','--short','HEAD']),m.branch);assert.equal(sha(fs.readFileSync(own('native09-current-binding-01.json'))),m.progressSha256);
  const files=[...m.files,fact(path.relative(repo,own(manifest)).replaceAll('\\','/'))];assert.equal(new Set(files.map(row=>row.path)).size,files.length);files.forEach(same);
  if(!fs.existsSync(hooks))fs.mkdirSync(hooks);
  const written=run(['hash-object','-w','--no-filters','--stdin-paths'],Buffer.from(files.map(row=>JSON.stringify(row.path)).join('\n')+'\n')).toString('utf8').trim().split('\n');assert.deepEqual(written,files.map(row=>row.oid));
  run(['update-index','-z','--index-info'],Buffer.from(files.map(row=>row.mode+' '+row.oid+'\t'+row.path+'\0').join('')));
  const expected=files.map(row=>row.path).sort();assert.deepEqual(names(['diff','--cached','--name-only','-z']).sort(),expected);
  files.forEach(same);await preflight();assert.equal(text(['rev-parse','HEAD']),m.parent);
  run(['commit','--file',own(m.body)]);
  const commit=text(['rev-parse','HEAD']);assert.equal(text(['rev-parse',commit+'^']),m.parent);assert.deepEqual(names(['diff-tree','--no-commit-id','--name-only','-r','-z',commit]).sort(),expected);
  const batch=run(['cat-file','--batch'],Buffer.from(files.map(row=>commit+':'+row.path).join('\n')+'\n'));let offset=0;
  for(const row of files){const end=batch.indexOf(10,offset);assert(end>offset);const header=batch.subarray(offset,end).toString('utf8').split(' ');assert.equal(header[0],row.oid);assert.equal(header[1],'blob');assert.equal(Number(header[2]),row.bytes);const raw=batch.subarray(end+1,end+1+row.bytes);assert.equal(sha(raw),row.sha256);assert.equal(oid(raw),row.oid);assert.equal(batch[end+1+row.bytes],10);offset=end+2+row.bytes;same(row);}
  assert.equal(offset,batch.length);assert.equal(names(['diff','--cached','--name-only','-z']).length,0);
  const result={status:'PASS_EXACT_LOCAL_F26A_FINAL_USER_SKIP_AND_F31B_SELECTION_BYTES',observedAt:new Date().toISOString(),feature:'F26a',commit,parent:m.parent,fileCount:files.length,mismatches:0,unexpectedPaths:0,indexEmpty:true,featureState:'USER_SKIPPED_INCOMPLETE_NO_FURTHER_RUNS_F31B_SELECTED',configuredGitPush:'NO_REMAINING_AUTHORITY_NOT_RUN',f26aNative09:'CONSUMED_ONCE_FAILED_BEFORE_DRIVER_NO_RETRY',files,scope:m.scope};
  fs.writeFileSync(own(proof),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:result.status,commit,paths:files.length,mismatches:0,indexEmpty:true,proofSha256:sha(fs.readFileSync(own(proof)))}));
}

})().catch(error=>{console.error(error);process.exitCode=1;});
