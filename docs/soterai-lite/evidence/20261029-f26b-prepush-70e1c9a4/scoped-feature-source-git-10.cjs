'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n);
const git='C:\\Program Files\\Git\\cmd\\git.exe',hooks=own('empty-feature-source-hooks-10');
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
 const p=await require('./finalize-feature-acceptance-01.cjs').verify(),saved=read(own('acceptance-01.json'));assert.deepEqual({...p,observedAt:saved.observedAt},saved);
 assert.equal(p.status,'PASS_SCOPED_F26B_LOCAL_SOURCE_AND_TRANSITION_BYTE_BARRIERS_PENDING');assert.equal(p.sourceScope.length,40);assert.equal(p.sourceInputs,1070);assert.equal(p.f26aNative09,'USER_DEFERRED_NOT_RUN');
 for(const n of ['feature-acceptance-01','feature-progress-20']){const r=read(own(n+'.txt.result.json'));assert.equal(r.exitCode,0);assert.equal(sha(fs.readFileSync(own(n+'.txt'))),r.sha256.toLowerCase());}
 assert(!fs.existsSync(hooks)||fs.readdirSync(hooks).length===0);return p;
}

(async()=>{
const [mode,expectedHash]=process.argv.slice(2);assert(['--prepare','--commit'].includes(mode));
const progress=await preflight();assert.equal(names(['diff','--cached','--name-only','-z']).length,0,'Unknown staged changes must remain untouched.');
const manifest='f26b-source-manifest-10.json',proof='f26b-source-byte-proof-10.json',body='f26b-source-body-10.txt';
const parentExpected='253342591e761a0c3c43c4c6dc9cb67a49d4364b';
if(mode==='--prepare'){
  assert(!expectedHash&&!fs.existsSync(own(manifest)));assert.equal(text(['rev-parse','HEAD']),parentExpected);
  fs.writeFileSync(own(body),"feat(lite): add reviewed bounded pre-push history guard\n\nScan complete bounded reachable branch history through the signed owning editor before allowing Git to send objects. Default false; reviewed install/resume/encrypted restore preserves supported original hooks. Full4750/4746PASS0FAIL4SKIP; native36, configured local-push8 with TWO authorized file pushes, affected509/37, functional10 and unchanged security17 baseline. Exact VSIX6c299712 and1070 inputs verified. Scoped40 product/test/doc paths; three deferred F26a files and unrelated work excluded. Safe withdrawal and declared owners natural close verified; nested Git children not inferred. LOW independence, no external/source-project push or publish; source/transition byte barriers still required.\n",{flag:'wx'});
  const content=read(own('content-inspection-03.json'));
  const scope=[...new Set([...progress.sourceScope.map(row=>row.path),...walk(__dirname),'docs/soterai-lite/ledger.md','docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/NEXT-CHAT-HANDOFF-20261029-F26B.md','docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/native09-user-decision-01.json',content.vsix.output.replaceAll('\\','/'),content.buildReceipt])].sort();
  const tree=new Map(names(['ls-tree','-r','-z','HEAD']).map(line=>{const match=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(line);assert(match);return[match[3],{mode:match[1],oid:match[2]}];}));
  const files=scope.map(fact).filter(row=>tree.get(row.path)?.oid!==row.oid||tree.get(row.path)?.mode!==row.mode);
  assert(files.length>0);
  const record={status:'PREPARED_SCOPED_F26B_SOURCE_AND_EVIDENCE_NOT_COMMITTED',feature:'F26b',parent:parentExpected,branch:text(['symbolic-ref','--short','HEAD']),progressSha256:sha(fs.readFileSync(own('acceptance-01.json'))),body,files,scope:'F26b scoped40 product/test/docs plus current acceptance/evidence. Current1070/exactVSIX6c verified, full4746PASS0FAIL4SKIP/native36/localpush8/affected509/functional10/security17 baseline unchanged. User one extra Proposal03 consumed once/TWO local file pushes. Three deferred F26a sources and unrelated work excluded; tested VSIX includes those excluded inputs, not a whole-HEAD reproducibility claim. Source raw byte proof then separate DONE transition proof required.'};
  fs.writeFileSync(own(manifest),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:record.status,files:files.length+1,manifestSha256:sha(fs.readFileSync(own(manifest)))}));
}else{
  assert.match(expectedHash,/^[a-f0-9]{64}$/);assert.equal(sha(fs.readFileSync(own(manifest))),expectedHash);assert(!fs.existsSync(own(proof)));
  const m=read(own(manifest));assert.equal(text(['rev-parse','HEAD']),m.parent);assert.equal(text(['symbolic-ref','--short','HEAD']),m.branch);assert.equal(sha(fs.readFileSync(own('acceptance-01.json'))),m.progressSha256);
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
  const result={status:'PASS_EXACT_LOCAL_F26B_SOURCE_AND_EVIDENCE_BYTES',observedAt:new Date().toISOString(),feature:'F26b',commit,parent:m.parent,fileCount:files.length,mismatches:0,unexpectedPaths:0,indexEmpty:true,featureState:'VERIFYING_TRANSITION_BYTE_BARRIER_PENDING',configuredGitPush:'PROPOSAL03_CONSUMED_ONCE_PASS8_TWO_SYNTHETIC_LOCAL_FILE_PUSHES',f26aNative09:'USER_DEFERRED_NOT_RUN',files,scope:m.scope};
  fs.writeFileSync(own(proof),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:result.status,commit,paths:files.length,mismatches:0,indexEmpty:true,proofSha256:sha(fs.readFileSync(own(proof)))}));
}

})().catch(error=>{console.error(error);process.exitCode=1;});
