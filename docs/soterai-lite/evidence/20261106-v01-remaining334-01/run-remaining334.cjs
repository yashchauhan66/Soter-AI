'use strict';
// Root coordinates the one serial run; existing same-candidate175 is not rerun.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function run(){
 const C=require('./remaining-admission.cjs'),{repo,own,read,fact,pin}=C,b=C.binding();
 const put=(name,value)=>fs.writeFileSync(own(name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 assert(!fs.existsSync(own('run-consumption.json')),'Existing attempt refuses automatic retry');
 const owner=path.join(repo,'docs/soterai-lite/evidence/20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');assert.equal(fact(owner).sha256,'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
 const phase=require(owner).phase,results=[];
 put('run-consumption.json',{status:'ONE_CURRENT_REMAINING334_SERIAL_ATTEMPT_CONSUMED',at:new Date().toISOString(),binding:fact(own('binding.json')),alreadyAccepted175:b.accepted175,signalsRequested:0});
 try{
  for(const family of b.families){
   C.binding();const before=new Set(fs.readdirSync(__dirname,{withFileTypes:true}).filter(row=>row.isDirectory()).map(row=>row.name));
   const name='remaining-'+family.id,args=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',pin(family.helper),'-CodePath',path.resolve(repo,b.code.path),'-HostTestsPath',pin(family.driver),'-ExtensionRoot',path.resolve(repo,b.extractedRoot),'-VsixPath',path.resolve(repo,b.vsix.path),'-ExpectedVsixSha256',b.vsix.sha256,'-ExpectedBundleSha256',b.frontendSha256];
   const r=await phase({executable:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',args,cwd:repo,env:process.env,run:__dirname,name,profile:'CURRENT_V01_REMAINING_SYNTHETIC_FAMILIES',deadlineMs:1800000});
   const result={name,family:family.id,status:r.closed.code===0&&r.closed.signal===null&&!r.deadline&&!r.error&&!r.overflow&&r.close.stdoutEOF&&r.close.stderrEOF?'CLOSED_ZERO_VERIFY_ASSERTIONS':'FAILED_OR_INCOMPLETE',at:new Date().toISOString(),directories:fs.readdirSync(__dirname,{withFileTypes:true}).filter(row=>row.isDirectory()&&!before.has(row.name)).map(row=>row.name),close:fact(own(name+'-owned-close.json')),signalsRequested:0};
   put(name+'-result.json',result);results.push(result);console.log(JSON.stringify(result));assert.equal(result.status,'CLOSED_ZERO_VERIFY_ASSERTIONS');C.binding();
  }
  put('run-result.json',{status:'ALL16_WRAPPERS_CLOSED_ASSERTION_VERIFICATION_PENDING',at:new Date().toISOString(),binding:fact(own('binding.json')),results,alreadyAccepted175:b.accepted175,releaseReady:false});
 }catch(error){put('run-failure.json',{status:'FAILED_OR_INCOMPLETE_NO_AUTOMATIC_RETRY',at:new Date().toISOString(),results,error:{name:error.name,message:error.message},signalsRequested:0});throw error;}
}
module.exports={run};if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
