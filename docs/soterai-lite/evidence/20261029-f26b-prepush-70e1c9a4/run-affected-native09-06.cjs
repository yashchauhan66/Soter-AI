'use strict';
// Native09 acceptance is mandatory. No precommit/native09 or configured Git push.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('./affected-current-admission-07.cjs'),{own,repo,read,fact,sha}=C;
const helper=path.resolve(__dirname,'../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
assert.equal(sha(fs.readFileSync(helper)),'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
const {phase}=require(helper),keep=setInterval(()=>{},1000),results=[],put=(n,v)=>fs.writeFileSync(own(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'}),q=s=>"'"+s.replaceAll("'","''")+"'";
const ps='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',wrapper=path.join(repo,'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1');
function pinned(r){assert.deepEqual(fact(path.join(repo,r.path)),r);}
function admitted(){
 const m=read(own('affected-current-materialization-06.json'));assert.equal(m.status,'CURRENT1070_VSIX6C_BOUND_AFFECTED20_509_37_NOT_RUN');assert.equal(m.families.length,20);assert(m.precommitExcluded);assert.equal(m.componentGate,'ab44ff537291790635b181a85d4a345a66ac1471dbc5e6bb223f83fdd7b879cb');pinned(m.bindingHelper);pinned(m.packet);pinned(m.admission);
 for(const row of m.outputs)pinned(row.target);for(const f of m.families){pinned(f.driver);pinned(f.helper);assert(!f.driver.path.endsWith('/lite-precommit-guard-host.js'));}
 const receipt=read(own('affected-native09-admission-06.txt.result.json'));assert.equal(receipt.exitCode,0);assert.equal(sha(fs.readFileSync(own('affected-native09-admission-06.txt'))),receipt.sha256.toLowerCase());return m;
}
async function step(name,args){
 const before=new Set(fs.readdirSync(__dirname,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name));
 const command='& '+q(wrapper)+' -FilePath '+q(ps)+' -ArgumentList @('+args.map(q).join(',')+') -OutputFile '+q(own(name+'.txt'))+' -WorkingDirectory '+q(repo);
 const r=await phase({executable:ps,args:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],cwd:repo,env:process.env,run:__dirname,name,profile:'FRESH_D_SYNTHETIC_AFFECTED_F26B_EXACT6C',deadlineMs:1800000});
 const receipt=read(own(name+'.txt.result.json'));assert.equal(sha(fs.readFileSync(own(name+'.txt'))),receipt.sha256.toLowerCase());
 const directories=fs.readdirSync(__dirname,{withFileTypes:true}).filter(x=>x.isDirectory()&&!before.has(x.name)).map(x=>x.name);
 const result={name,status:r.closed.code===0&&r.closed.signal===null&&receipt.exitCode===0&&!r.deadline&&!r.error&&!r.overflow&&r.close.stdoutEOF&&r.close.stderrEOF?'PASS_CLOSED_WRAPPER_ROOT_AGGREGATION_PENDING':'FAIL_OR_INCOMPLETE_NO_LATER_PHASE',observedAt:new Date().toISOString(),actualClose:true,wrapperExit:r.closed.code,innerExit:receipt.exitCode,signal:r.closed.signal,stdoutEOF:r.close.stdoutEOF,stderrEOF:r.close.stderrEOF,deadlineExceeded:r.deadline,signalsRequested:0,directories,close:fact(own(name+'-owned-close.json'))};
 put(name+'-result.json',result);results.push(result);console.log(JSON.stringify(result));assert.equal(result.status,'PASS_CLOSED_WRAPPER_ROOT_AGGREGATION_PENDING');return result;
}
(async()=>{
 const acceptance=C.component();const b=await C.guard({component:true}),m=admitted(),review=read(path.join(repo,b.hostReview.path));assert.equal(m.vsix.sha256,b.vsix.sha256);
 put('affected-native09-chain-start-06.json',{status:'STARTED_NOT_COMPLETED',pid:process.pid,observedAt:new Date().toISOString(),nativeAcceptance:acceptance,materialization:fact(own('affected-current-materialization-06.json')),sourceProof:b.sourceProof,vsix:b.vsix,configuredPush:'NOT_AUTHORIZED_NOT_RUN',f26aNative09:'USER_DEFERRED_NOT_RUN',signalsRequested:0});
 const artifact=['-VsixPath',path.join(repo,b.vsix.path),'-ExpectedVsixSha256',b.vsix.sha256,'-ExpectedBundleSha256',b.frontendSha256];
 for(const f of m.families){await C.guard({component:true});admitted();await step('affected-'+f.id+'-native09-06',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(repo,f.helper.path),'-CodePath',review.currentHost.executable.path,...artifact,'-HostTestsPath',path.join(repo,f.driver.path),'-ExtensionRoot',path.join(repo,b.extractedRoot)]);await C.guard({component:true});}
 await step('affected-functional-security-native09-06',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',own('affected-functional-security-04.ps1'),'-CodePath',review.currentHost.executable.path,...artifact,'-InspectionName','06']);await C.guard({component:true});admitted();
 put('affected-native09-chain-result-06.json',{status:'AFFECTED20_AND_FUNCTIONAL_SECURITY_CLOSED_ROOT_AGGREGATION_PENDING',observedAt:new Date().toISOString(),results,assertionsExpected:509,phasesExpected:37,functionalExpected:10,securityExpected:17,configuredPush:'NOT_AUTHORIZED_NOT_RUN',f26aNative09:'USER_DEFERRED_NOT_RUN',signalsRequested:0});
})().catch(e=>{put('affected-native09-chain-failure-06.json',{status:'FAIL_OR_INCOMPLETE_NO_AUTOMATIC_RETRY',observedAt:new Date().toISOString(),results,errorName:e.name,message:String(e.message).slice(0,500),signalsRequested:0});process.exitCode=1;}).finally(()=>clearInterval(keep));
