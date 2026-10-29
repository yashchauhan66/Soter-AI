'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n);
const git='C:\\Program Files\\Git\\cmd\\git.exe',hooks=own('empty-direct-checkpoint-hooks-02');
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
 const p=read(own('progress-09.json'));assert.equal(p.status,'NATIVE07_ACTUAL6PASS1FAIL23NOT_RUN_EXTRA08_TESTED_PROPOSAL_UNAPPROVED');assert.deepEqual(p.native07.primaryCounts,{passed:6,failed:1,notRun:23});assert.equal(p.native07.declaredChildCount,16);assert(p.native07.allDeclaredChildrenClosedAndBothEOF);assert.equal(p.normalImprovementRoundsConsumed,3);assert.equal(p.native08,'NOT_AUTHORIZED_NOT_RUN');assert.equal(p.full.pass,4746);assert.equal(p.full.fail,0);assert.equal(p.f26aNative09,'USER_DEFERRED_NOT_RUN');assert.equal(p.configuredGitPush,'NOT_AUTHORIZED_NOT_RUN');
 for(const row of [p.proposal08,p.proposalReview,p.binding08,p.correctedDriver,p.readOnlyPreapproval,p.native07.primaryResult,p.native07.codeClose,p.native07.outerClose,p.native07.followupAbsenceAndStability,p.affected.preparation,p.affected.expectedRefusal]){const b=fs.readFileSync(ordinary(row.path));assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);}
 for(const n of ['native-direct-fix-static-05','native-direct-client-after-05','native-direct-driver-build-05','native-direct-proposal-08','native-preapproval-08','native-direct-progress-09']){const r=read(own(n+'.txt.result.json'));assert.equal(r.exitCode,0);assert.equal(sha(fs.readFileSync(own(n+'.txt'))),r.sha256.toLowerCase());}
 for(const n of ['native-launch-candidate-14.ps1','native-launch-materialization-08.json','native-launch-consumption-08.json','native-component-acceptance-01.json'])assert(!fs.existsSync(own(n)));
 const source=read(own('full-inputs-03.json'));assert.equal(source.files.length,1070);for(const row of source.files){const b=fs.readFileSync(ordinary(row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);}
 const b=fs.readFileSync(ordinary(p.vsix.output.replaceAll('\\','/')));assert.equal(b.length,p.vsix.bytes);assert.equal(sha(b),p.vsix.sha256);assert(!fs.existsSync(hooks)||fs.readdirSync(hooks).length===0);return p;
}

const [mode,expectedHash]=process.argv.slice(2);assert(['--prepare','--commit'].includes(mode));
const progress=preflight();assert.equal(names(['diff','--cached','--name-only','-z']).length,0,'Unknown staged changes must remain untouched.');
const manifest='f26b-direct-preparation-manifest-02.json',proof='f26b-direct-preparation-byte-proof-02.json',body='f26b-direct-preparation-body-02.txt';
const parentExpected='7fa3734cb8e865f631182edae057285f1ade0a8a';
if(mode==='--prepare'){
  assert(!expectedHash&&!fs.existsSync(own(manifest)));assert.equal(text(['rev-parse','HEAD']),parentExpected);
  fs.writeFileSync(own(body),"docs(lite): retain F26b native failures and direct CLI fixture fix\n\nRetain actual native05 metadata failure, native06 workspace-write refusal and native07 six passing checks/direct worker failure, natural closure and exact follow-up absence/stable streams. Correct only demonstrated fixture expectations with before/after components, strict source/build evidence and unchanged source1070/VSIX. Prepare explicit unapproved one-extra native08 proposal; candidate launcher remains text-only and required affected hosts are blocked by missing native acceptance. Preserve actual production/unrelated changes unstaged, F26a native09 deferral and no Git push authority.\n",{flag:'wx'});
  const content=read(own('content-inspection-03.json'));
  const scope=[...new Set([...walk(__dirname),'docs/soterai-lite/ledger.md','docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/NEXT-CHAT-HANDOFF-20261029-F26B.md','docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/native09-user-decision-01.json',content.vsix.output.replaceAll('\\','/'),content.buildReceipt])].sort();
  const tree=new Map(names(['ls-tree','-r','-z','HEAD']).map(line=>{const match=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(line);assert(match);return[match[3],{mode:match[1],oid:match[2]}];}));
  const files=scope.map(fact).filter(row=>tree.get(row.path)?.oid!==row.oid||tree.get(row.path)?.mode!==row.mode);
  assert(files.length>0);
  const record={status:'PREPARED_SCOPED_RAW_BYTE_EVIDENCE_CHECKPOINT_NOT_COMMITTED',feature:'F26b',parent:parentExpected,branch:text(['symbolic-ref','--short','HEAD']),progressSha256:sha(fs.readFileSync(own('progress-09.json'))),body,files,scope:'Current F26b native05/06/07 actual failures/closure and fixture corrections, requested official Code update completion, exact source/artifact/driver/metadata evidence and tested unapproved Proposal08; selected metadata only. No actual production/test sources or unrelated work staged. Feature ACTIVE/INCOMPLETE, extra08 not authorized; F26a09 deferred and no push.'};
  fs.writeFileSync(own(manifest),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:record.status,files:files.length+1,manifestSha256:sha(fs.readFileSync(own(manifest)))}));
}else{
  assert.match(expectedHash,/^[a-f0-9]{64}$/);assert.equal(sha(fs.readFileSync(own(manifest))),expectedHash);assert(!fs.existsSync(own(proof)));
  const m=read(own(manifest));assert.equal(text(['rev-parse','HEAD']),m.parent);assert.equal(text(['symbolic-ref','--short','HEAD']),m.branch);assert.equal(sha(fs.readFileSync(own('progress-09.json'))),m.progressSha256);
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
  const result={status:'PASS_EXACT_LOCAL_F26B_NATIVE_FAILURE_DIRECT_FIXTURE_PREPARATION_BYTES',observedAt:new Date().toISOString(),feature:'F26b',commit,parent:m.parent,fileCount:files.length,mismatches:0,unexpectedPaths:0,indexEmpty:true,featureState:'ACTIVE_INCOMPLETE',configuredGitPush:'NOT_AUTHORIZED_NOT_RUN',f26aNative09:'USER_DEFERRED_NOT_RUN',files,scope:m.scope};
  fs.writeFileSync(own(proof),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:result.status,commit,paths:files.length,mismatches:0,indexEmpty:true,proofSha256:sha(fs.readFileSync(own(proof)))}));
}
