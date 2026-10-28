'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {phase}=require('../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),put=(n,v)=>fs.writeFileSync(own(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'}),quote=s=>"'"+s.replaceAll("'","''")+"'";
const results=[],wrapper=path.join(repo,'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1');
function verify(){const proof=read(own('full-inputs-01.json'));assert.equal(proof.fileCount,1036);for(const row of proof.files){const file=path.join(repo,row.path),stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1);const raw=fs.readFileSync(file);assert.equal(raw.length,row.bytes,row.path);assert.equal(sha(raw),row.sha256,row.path);}}
async function step(name,args,cwd=repo){verify();assert(!fs.existsSync(own(name+'.txt')));const command='& '+quote(wrapper)+' -FilePath '+quote(process.execPath)+' -ArgumentList @('+args.map(quote).join(',')+') -OutputFile '+quote(own(name+'.txt'))+' -WorkingDirectory '+quote(cwd);
 const r=await phase({executable:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',args:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],cwd:repo,env:process.env,run:__dirname,name,profile:'WORKSPACE_SYNTHETIC_UNIT_BUILD_NO_CODE',deadlineMs:1800000});
 const receipt=fs.existsSync(own(name+'.txt.result.json'))?read(own(name+'.txt.result.json')):undefined;if(receipt)assert.equal(sha(fs.readFileSync(own(name+'.txt'))),receipt.sha256.toLowerCase());
 const result={name,status:r.closed.code===0&&r.closed.signal===null&&receipt?.exitCode===0&&!r.deadline&&!r.overflow&&!r.error&&r.close.stdoutEOF&&r.close.stderrEOF?'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT':'FAIL_OR_INCOMPLETE',actualClose:true,wrapperExit:r.closed.code,innerExit:receipt?.exitCode??null,signal:r.closed.signal,stdoutEOF:r.close.stdoutEOF,stderrEOF:r.close.stderrEOF,deadlineExceeded:r.deadline,signalsRequested:0};results.push(result);put(name+'-verification.json',result);assert.equal(result.status,'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT');verify();
}
const keep=setInterval(()=>{},1000);
(async()=>{
 verify();put('serial-start-01.json',{status:'STARTED_NOT_COMPLETED',pid:process.pid,observedAt:new Date().toISOString(),sourceProofSha256:sha(fs.readFileSync(own('full-inputs-01.json'))),signalsRequested:0,native06:'F26a_USER_DEFERRED_NOT_RUN'});
 await step('compiler-01',['node_modules/typescript/bin/tsc','--noEmit','-p','packages/vscode-extension/tsconfig.json']);
 const tests=fs.readdirSync(path.join(repo,'packages/vscode-extension/src/__tests__')).filter(n=>/^(setupVerification|protectionCenter)\..+\.test\.ts$/.test(n)).sort().map(n=>'packages/vscode-extension/src/__tests__/'+n);assert.equal(tests.length,10);
 await step('focused-01',['--import','tsx','--test','--test-concurrency=1',...tests]);
 await step('backend-typecheck-01',['node_modules/typescript/bin/tsc','--noEmit','-p','apps/local-ai-broker/tsconfig.json']);
 await step('backend-tests-01',['--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts']);
 await step('full-tests-01',['--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts'],path.join(repo,'packages/soterai-lite'));
 await step('readiness-01',['packages/vscode-extension/scripts/generate-readiness.mjs','--check']);
 await step('package-01',['packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f30-20261028-attempt01.vsix']);
 put('serial-result-01.json',{status:'CURRENT_F30_SERIAL_SOURCE_AND_PACKAGE_PASS_NATIVE_CONTENT_PENDING',observedAt:new Date().toISOString(),results,signalsRequested:0,native06:'F26a_USER_DEFERRED_NOT_RUN'});
})().catch(error=>{put('serial-failure-01.json',{status:'FAIL_OR_INCOMPLETE_NO_LATER_PHASE_NO_AUTOMATIC_RETRY',observedAt:new Date().toISOString(),results,errorCode:typeof error.code==='string'?error.code:'VERIFICATION_REFUSED',signalsRequested:0});console.error('F30 serial verification refused or incomplete; retained evidence; no automatic retry.');process.exitCode=1;}).finally(()=>clearInterval(keep));
