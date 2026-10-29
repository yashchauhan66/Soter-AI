'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const helper=path.resolve(__dirname,'../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(sha(fs.readFileSync(helper)),'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
const {phase}=require(helper),repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),put=(n,v)=>fs.writeFileSync(own(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'}),q=s=>"'"+s.replaceAll("'","''")+"'",results=[],keep=setInterval(()=>{},1000);
function verify(){const proof=read(own('full-inputs-09.json'));assert.equal(proof.fileCount,1037);for(const r of proof.files){const p=path.join(repo,r.path),s=fs.lstatSync(p);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1);const b=fs.readFileSync(p);assert.equal(b.length,r.bytes,r.path);assert.equal(sha(b),r.sha256,r.path);}}
async function step(name,args,cwd=repo){verify();assert(!fs.existsSync(own(name+'.txt')));const command='& '+q(path.join(repo,'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'))+' -FilePath '+q(process.execPath)+' -ArgumentList @('+args.map(q).join(',')+') -OutputFile '+q(own(name+'.txt'))+' -WorkingDirectory '+q(cwd);
 const r=await phase({executable:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',args:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],cwd:repo,env:process.env,run:__dirname,name,profile:'SYNTHETIC_COMPONENT_BUILD_ONLY_NO_CODE_NATIVE08_NOT_AUTHORIZED',deadlineMs:1800000});
 const receipt=read(own(name+'.txt.result.json'));assert.equal(sha(fs.readFileSync(own(name+'.txt'))),receipt.sha256.toLowerCase());
 const row={name,status:r.closed.code===0&&r.closed.signal===null&&receipt.exitCode===0&&!r.deadline&&!r.error&&!r.overflow&&r.close.stdoutEOF&&r.close.stderrEOF?'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT':'FAIL_OR_INCOMPLETE_NO_LATER_PHASE',actualClose:true,wrapperExit:r.closed.code,innerExit:receipt.exitCode,signal:r.closed.signal,stdoutEOF:r.close.stdoutEOF,stderrEOF:r.close.stderrEOF,deadlineExceeded:r.deadline,signalsRequested:0};put(name+'-verification.json',row);results.push(row);assert.equal(row.status,'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT');verify();
}
(async()=>{
 verify();put('storage-serial-start-09.json',{status:'CURRENT_STORAGE_FIX_SERIAL_STARTED_NOT_COMPLETED',pid:process.pid,observedAt:new Date().toISOString(),proofSha256:sha(fs.readFileSync(own('full-inputs-09.json'))),signalsRequested:0,native07:'CONSUMED_FAIL_NO_RETRY',native08:'NOT_AUTHORIZED_NOT_RUN'});
 assert.equal(read(own('storage-clock-focused-09.txt.result.json')).exitCode,0);assert.equal(read(own('storage-uri-focused-01.txt.result.json')).exitCode,0);assert.equal(read(own('storage-uri-lite-cwd-02.txt.result.json')).exitCode,0);
 await step('compiler-09',['node_modules/typescript/bin/tsc','--noEmit','-p','packages/vscode-extension/tsconfig.json']);
 for(const name of ['backend-typecheck-08','backend-tests-08']){
  verify();const v=read(own(name+'-verification.json')),c=read(own(name+'-owned-close.json')),r=read(own(name+'.txt.result.json'));
  assert.equal(v.status,'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT');assert(v.actualClose&&v.wrapperExit===0&&v.innerExit===0&&v.stdoutEOF&&v.stderrEOF&&v.signalsRequested===0);
  assert(c.actualClose&&c.exitCode===0&&c.signal===null&&c.stdoutEOF&&c.stderrEOF&&!c.deadlineExceeded&&!c.overflow&&!c.streamError&&c.signalsRequested===0);assert.equal(r.exitCode,0);assert.equal(sha(fs.readFileSync(own(name+'.txt'))),r.sha256.toLowerCase());results.push(v);
 }
 await step('full-tests-09',['--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts'],path.join(repo,'packages/soterai-lite'));
 await step('readiness-09',['packages/vscode-extension/scripts/generate-readiness.mjs','--check']);
 await step('package-09',['packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f26a-20261029-attempt02.vsix']);
 put('storage-serial-result-09.json',{status:'CURRENT_F26A_STORAGE_FIX_SERIAL_SOURCE_AND_PACKAGE_PASS_NATIVE_CONTENT_PENDING',observedAt:new Date().toISOString(),results,signalsRequested:0,native08:'NOT_AUTHORIZED_NOT_RUN'});
})().catch(e=>{put('storage-serial-failure-09.json',{status:'FAIL_OR_INCOMPLETE_NO_LATER_PHASE_NO_AUTO_RETRY',observedAt:new Date().toISOString(),results,errorName:e instanceof Error?e.name:'UnknownFailure',message:String(e?.message).slice(0,300),signalsRequested:0});process.exitCode=1;}).finally(()=>clearInterval(keep));
