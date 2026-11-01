'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n);
const git='C:\\Program Files\\Git\\cmd\\git.exe',hooks=own('empty-f28-preparation-hooks-01');
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
async function preflight(){
 assert.equal(sha(fs.readFileSync(git)),'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');assert.equal(text(['rev-parse','--show-object-format']),'sha1');
 const current=require('./current-native-admission-02.cjs').current(),p=read(own('progress-03.json'));assert.equal(p.status,'F28_CURRENT_FULL4780_ZERO_FAILURES_NEW_VSIX_CONTENT26DRIVERS_PASS_NATIVE_NOT_RUN');assert.equal(current.sourceProof.sha256,p.sourceProof.sha256);assert.equal(current.vsix.sha256,p.vsix.sha256);assert.equal(current.full.pass,4776);assert.equal(p.native30.actualLaunches,0);assert.equal(p.f26aNative09,'USER_DEFERRED_NOT_RUN');
 for(const n of ['current-artifact-progress-03','current-source-artifact-admission-02','native-source-typecheck-02','native-lifecycle-after-02','native-driver-build-03']){const r=read(own(n+'.txt.result.json'));assert.equal(r.exitCode,0);assert.equal(sha(fs.readFileSync(own(n+'.txt'))),r.sha256.toLowerCase());}
 for(const n of ['native-binding-01.json','native-materialization-01.json','native-consumption-01.json'])assert(!fs.existsSync(own(n)));
 assert(!fs.existsSync(hooks)||fs.readdirSync(hooks).length===0);return{...p,sourceScope:[]};
}
(async()=>{
const [mode,expectedHash]=process.argv.slice(2);assert(['--prepare','--commit'].includes(mode));
const progress=await preflight();assert.equal(names(['diff','--cached','--name-only','-z']).length,0,'Unknown staged changes must remain untouched.');
const manifest='f28-preparation-manifest-01.json',proof='f28-preparation-byte-proof-01.json',body='f28-preparation-body-01.txt';
const parentExpected='6e3e66ca812a196cf9ca8addf1bc147b6e6a0879';
if(mode==='--prepare'){
  assert(!expectedHash&&!fs.existsSync(own(manifest)));assert.equal(text(['rev-parse','HEAD']),parentExpected);
  fs.writeFileSync(own(body),"docs(lite): retain F28 reader baselines and current artifact gates\n\nRecord current1076 inputs, full4780/4776PASS0FAIL4privilegedsymlinkSKIP and exact new VSIX5dac9288/content15/four runtimes/88 restricted settings. Retain all baseline/full/fixture failures and corrections. Native30 preparation and ownership6 controls/typecheck/current26drivers pass; no native launch/binding/materialization yet. Evidence/artifact checkpoint only: F28 source14, deferred F26a3 and unrelated work remain unstaged. F28 and all native/affected/withdrawal/source/transition gates incomplete. No push, publish or rating.\n",{flag:'wx'});
  const content=read(own('content-inspection-02.json'));
  const scope=[...new Set([...progress.sourceScope.map(row=>row.path),...walk(__dirname),'docs/soterai-lite/ledger.md','docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/NEXT-CHAT-HANDOFF-20261101-F28.md','docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/native09-user-decision-01.json',content.vsix.output.replaceAll('\\','/'),content.buildReceipt])].sort();
  const tree=new Map(names(['ls-tree','-r','-z','HEAD']).map(line=>{const match=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(line);assert(match);return[match[3],{mode:match[1],oid:match[2]}];}));
  const files=scope.map(fact).filter(row=>tree.get(row.path)?.oid!==row.oid||tree.get(row.path)?.mode!==row.mode);
  assert(files.length>0);
  const record={status:'PREPARED_SCOPED_F28_EVIDENCE_CURRENT_ARTIFACT_NOT_COMMITTED',feature:'F28',parent:parentExpected,branch:text(['symbolic-ref','--short','HEAD']),progressSha256:sha(fs.readFileSync(own('progress-03.json'))),body,files,scope:'F28 evidence/artifact/selected metadata only. Current1076/full4776PASS0FAIL4SKIP/exactVSIX5dac/content26drivers and native30 preparation with6 cleanup controls. Native0, all required actual native/affected/withdrawal/source+transition bytes pending. Product14/deferredF26a3/unrelated work preserved unstaged. F26a09 deferred/no push authority/no publish/rating.'};
  fs.writeFileSync(own(manifest),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:record.status,files:files.length+1,manifestSha256:sha(fs.readFileSync(own(manifest)))}));
}else{
  assert.match(expectedHash,/^[a-f0-9]{64}$/);assert.equal(sha(fs.readFileSync(own(manifest))),expectedHash);assert(!fs.existsSync(own(proof)));
  const m=read(own(manifest));assert.equal(text(['rev-parse','HEAD']),m.parent);assert.equal(text(['symbolic-ref','--short','HEAD']),m.branch);assert.equal(sha(fs.readFileSync(own('progress-03.json'))),m.progressSha256);
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
  const result={status:'PASS_EXACT_LOCAL_F28_PREPARATION_EVIDENCE_BYTES_FEATURE_INCOMPLETE',observedAt:new Date().toISOString(),feature:'F28',commit,parent:m.parent,fileCount:files.length,mismatches:0,unexpectedPaths:0,indexEmpty:true,featureState:'ACTIVE_INCOMPLETE_NATIVE_AND_AFFECTED_PENDING',configuredGitPush:'NO_REMAINING_AUTHORITY_NOT_RUN',f26aNative09:'USER_DEFERRED_NOT_RUN',files,scope:m.scope};
  fs.writeFileSync(own(proof),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:result.status,commit,paths:files.length,mismatches:0,indexEmpty:true,proofSha256:sha(fs.readFileSync(own(proof)))}));
}

})().catch(error=>{console.error(error);process.exitCode=1;});
