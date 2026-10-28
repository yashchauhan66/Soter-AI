// Await current serial/content only. Never launch Code or a browser here.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {phase}=require('../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),quote=s=>"'"+s.replaceAll("'","''")+"'",json=(n,v)=>fs.writeFileSync(own(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'}),results=[];
function verifySource(){const proof=read(own('full-inputs-05.json'));assert.equal(proof.fileCount,1024);for(const row of [...proof.files,proof.auxiliaryFixture]){const raw=fs.readFileSync(path.join(repo,row.path));assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);}}
async function step(name,args,program=process.execPath){
 verifySource();const output=own(name+'.txt');assert(!fs.existsSync(output));const command='& '+quote(path.join(repo,'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'))+' -FilePath '+quote(program)+' -ArgumentList @('+args.map(quote).join(',')+') -OutputFile '+quote(output)+' -WorkingDirectory '+quote(repo);
 const r=await phase({executable:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',args:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],cwd:repo,env:process.env,run:__dirname,name,profile:'WORKSPACE_ONLY_READ_ONLY_ADMISSION_NO_NATIVE_LAUNCH',deadlineMs:120000});
 const receipt=read(output+'.result.json');assert.equal(sha(fs.readFileSync(output)),receipt.sha256.toLowerCase());const row={name,status:r.closed.code===0&&r.closed.signal===null&&receipt.exitCode===0&&!r.deadline&&!r.error&&!r.overflow&&r.close.stdoutEOF&&r.close.stderrEOF?'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT':'FAIL_OR_INCOMPLETE',actualClose:true,wrapperExit:r.closed.code,innerExit:receipt.exitCode,signal:r.closed.signal,stdoutEOF:r.close.stdoutEOF,stderrEOF:r.close.stderrEOF,deadlineExceeded:r.deadline,signalsRequested:0};results.push(row);json(name+'-verification.json',row);assert.equal(row.status,'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT');verifySource();
}
const keep=setInterval(()=>{},1000);
(async()=>{
 json('admission-watcher-start-01.json',{status:'WAITING_CURRENT_POSTFULL04_NO_CODE_OR_BROWSER',pid:process.pid,observedAt:new Date().toISOString(),signalsRequested:0});
 for(;;){if(fs.existsSync(own('serial-failure-05.json'))||fs.existsSync(own('postfull-watcher-failure-04.json')))throw Error('Current verification failed; no admission continuation.');if(fs.existsSync(own('postfull-watcher-result-04.json'))){const r=read(own('postfull-watcher-result-04.json'));assert.equal(r.status,'CURRENT_CONTENT_AND_FRESH23_DRIVERS_PASS_NATIVE_AND_ACCESSIBILITY_NOT_RUN');break;}await new Promise(done=>setTimeout(done,1000));}
 await step('admission-preparation-03',[path.relative(repo,own('prepare-current-admission-03.cjs'))]);
 await step('native-binding-02',[path.relative(repo,own('materialize-native-binding-02.cjs'))]);
 await step('native-admission-02',[path.relative(repo,own('current-native-guard-02.cjs'))]);
 await step('affected-materialization-01',[path.relative(repo,own('prepare-affected-02.cjs'))]);
 await step('prepared-control-syntax-01',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',own('verify-prepared-controls-01.ps1')],'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
 for(const file of ['current-native-guard-02.cjs','materialize-native-binding-02.cjs','run-f29-native-02.cjs','run-affected-activity-01.cjs','run-code-renderer-observer-02.cjs','run-edge-axe-capture-01.cjs'])await step('syntax-'+file.replace('.cjs',''),['--check',own(file)]);
 json('current-admission-result-01.json',{status:'CURRENT_EXACT_ADMISSION_AND_CONTROLS_PASS_NO_CODE_OR_BROWSER_LAUNCHED',observedAt:new Date().toISOString(),results,sourceProofSha256:sha(fs.readFileSync(own('full-inputs-05.json'))),native:'NOT_RUN',accessibility:'NOT_RUN',native06:'F26a_USER_DEFERRED_NOT_RUN',signalsRequested:0});
})().catch(error=>{json('current-admission-failure-01.json',{status:'FAIL_OR_INCOMPLETE_NO_CODE_OR_BROWSER_NO_AUTOMATIC_RETRY',results,errorName:error instanceof Error?error.name:'UnknownFailure',message:String(error?.message).slice(0,400),signalsRequested:0});process.exitCode=1;}).finally(()=>clearInterval(keep));
