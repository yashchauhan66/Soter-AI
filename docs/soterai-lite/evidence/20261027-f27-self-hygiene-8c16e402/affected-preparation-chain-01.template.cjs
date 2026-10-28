// UNBOUND template. All admission must precede a launch, including a phase whose
// prior artifact passed. Retain actual close and both pipe readers on uncertainty.
'use strict';
if ('__F27_AFFECTED_UNBOUND__' !== 'F27_AFFECTED_CURRENT_FACTS_BOUND') {
  throw new Error('PREPARED_UNBOUND_NOT_EXECUTED: no F27 artifact/guard/host/driver is bound.');
}
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const home=__dirname,repo=path.resolve(home,'../../../..'),own=n=>path.join(home,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const wrapper=path.join(repo,'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'),powershell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const quote=s=>"'"+s.replaceAll("'","''")+"'",keep=setInterval(()=>{},1000),results=[];
function json(name,value){fs.writeFileSync(own(name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
// The exact source proof is rehashed as often as the existing accepted admission
// requires. No before/after optimization is admitted by this template.
function verifyInputs(){const proof=read(own('full-inputs-04.json'));assert.equal(proof.fileCount,1016);assert.equal(proof.files.length,1016);for(const pin of proof.files){const raw=fs.readFileSync(path.join(repo,pin.path));assert.equal(raw.length,pin.bytes,pin.path);assert.equal(sha(raw),pin.sha256,pin.path);}}
async function step(name,args,cwd=repo,program=process.execPath){
 const output=own(name+'.txt');assert(!fs.existsSync(output));
 const command='& '+quote(wrapper)+' -FilePath '+quote(program)+' -ArgumentList @('+args.map(quote).join(',')+') -OutputFile '+quote(output)+' -WorkingDirectory '+quote(cwd);
 const child=cp.spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{cwd:repo,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
 json(name+'-owned-start.json',{status:'STARTED_NOT_COMPLETED',observedAt:new Date().toISOString(),pid:child.pid??null,args,cwd,signalsRequested:0});
 const streams={};let overflow=false,error=false,deadline=false;
 for(const key of ['stdout','stderr']){const file=own(name+'-wrapper-'+key+'.bin');streams[key]={file,fd:fs.openSync(file,'wx'),bytes:0,eof:false};child[key].on('data',raw=>{const s=streams[key],left=1048576-s.bytes;if(raw.length>left)overflow=true;if(left>0){const part=raw.subarray(0,left);fs.writeSync(s.fd,part);s.bytes+=part.length;}});child[key].on('end',()=>{streams[key].eof=true});child[key].on('error',()=>{error=true});}
 child.on('error',()=>{error=true});
 const timer=setTimeout(()=>{deadline=true;json(name+'-deadline.json',{status:'STOP_UNCONFIRMED_RETAIN_OWNERSHIP_NO_NEW_PHASE',pid:child.pid,signalsRequested:0});},1800000);
 const closed=await new Promise(resolve=>child.on('close',(code,signal)=>resolve({code,signal})));clearTimeout(timer);
 for(const s of Object.values(streams)){fs.fsyncSync(s.fd);fs.closeSync(s.fd);}
 const receiptFile=output+'.result.json',receipt=fs.existsSync(receiptFile)?read(receiptFile):null;
 const result={name,status:closed.code===0&&closed.signal===null&&receipt?.exitCode===0&&!overflow&&!error&&!deadline&&streams.stdout.eof&&streams.stderr.eof?'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT':'FAIL_OR_INCOMPLETE',observedAt:new Date().toISOString(),pid:child.pid??null,actualClose:true,wrapperExit:closed.code,signal:closed.signal,innerExit:receipt?.exitCode??null,stdoutEOF:streams.stdout.eof,stderrEOF:streams.stderr.eof,overflow,streamError:error,deadlineExceeded:deadline,signalsRequested:0,streams:Object.entries(streams).map(([name,s])=>({name,bytes:s.bytes,sha256:sha(fs.readFileSync(s.file))}))};
 if(receipt)assert.equal(sha(fs.readFileSync(output)),receipt.sha256.toLowerCase());json(name+'-owned-close.json',result);results.push(result);console.log(JSON.stringify(result));assert.equal(result.status,'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT',name);
}
async function main(){
 // A reviewed new-name materialization must pin an actual guard before this
 // location becomes reachable. The provided guard template always refuses.
 const admission=require('./affected-preparation-guard-01.template.cjs');
 const binding=await admission.guard();
 verifyInputs();
 const manifest=read(own('affected-preparation-source-provenance-01.json'));
 assert.equal(binding.sourceAdmissionMode,'PRESERVE_EXISTING_FULL_1016_RECHECKS');
 assert.equal(binding.native06,'F26a_USER_DEFERRED_EXCLUDED_NOT_RUN');
 assert.equal(binding.familyDrivers.length,20);
 json('affected-preparation-chain-start-01.json',{status:'STARTED_NOT_COMPLETED',observedAt:new Date().toISOString(),pid:process.pid,signalsRequested:0,native06:binding.native06});
 for(const family of manifest.families){
   await admission.guard();verifyInputs();
   const matches=binding.familyDrivers.filter(row=>row.id===family.id);assert.equal(matches.length,1);
   const row=matches[0];assert.equal(row.assertions,family.assertions);assert.equal(row.phases,family.phases);
   const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',own(family.helperOutput),'-CodePath',binding.hostExecutable.path,'-VsixPath',path.join(repo,binding.vsix.path),'-ExpectedVsixSha256',binding.vsix.sha256,'-ExpectedBundleSha256',binding.frontendSha256,'-HostTestsPath',path.join(repo,row.driver.path),'-ExtensionRoot',path.join(repo,binding.extractedRoot)];
   await step('affected-preparation-'+family.id+'-run-01',args,repo,powershell);
   await admission.guard();verifyInputs();
 }
 await admission.guard();verifyInputs();
 const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',own('affected-preparation-functional-security-01.template.ps1'),'-CodePath',binding.hostExecutable.path,'-VsixPath',path.join(repo,binding.vsix.path),'-ExpectedVsixSha256',binding.vsix.sha256,'-ExpectedBundleSha256',binding.frontendSha256,'-InspectionName','01'];
 await step('affected-preparation-functional-security-run-01',args,repo,powershell);
 await admission.guard();verifyInputs();
 json('affected-preparation-chain-result-01.json',{status:'AFFECTED_RUNS_CLOSED_CURRENT_RESULT_AGGREGATION_STILL_REQUIRED',observedAt:new Date().toISOString(),results,signalsRequested:0,native06:binding.native06,nativeAssertionsExpected:509,nativePhasesExpected:37,functionalExpected:10,securityExpected:17});
}
main().catch(error=>{json('affected-preparation-chain-failure-01.json',{status:'FAIL_OR_INCOMPLETE_NO_LATER_PHASES',observedAt:new Date().toISOString(),results,reason:typeof error.code==='string'?error.code:'VERIFICATION_REFUSED',signalsRequested:0});console.error('F27 affected chain refused; raw evidence retained, no automatic retry.');process.exitCode=1;}).finally(()=>{clearInterval(keep);});
