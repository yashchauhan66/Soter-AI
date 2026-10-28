'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {phase}=require('../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
const d=__dirname,repo=path.resolve(d,'../../../..'),own=n=>path.join(d,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),json=(n,v)=>fs.writeFileSync(own(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'}),quote=s=>"'"+s.replaceAll("'","''")+"'";
const wrapper=path.join(repo,'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'),powershell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',results=[];
function verify(){const proof=read(own('full-inputs-04.json'));assert.equal(proof.fileCount,1024);for(const row of [...proof.files,proof.auxiliaryFixture]){const b=fs.readFileSync(path.join(repo,row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);}}
async function step(name,args,cwd=repo){
 verify();assert(!fs.existsSync(own(name+'.txt')));const command='& '+quote(wrapper)+' -FilePath '+quote(process.execPath)+' -ArgumentList @('+args.map(quote).join(',')+') -OutputFile '+quote(own(name+'.txt'))+' -WorkingDirectory '+quote(cwd);
 const r=await phase({executable:powershell,args:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],cwd:repo,env:process.env,run:d,name,profile:'WORKSPACE_ONLY_SYNTHETIC_CHECK_NO_CODE',deadlineMs:1800000});
 const receipt=fs.existsSync(own(name+'.txt.result.json'))?read(own(name+'.txt.result.json')):null;if(receipt)assert.equal(sha(fs.readFileSync(own(name+'.txt'))),receipt.sha256.toLowerCase());const result={name,status:r.closed.code===0&&r.closed.signal===null&&receipt?.exitCode===0&&!r.deadline&&!r.overflow&&!r.error&&r.close.stdoutEOF&&r.close.stderrEOF?'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT':'FAIL_OR_INCOMPLETE',actualClose:true,wrapperExit:r.closed.code,innerExit:receipt?.exitCode??null,signal:r.closed.signal,stdoutEOF:r.close.stdoutEOF,stderrEOF:r.close.stderrEOF,deadlineExceeded:r.deadline,signalsRequested:0};results.push(result);json(name+'-verification.json',result);assert.equal(result.status,'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT');verify();
}
async function main(){
 json('serial-start-04.json',{status:'STARTED_NOT_COMPLETED',pid:process.pid,observedAt:new Date().toISOString(),phases:['compiler04','guardCoreTypecheck01','guardCoreTests01','auxiliaryFixtureTypecheck04','backendTypecheck02','backendTests02','fullTests03','readiness02','package02'],signalsRequested:0,native06:'F26a_USER_DEFERRED_NOT_RUN'});
 await step('compiler-04',['node_modules/typescript/bin/tsc','--noEmit','-p','packages/vscode-extension/tsconfig.json']);
 await step('guard-core-typecheck-01',['node_modules/typescript/bin/tsc','--noEmit','-p','packages/guard-core/tsconfig.json']);
 await step('guard-core-tests-01',['--import','tsx','--test','--test-concurrency=1','packages/guard-core/src/__tests__/**/*.test.ts']);
 await step('native-fixture-typecheck-04',['node_modules/typescript/bin/tsc','--noEmit','--strict','--skipLibCheck','--types','node,vscode','--target','ES2022','--module','commonjs','--esModuleInterop','--lib','ES2022','docs/soterai-lite/evidence/20261028-f29-protection-center-6c93e15a/f29-native03.host.ts']);
 await step('backend-typecheck-02',['node_modules/typescript/bin/tsc','--noEmit','-p','apps/local-ai-broker/tsconfig.json']);
 await step('backend-tests-02',['--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts']);
 await step('full-tests-03',['--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts'],path.join(repo,'packages/soterai-lite'));
 await step('readiness-02',['packages/vscode-extension/scripts/generate-readiness.mjs','--check']);
 await step('package-02',['packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f29-20261028-attempt02.vsix']);
 json('serial-result-04.json',{status:'SERIAL_CURRENT_F29_SOURCE_VERIFICATION_AND_NEW_PACKAGE_PASS_NATIVE_CONTENT_PENDING',observedAt:new Date().toISOString(),results,signalsRequested:0,native06:'F26a_USER_DEFERRED_NOT_RUN'});
}
const keep=setInterval(()=>{},1000);main().catch(error=>{json('serial-failure-04.json',{status:'FAIL_OR_INCOMPLETE_NO_LATER_PHASE_NO_AUTOMATIC_RETRY',observedAt:new Date().toISOString(),results,errorCode:typeof error.code==='string'?error.code:'VERIFICATION_REFUSED',signalsRequested:0});console.error('F29 serial verification refused or incomplete; retained evidence; no automatic retry.');process.exitCode=1;}).finally(()=>clearInterval(keep));
