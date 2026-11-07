'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function verify(){
 const C=require('./remaining-admission.cjs'),{repo,own,read,sha,fact,pin}=C,b=C.binding(),contract=read(pin(b.contract)),evidence=new Map();
 const take=file=>{const row=fact(file);evidence.set(row.path,row);return row;};
 const expect=(row,values,label)=>{for(const[k,v]of Object.entries(values))assert.deepEqual(row[k],v,label+':'+k);};
 const root=read(own('run-result.json'));assert.equal(root.status,'ALL16_WRAPPERS_CLOSED_ASSERTION_VERIFICATION_PENDING');assert.deepEqual(root.results.map(r=>r.family),b.families.map(f=>f.id));
 const families=[];let nativeChecks=0,nativePhases=0;
 for(const f of b.families){
  const name='remaining-'+f.id,result=read(own(name+'-result.json')),close=read(own(name+'-owned-close.json'));assert.equal(result.status,'CLOSED_ZERO_VERIFY_ASSERTIONS');
  expect(close,{actualClose:true,exitCode:0,signal:null,stdoutEOF:true,stderrEOF:true,deadlineExceeded:false,overflow:false,streamError:false,signalsRequested:0},name);
  assert.deepEqual(close.streams.map(r=>r.name).sort(),['stderr','stdout']);for(const s of close.streams){assert.equal(s.bytes,s.observedBytes);pin({path:own(name+'-'+s.name+'.bin'),bytes:s.bytes,sha256:s.sha256});take(own(name+'-'+s.name+'.bin'));}
  for(const suffix of ['result.json','owned-close.json','owned-start.json'])take(own(name+'-'+suffix));
  const dirs=result.directories.map(n=>{assert.match(n,/^[A-Za-z0-9_-]+$/);return own(n);}).filter(d=>fs.existsSync(path.join(d,'summary.json')));assert.equal(dirs.length,1);const dir=dirs[0],summary=read(path.join(dir,'summary.json')),freeze=read(path.join(dir,'freeze.json')),expected=contract.families.find(row=>row.id===f.id);
  expect(summary,{status:'PASS_SCOPED',vsixSha256:b.vsix.sha256,extensionBundleSha256:b.frontendSha256,nativeChecks:f.assertions},f.id);assert.deepEqual(summary.phases.map(p=>p.phase),expected.phases.map(p=>p.phase));
  expect(freeze,{vsixSha256:b.vsix.sha256,hostProbeSha256:f.driver.sha256,codeExecutableSha256:b.code.sha256,codeProductVersion:b.hostVersion},f.id+' freeze');assert.equal(freeze.runtimeBindings.length,4);
  for(const row of freeze.runtimeBindings){const runtime=b.runtimes.find(r=>path.basename(r.path)===row.name);assert(runtime);expect(row,{bytes:runtime.bytes,sha256:runtime.sha256},row.name);assert(path.resolve(row.execution).toLowerCase().startsWith('d:\\soterai-lite-test-profiles\\'));pin({...runtime,path:row.execution});}
  let count=0;const phases=[];
  for(const p of summary.phases){
   const file=path.join(dir,p.phase+'-results.json'),r=read(file),spec=expected.phases.find(x=>x.phase===p.phase);assert.equal(sha(fs.readFileSync(file)),p.sha256);assert.equal(sha(fs.readFileSync(p.result)),p.sha256);
   expect(r,{phase:p.phase,failed:0,notRun:0,passed:spec.checks,hostVersion:b.hostVersion,extensionBundleSha256:b.frontendSha256,currentDeveloperBundleSha256:b.frontendSha256,hostProbeSha256:f.driver.sha256},f.id+' '+p.phase);assert(!r.driverFailure);
   assert.deepEqual(r.observations.map(({id,scope})=>({id,scope})),spec.observations);assert(r.observations.every(row=>row.status==='PASS'));assert.equal(new Set(r.observations.map(row=>row.id)).size,spec.checks);
   for(const suffix of ['owned-editor-close.json','helper-pipe-ownership.json']){const name=path.join(dir,p.phase+'-'+suffix),c=read(name);expect(c,{observedExit:true,exitCode:0,stdoutEOF:true,stderrEOF:true,signalsRequested:0},name);if(suffix.startsWith('helper'))assert.equal(c.status,'ACTUAL_CLOSE_AND_BOTH_EOF_BEFORE_DISPOSE');take(name);}
   for(const channel of ['stdout','stderr'])take(path.join(dir,p.phase+'-'+channel+'.txt'));
   assert(!fs.existsSync(path.join(dir,p.phase+'-driver-error.json')));phases.push({phase:p.phase,checks:spec.checks,result:take(file),actualResult:fact(p.result)});count+=spec.checks;nativePhases++;
  }
  assert.equal(count,f.assertions);nativeChecks+=count;families.push({id:f.id,checks:count,phases});take(path.join(dir,'summary.json'));take(path.join(dir,'freeze.json'));
 }
 assert.equal(nativeChecks,334);assert.equal(nativePhases,29);C.binding();const prior=read(pin(b.accepted175));
 for(const name of ['binding.json','preparation.json','run-consumption.json','run-result.json'])take(own(name));
 const result={status:'PASS_CURRENT_ORIGINAL20_AFFECTED509_WITH_BASELINE27',at:new Date().toISOString(),sourceProof:b.sourceProof,vsix:b.vsix,frontendSha256:b.frontendSha256,hostVersion:b.hostVersion,originalFamilies:20,nativeChecks:509,nativePhases:37,newFamilies:families,newNativeChecks:334,newNativePhases:29,alreadyExecutedSameCandidate:{acceptance:b.accepted175,nativeChecks:175,nativePhases:8,families:prior.families},functionalChecks:prior.functionalChecks,securityComparison:prior.securityComparison,toolRoutes:'SEPARATE_ACTUAL_TOOL_ACCEPTANCE_REQUIRED',f26aNative34:'SEPARATE_NATIVE14_ACCEPTANCE',independence:'LOW_SCRIPTED_NATIVE_API_DECISIONS',releaseReady:false,signalsRequested:0,evidence:[...evidence.values()]};
 fs.writeFileSync(own('affected509-acceptance.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
module.exports={verify};if(require.main===module){try{const r=verify();console.log(JSON.stringify({status:r.status,newNativeChecks:r.newNativeChecks,nativeChecks:r.nativeChecks,nativePhases:r.nativePhases,functionalChecks:r.functionalChecks,security:r.securityComparison.residuals}));}catch(error){console.error(error);process.exitCode=1;}}
