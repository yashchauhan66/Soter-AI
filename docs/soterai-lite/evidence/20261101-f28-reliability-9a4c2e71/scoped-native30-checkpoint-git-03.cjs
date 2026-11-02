'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n);
const git='C:\\Program Files\\Git\\cmd\\git.exe',hooks=own('empty-f28-native30-hooks-03');
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
 const A=require('./current-native-admission-05.cjs'),C=require('./affected-current-admission-01.cjs'),current=A.current(),p=read(own('progress-04.json'));assert.equal(p.status,'F28_NATIVE30_PASS_CURRENT_AFFECTED_AND_FEATURE_BYTES_PENDING');assert.equal(current.sourceProof.sha256,p.sourceProof.sha256);assert.equal(current.vsix.sha256,p.vsix.sha256);assert.deepEqual(C.component(),p.acceptance);assert.equal(p.native.total,30);assert.equal(p.f26aNative09,'USER_DEFERRED_NOT_RUN');
 for(const n of ['native30-progress-04','native-source-typecheck-04','native-lifecycle-after-04','native-driver-build-05','native-launcher-syntax-06','native-result-components-05','affected-binding-01','affected-admission-01','source-scope-preparation-02']){const r=read(own(n+'.txt.result.json'));assert.equal(r.exitCode,0,n);assert.equal(sha(fs.readFileSync(own(n+'.txt'))),r.sha256.toLowerCase());}
 const outer=read(own('native-03-owned-close.json'));assert(outer.actualClose&&outer.exitCode===0&&outer.signal===null&&outer.stdoutEOF&&outer.stderrEOF&&!outer.deadlineExceeded&&outer.signalsRequested===0);assert(!fs.existsSync(hooks)||fs.readdirSync(hooks).length===0);return{...p,sourceScope:[]};
}
function checkpointFile(relative){
 const local=path.relative(__dirname,path.resolve(repo,relative)).split(path.sep).join('/'),parts=local.split('/');
 if(parts.length>1)return /^(f28-reliability-native-|prebuilt-native-hosts-|vsix-extracted-|owned-output-driver-01$)/.test(parts[0]) || ['f26a-logs-native-20261101T173851Z-e9f2e1a5','f26a-owned-output-native-20261101T174822Z-8569e639'].includes(parts[0]);
 return !/^affected-.*-f28-02/.test(local)&&!/^affected-chain-(result|failure)-02/.test(local);
}

(async()=>{
const [mode,expectedHash]=process.argv.slice(2);assert(['--prepare','--commit'].includes(mode));
const progress=await preflight();assert.equal(names(['diff','--cached','--name-only','-z']).length,0,'Unknown staged changes must remain untouched.');
const manifest='f28-native30-checkpoint-manifest-03.json',proof='f28-native30-checkpoint-byte-proof-03.json',body='f28-native30-checkpoint-body-03.txt';
const parentExpected='a5e7305eeefaf5be108ce1f71603fc99b59ab6c6';
if(mode==='--prepare'){
  assert(!expectedHash&&!fs.existsSync(own(manifest)));assert.equal(text(['rev-parse','HEAD']),parentExpected);
  fs.writeFileSync(own(body),"docs(lite): retain F28 native30 and verified fixture corrections\n\nRecord actual original30 checks PASS with primary/peer/restart natural exit and bothEOF, delayed handles2/2 closed and original flag restored on exact VSIX5dac. Retain native01 canceled/no assertions and native02 10PASS1FAIL and primitive/event-confirmation fixture corrections. Existing full4780 zeroFAIL/source1076/driver26 remain byte exact. Affected original chain logs25PASS/owned-output12PASS7FAIL is closed and retained. Fixture-only8 controls, typecheck/build/admission PASS; third normal round continuation active and not accepted. Exclude its live affected family streams/directories from this evidence-only checkpoint. F28 source14, deferred F26a3 and unrelated work remain unstaged. No feature completion, parentF26 acceptance, push, publish or rating.\n",{flag:'wx'});
  const content=read(own('content-inspection-02.json'));
  const scope=[...new Set([...progress.sourceScope.map(row=>row.path),...walk(__dirname).filter(checkpointFile),'docs/soterai-lite/ledger.md','docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/NEXT-CHAT-HANDOFF-20261101-F28.md','docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/native09-user-decision-01.json',content.vsix.output.replaceAll('\\','/'),content.buildReceipt])].sort();
  const tree=new Map(names(['ls-tree','-r','-z','HEAD']).map(line=>{const match=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(line);assert(match);return[match[3],{mode:match[1],oid:match[2]}];}));
  const files=scope.map(fact).filter(row=>tree.get(row.path)?.oid!==row.oid||tree.get(row.path)?.mode!==row.mode);
  assert(files.length>0);
  const record={status:'PREPARED_SCOPED_F28_NATIVE30_CLOSED_EVIDENCE_NOT_COMMITTED',feature:'F28',parent:parentExpected,branch:text(['symbolic-ref','--short','HEAD']),progressSha256:sha(fs.readFileSync(own('progress-04.json'))),body,files,scope:'F28 immutable completed native30 evidence, static fixture/admission/final-tool preparation, retained failures and selected ledger/queue/handoff metadata only. Current full4780 zeroFAIL/source1076/VSIX5dac/driver26/native30 peer/restart/restore exact. Original closed failure and logs evidence retained; active continuation streams/directories excluded; affected509/37 final acceptance pending. Source14/deferredF26a3/unrelated work unstaged. HistoricalF20 withdrawal still UNCONFIRMED. No source/feature completion, push, publish or rating.'};
  fs.writeFileSync(own(manifest),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:record.status,files:files.length+1,manifestSha256:sha(fs.readFileSync(own(manifest)))}));
}else{
  assert.match(expectedHash,/^[a-f0-9]{64}$/);assert.equal(sha(fs.readFileSync(own(manifest))),expectedHash);assert(!fs.existsSync(own(proof)));
  const m=read(own(manifest));assert.equal(text(['rev-parse','HEAD']),m.parent);assert.equal(text(['symbolic-ref','--short','HEAD']),m.branch);assert.equal(sha(fs.readFileSync(own('progress-04.json'))),m.progressSha256);
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
  const result={status:'PASS_EXACT_LOCAL_F28_NATIVE30_CLOSED_EVIDENCE_BYTES_FEATURE_INCOMPLETE',observedAt:new Date().toISOString(),feature:'F28',commit,parent:m.parent,fileCount:files.length,mismatches:0,unexpectedPaths:0,indexEmpty:true,featureState:'ACTIVE_INCOMPLETE_NATIVE30_PASS_AFFECTED_CHAIN_PENDING',configuredGitPush:'NO_REMAINING_AUTHORITY_NOT_RUN',f26aNative09:'USER_DEFERRED_NOT_RUN',files,scope:m.scope};
  fs.writeFileSync(own(proof),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:result.status,commit,paths:files.length,mismatches:0,indexEmpty:true,proofSha256:sha(fs.readFileSync(own(proof)))}));
}

})().catch(error=>{console.error(error);process.exitCode=1;});
