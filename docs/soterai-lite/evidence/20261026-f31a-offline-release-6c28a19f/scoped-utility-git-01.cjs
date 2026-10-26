// Exact allowlist/raw-byte local utility commits; no runtime acceptance or broad staging.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),base=path.relative(repo,__dirname).replace(/\\/g,'/'),own=n=>path.join(__dirname,n),git='C:\\Program Files\\Git\\cmd\\git.exe';
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex'),oid=raw=>crypto.createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const fact=file=>{const raw=fs.readFileSync(file);return {path:path.relative(repo,file).replace(/\\/g,'/'),bytes:raw.length,sha256:sha(raw),oid:oid(raw),mode:'100644'}};
const hooks=own('empty-hooks');
const environment=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^GIT_/i.test(key)));Object.assign(environment,{GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'});
function run(args,input){return cp.execFileSync(git,['--git-dir='+path.join(repo,'.git'),'--work-tree='+repo,'-c','core.hooksPath='+hooks,'-c','core.fsmonitor=false','-c','commit.gpgSign=false',...args],{cwd:repo,env:environment,input,windowsHide:true,shell:false,maxBuffer:32*1024*1024});}
const text=args=>run(args).toString('utf8').trim(),names=args=>run(args).toString('utf8').split('\0').filter(Boolean);
function ordinary(relative){assert(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.includes('\\')&&!relative.split('/').includes('..'));const file=path.resolve(repo,relative);assert(file.startsWith(repo+path.sep));for(let cursor=file;;cursor=path.dirname(cursor)){const stat=fs.lstatSync(cursor);assert(!stat.isSymbolicLink());if(cursor===repo)break;}const stat=fs.lstatSync(file);assert(stat.isFile()&&stat.nlink===1);return file;}
function checkFact(row){const actual=fact(ordinary(row.path));assert.deepEqual(actual,row);}
function preflight(){
 assert.equal(sha(fs.readFileSync(git)),'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');assert(fs.lstatSync(path.join(repo,'.git')).isDirectory());
 assert.equal(text(['rev-parse','--show-object-format']),'sha1');
 const acceptance=json(own('acceptance-01.json'));assert.equal(acceptance.status,'PASS_BUILD_UTILITY_CONTRACT_LOCAL_BYTE_BARRIERS_PENDING');assert.equal(acceptance.currentTests.pass,20);
 for(const row of acceptance.source){const raw=fs.readFileSync(ordinary(row.path));assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);}
 for(const row of acceptance.gates){const raw=fs.readFileSync(ordinary(row.raw.path)),receiptRaw=fs.readFileSync(ordinary(row.receipt.path));assert.equal(sha(raw),row.raw.sha256);assert.equal(sha(receiptRaw),row.receipt.sha256);const receipt=JSON.parse(receiptRaw.toString('utf8').replace(/^\uFEFF/,''));assert.equal(receipt.exitCode,row.exitCode);assert.equal(receipt.sha256.toLowerCase(),sha(raw));}
 const previous=json(path.join(repo,acceptance.priorF26a.sourceProof.path));for(const row of previous.files){const raw=fs.readFileSync(ordinary(row.path));assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);}
 assert(!fs.existsSync(path.join(repo,'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/run-precommit-native-06.ps1')));
 assert(!fs.existsSync(hooks)||fs.readdirSync(hooks).length===0);return acceptance;
}
function walk(directory){const results=[];for(const item of fs.readdirSync(directory,{withFileTypes:true})){assert(!item.isSymbolicLink());const file=path.join(directory,item.name);if(item.isDirectory())results.push(...walk(file));else if(item.isFile())results.push(path.relative(repo,file).replace(/\\/g,'/'));else throw Error('Unknown evidence entry.');}return results;}
const phase=process.argv[3];assert(['source','transition'].includes(phase));const mode=process.argv[2];assert(['--prepare','--commit'].includes(mode));
const manifestName='utility-'+phase+'-manifest-01.json',bodyName='utility-'+phase+'-body-01.txt',resultName='utility-'+phase+'-byte-proof-01.json';
preflight();
if(mode==='--prepare'){
 assert.equal(process.argv.length,4);assert(!fs.existsSync(own(manifestName))&&!fs.existsSync(own(bodyName)));assert.equal(text(['status','--porcelain=v1','--untracked-files=no','--',':/nonexistent-f31a-placeholder']),'');
 assert.equal(names(['diff','--cached','--name-only','-z']).length,0,'Unknown staging must be preserved/refused.');
 const parent=text(['rev-parse','HEAD']);if(phase==='source')assert.equal(parent,'1969c368d439237126a360af452c254a5826be88');else{const prior=json(own('utility-source-byte-proof-01.json'));assert.equal(prior.status,'PASS_EXACT_LOCAL_UTILITY_COMMIT_BYTES');assert.equal(parent,prior.commit);}
 const body=phase==='source'?'feat(lite): add offline release inventory and SBOM utility\n\nAdd bounded exact-VSIX/provenance auditing and a detached bundled-component SBOM. Record the user-authorized shorter-first schedule and owner publishing runbook. F26a remains incomplete and native06 deferred; no runtime source is staged.\n':'docs(lite): record F31a utility byte barrier and next independent task\n\nKeep parent F31 and deferred F26a incomplete. Advance only the scoped offline utility after actual tests, artifact audit and source byte verification. No publishing or native06 authorization.\n';
 fs.writeFileSync(own(bodyName),body,{flag:'wx'});
 const fixed=['packages/soterai-lite/scripts/audit-release.cjs','packages/soterai-lite/scripts/__tests__/audit-release.test.cjs','docs/soterai-lite/PUBLISHING-RUNBOOK.md','docs/soterai-lite/IMPLEMENTATION-PLAN.md','docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/ledger.md'];
 if(phase==='transition')fixed.push('docs/soterai-lite/NEXT-CHAT-HANDOFF-20261026-PRIORITY.md');
 const scope=[...new Set([...fixed,...walk(__dirname)])].sort();const head=new Map();
 for(const entry of names(['ls-tree','-r','-z','HEAD','--',...scope])){const match=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(entry);assert(match);head.set(match[3],{mode:match[1],oid:match[2]});}
 const files=scope.map(relative=>fact(ordinary(relative))).filter(row=>!head.has(row.path)||head.get(row.path).oid!==row.oid||head.get(row.path).mode!==row.mode);assert(files.length>0);
 const manifest={status:'PREPARED_EXACT_UTILITY_COMMIT_NOT_WRITTEN',phase,parent,branch:text(['symbolic-ref','--short','HEAD']),feature:'F31a',acceptanceSha256:sha(fs.readFileSync(own('acceptance-01.json'))),files,scope:'Only two new build-tool source/test files, owner publishing runbook, existing scheduling/ledger metadata and F31a evidence. Pending F26 metadata in ledger/queue retained explicitly; no F26 production source/evidence staging.',externalHooks:'DISABLED_PER_INVOCATION_EMPTY_OWNED_DIRECTORY_NO_PERSISTENT_CONFIG',body:bodyName};
 fs.writeFileSync(own(manifestName),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:manifest.status,phase,parent,files:files.length+1,manifest:fact(own(manifestName))}));
}else{
 assert.equal(process.argv.length,5);assert.match(process.argv[4],/^[a-f0-9]{64}$/);assert.equal(sha(fs.readFileSync(own(manifestName))),process.argv[4]);assert(!fs.existsSync(own(resultName)));
 const manifest=json(own(manifestName));assert.equal(manifest.phase,phase);assert.equal(manifest.parent,text(['rev-parse','HEAD']));assert.equal(manifest.branch,text(['symbolic-ref','--short','HEAD']));assert.equal(manifest.acceptanceSha256,sha(fs.readFileSync(own('acceptance-01.json'))));assert.equal(names(['diff','--cached','--name-only','-z']).length,0);
 const files=[...manifest.files,fact(own(manifestName))];assert.equal(new Set(files.map(x=>x.path)).size,files.length);files.forEach(checkFact);
 if(!fs.existsSync(hooks))fs.mkdirSync(hooks);assert.equal(fs.readdirSync(hooks).length,0);
 for(const row of files){const raw=fs.readFileSync(ordinary(row.path)),written=run(['hash-object','-w','--stdin'],raw).toString('utf8').trim();assert.equal(written,row.oid);run(['update-index','--add','--cacheinfo',row.mode+','+written+','+row.path]);}
 const expected=files.map(x=>x.path).sort();assert.deepEqual(names(['diff','--cached','--name-only','-z']).sort(),expected);
 files.forEach(checkFact);for(const row of files){const raw=run(['show',':'+row.path]);assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);}
 preflight();assert.equal(text(['rev-parse','HEAD']),manifest.parent);run(['commit','--file',own(bodyName)]);
 const commit=text(['rev-parse','HEAD']);assert.equal(text(['rev-parse',commit+'^']),manifest.parent);assert.deepEqual(names(['diff-tree','--no-commit-id','--name-only','-r','-z',commit]).sort(),expected);
 for(const row of files){const raw=run(['cat-file','blob',commit+':'+row.path]);assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);assert.equal(oid(raw),row.oid);checkFact(row);}
 assert.equal(names(['diff','--cached','--name-only','-z']).length,0);
 const result={status:'PASS_EXACT_LOCAL_UTILITY_COMMIT_BYTES',feature:'F31a',phase,commit,parent:manifest.parent,observedAt:new Date().toISOString(),fileCount:files.length,mismatches:0,unexpectedPaths:0,indexEmpty:true,manifest:fact(own(manifestName)),files,native06:'DEFERRED_NOT_RUN',runtimeSourceCommitted:false,scope:manifest.scope};
 fs.writeFileSync(own(resultName),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,phase,commit,files:files.length,mismatches:0,unexpectedPaths:0,indexEmpty:true,result:fact(own(resultName))}));
}
