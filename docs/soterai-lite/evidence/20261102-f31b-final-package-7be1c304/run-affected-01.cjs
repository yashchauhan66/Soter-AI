'use strict';
// One bound supported-workflow chain. No pre-commit host test or Git push.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),C=require('./current-native-admission-03.cjs'),{own,repo,read,fact,sha}=C;
const helper=path.resolve(__dirname,'../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
assert.equal(sha(fs.readFileSync(helper)),'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
const {phase}=require(helper),keep=setInterval(()=>{},1000),results=[],put=(n,v)=>fs.writeFileSync(own(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'}),q=s=>"'"+s.replaceAll("'","''")+"'";
const ps='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',wrapper=path.join(repo,'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1');
async function step(name,args){
 const before=new Set(fs.readdirSync(__dirname,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name));
 const command='& '+q(wrapper)+' -FilePath '+q(ps)+' -ArgumentList @('+args.map(q).join(',')+') -OutputFile '+q(own(name+'.txt'))+' -WorkingDirectory '+q(repo);
 const r=await phase({executable:ps,args:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],cwd:repo,env:process.env,run:__dirname,name,profile:'F31B_SYNTHETIC_SUPPORTED_AFFECTED_NO_F26A_HOST_OR_PUSH',deadlineMs:1800000});
 const receipt=read(own(name+'.txt.result.json'));assert.equal(sha(fs.readFileSync(own(name+'.txt'))),receipt.sha256.toLowerCase());
 const result={name,status:r.closed.code===0&&r.closed.signal===null&&receipt.exitCode===0&&!r.deadline&&!r.error&&!r.overflow&&r.close.stdoutEOF&&r.close.stderrEOF?'PASS_CLOSED_WRAPPER_ROOT_AGGREGATION_PENDING':'FAIL_OR_INCOMPLETE_NO_LATER_PHASE',observedAt:new Date().toISOString(),actualClose:true,wrapperExit:r.closed.code,innerExit:receipt.exitCode,signal:r.closed.signal,stdoutEOF:r.close.stdoutEOF,stderrEOF:r.close.stderrEOF,deadlineExceeded:r.deadline,signalsRequested:0,directories:fs.readdirSync(__dirname,{withFileTypes:true}).filter(x=>x.isDirectory()&&!before.has(x.name)).map(x=>x.name),close:fact(own(name+'-owned-close.json'))};
 put(name+'-result.json',result);results.push(result);console.log(JSON.stringify(result));assert.equal(result.status,'PASS_CLOSED_WRAPPER_ROOT_AGGREGATION_PENDING');
}
(async()=>{
 const b=C.binding(),absence=read(own('prior-owner-absence-01.json'));assert.equal(absence.status,'MARKED_SYNTHETIC_CODE_ABSENT_TWICE_NO_SIGNALS');assert.equal(absence.observations.length,2);assert(Date.now()-Date.parse(absence.observedAt)<180000);
 assert(!fs.existsSync(own('affected-chain-consumption-01.json')));assert.equal(b.families.length,4);assert(b.precommitExcluded);
 put('affected-chain-consumption-01.json',{status:'ONE_F31B_AFFECTED202_10_CHAIN_CONSUMED_NO_AUTOMATIC_RETRY',observedAt:new Date().toISOString(),pid:process.pid,binding:fact(own('native-binding-01.json')),sourceProof:b.sourceProof,vsix:b.vsix,priorAbsence:fact(own('prior-owner-absence-01.json')),f26a:'USER_SKIPPED_NO_HOST_NATIVE_RUNS',signalsRequested:0});
 const review=read(path.join(repo,b.hostReview.path)),artifact=['-VsixPath',path.join(repo,b.vsix.path),'-ExpectedVsixSha256',b.vsix.sha256,'-ExpectedBundleSha256',b.frontendSha256],prefix=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass'];
 for(const f of b.families){C.binding();await step('affected-'+f.id+'-f31b-01',[...prefix,'-File',path.join(repo,f.helper.path),'-CodePath',review.currentHost.executable.path,...artifact,'-HostTestsPath',path.join(repo,f.driver.path),'-ExtensionRoot',path.join(repo,b.extractedRoot)]);C.binding();}
 await step('affected-functional-security-f31b-01',[...prefix,'-File',own('affected-functional-security-03.ps1'),'-CodePath',review.currentHost.executable.path,...artifact,'-InspectionName','02']);
 C.binding();put('affected-chain-result-01.json',{status:'F31B_AFFECTED4_AND_FUNCTIONAL_SECURITY_CLOSED_ROOT_AGGREGATION_PENDING',observedAt:new Date().toISOString(),results,assertionsExpected:175,phasesExpected:8,functionalExpected:10,securityExpected:17,signalsRequested:0});
})().catch(error=>{put('affected-chain-failure-01.json',{status:'FAIL_OR_INCOMPLETE_NO_AUTOMATIC_RETRY',observedAt:new Date().toISOString(),results,errorName:error.name,message:String(error.message).slice(0,500),signalsRequested:0});process.exitCode=1;}).finally(()=>clearInterval(keep));
