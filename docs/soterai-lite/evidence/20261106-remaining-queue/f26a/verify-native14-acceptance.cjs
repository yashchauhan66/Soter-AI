'use strict';
// Read actual retained results only. No native launch, package execution or signals.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../../..'), own=name=>path.join(__dirname,name);
const run=own('f26a-precommit-native-20261106T134427Z-39d7828b'), outer=own('native14-owned-run');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
function fact(file){file=path.resolve(repo,file);const stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink());const raw=fs.readFileSync(file);assert.equal(raw.length,stat.size);return{path:file,bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')};}
function pin(row){const observed=fact(row.path);assert.equal(observed.bytes,row.bytes,row.path);assert.equal(observed.sha256,row.sha256,row.path);return observed;}
function expect(row,values,label){for(const[key,value]of Object.entries(values))assert.deepEqual(row[key],value,label+':'+key);}
function sameCopy(source,destination){const a=fact(source),b=fact(destination);assert.equal(a.bytes,b.bytes);assert.equal(a.sha256,b.sha256);return{actual:a,retained:b};}
function verify(){
 const preparation=read(own('native14-preparation.json'));pin(preparation.admission);pin(preparation.runner);
 const a=read(preparation.admission.path);assert.equal(a.vsix.sha256,'011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec');
 assert.equal(a.sourceInventory.sha256,'23fd63bb04122bf055f656a77424085b75ff3e3c813121c15034cd209fd1c8f6');
 assert.equal(a.driver.sha256,'8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced');
 for(const row of [a.vsix,a.sourceInventory,a.driver,a.semantic,a.code,a.git,a.manifest,a.offline,...a.runtimeFiles,...a.sourceFiles])pin(row);
 const semantic=read(a.semantic.path);pin({path:semantic.file,bytes:semantic.bytes,sha256:semantic.sha256});
 assert.equal(semantic.sha256,'d773858448cd4969d47d258915098519acb856f1afa28f6ca6cab2c0a8e33741');
 const freeze=read(path.join(run,'freeze.json')),summary=read(path.join(run,'summary.json'));
 expect(summary,{status:'PASS_SCOPED',nativeChecks:34,vsixSha256:a.vsix.sha256,independence:'LOW',nestedClientClosure:'NOT_INFERRED_FROM_OWNER_GIT;SEE_SEPARATE_DIRECT_CLIENT_CONTROLS'},'summary');
 expect(freeze,{vsixSha256:a.vsix.sha256,hostProbeSha256:a.driver.sha256,launcherSha256:preparation.runner.sha256,sourceManifestSha256:a.manifest.sha256,codeExecutableSha256:a.code.sha256},'freeze');
 const root=freeze.executionEvidenceRoot;assert.equal(path.dirname(root),'D:\\SoterAI-Lite-test-profiles');assert.equal(path.basename(root),path.basename(run));
 const expectedRuntime=a.runtimeFiles.map(row=>({file:row.name,bytes:row.bytes,sha256:row.sha256}));
 assert.equal(expectedRuntime.length,4);const actualRuntimes=a.runtimeFiles.map(row=>pin({...row,path:path.join(root,'extension/dist',row.name)}));
 const original=pin({...a.manifest,path:path.join(run,'original-manifest.json')});
 const executionManifest=fact(path.join(root,'extension/package.json'));assert.equal(executionManifest.sha256,freeze.fixtureManifestSha256);
 const phases=[];
 for(const[phase,count,prefix]of[['primary',30,'F26A-HP'],['restart',4,'F26A-HR']]){
  const binding=summary.phases.find(row=>row.phase===phase);assert(binding);assert.equal(binding.passed,count);assert.equal(binding.result,path.join(root,phase+'-results.json'));
  const result=sameCopy(binding.result,path.join(run,phase+'-results.json'));assert.equal(result.actual.sha256,binding.sha256);
  const r=read(result.actual.path);
  expect(r,{phase,expectedChecks:count,passed:count,failed:0,notRun:0,hostVersion:'1.145.1',hostProbeSha256:a.driver.sha256,codeSha256:a.code.sha256,busyChildren:0,timedOutChildren:0,metadataLeak:false,parentEnvironmentUnchanged:true,independence:'LOW'},phase);
  assert.deepEqual(r.observations,semantic[phase].map((scope,index)=>({id:prefix+String(index+1).padStart(2,'0'),scope,status:'PASS'})));
  assert.deepEqual(r.runtimeBindings,expectedRuntime);assert.deepEqual(r.currentRuntimeBindings,expectedRuntime);
  expect(r,{extensionBundleSha256:a.runtimeFiles.find(row=>row.name==='extension.js').sha256,workerSha256:a.runtimeFiles.find(row=>row.name==='pre-commit-client.js').sha256},phase);
  assert.deepEqual(r.executionManifest,r.currentExecutionManifest);assert.equal(r.executionManifest.sha256,executionManifest.sha256);assert.equal(r.executionManifest.bytes,executionManifest.bytes);
  assert(r.children.length>0);for(const row of r.children)expect(row,{closed:true,signal:null,stdoutEOF:true,stderrEOF:true,signalsRequested:0,spawnFailed:false,streamError:false,overflow:false,timedOut:false,busy:false,parentEnvironmentUnchanged:true},phase+' child');
  const startFile=path.join(run,phase+'-owned-editor-start.json'),closeFile=path.join(run,phase+'-owned-editor-close.json'),absenceFile=path.join(run,phase+'-owned-editor-absence.json');
  const start=read(startFile),close=read(closeFile),absence=read(absenceFile);
  expect(start,{executable:a.code.path,signalsRequested:0,profile:path.join(root,'profile'),workspace:path.join(root,'workspace')},phase+' start');
  for(const[label,row]of[['close',close],['absence',absence]])expect(row,{pid:start.pid,executable:a.code.path,observedExit:true,exitCode:0,stdoutEOF:true,stderrEOF:true,timedOut:false,signalsRequested:0,ownedWindowClose:'workbench.action.closeWindow'},phase+' '+label);
  expect(absence,{pidAbsentTwice:true,streamsStable:true},phase+' absence');assert.equal(absence.pidAbsenceObservations.length,2);
  for(const row of absence.pidAbsenceObservations)expect(row,{pid:start.pid,absent:true},phase+' PID observation');
  assert(Date.parse(absence.pidAbsenceObservations[1].observedAt)>Date.parse(absence.pidAbsenceObservations[0].observedAt));
  assert.equal(absence.streams.length,2);const streams=absence.streams.map(pin);
  assert.deepEqual(streams.map(row=>path.basename(row.path)).sort(),[phase+'-stderr.txt',phase+'-stdout.txt']);
  phases.push({phase,assertions:count,ids:r.observations.map(row=>row.id),result,directChildren:r.children.length,start:fact(startFile),close:fact(closeFile),absence:fact(absenceFile),streams,nestedClientClosure:r.nestedClientClosure,notTested:r.notTested});
 }
 const offlineCopy=sameCopy(summary.actualOfflineEvidence,path.join(run,'precommit-owner-absent.json')),offline=read(offlineCopy.actual.path);
 expect(offline,{status:'ACTUAL_OWNER_ABSENT_BLOCKED',syntheticOnly:true},'offline');assert.deepEqual(offline.code,read(phases[0].absence.path));
 assert.equal(offline.primaryStateSha256,fact(path.join(run,'precommit-restart-state.json')).sha256);
 for(const key of ['head','source','index','hook'])assert.deepEqual(offline[key+'Before'],offline[key+'After']);
 expect(offline.owner,{closed:true,signal:null,stdoutEOF:true,stderrEOF:true,timedOut:false,signalsRequested:0,overflow:false,streamError:false,spawnFailed:false,ownerArgumentsHaveNoHooksOverride:true,nestedClientClosure:'NOT_INFERRED_FROM_OWNER_GIT'},'offline owner');
 assert(Number.isInteger(offline.owner.exitCode)&&offline.owner.exitCode!==0);assert.equal(offline.owner.executableSha256,a.git.sha256);
 for(const channel of ['stdout','stderr']){pin(offline.owner[channel]);sameCopy(offline.owner[channel].path,path.join(run,'precommit-owner-absent-'+channel+'.bin'));}
 const helperClose=read(path.join(run,'offline-helper-close.json'));expect(helperClose,{exitCode:0,observedExit:true,stdoutEOF:true,stderrEOF:true,timedOut:false,signalsRequested:0},'offline helper');
 const outerClose=read(path.join(outer,'close.json'));expect(outerClose,{actualClose:true,exitCode:0,signal:null,signalsRequested:0,status:'OUTER_LAUNCHER_CLOSED_ZERO_CHECK_INNER_NATIVE_SUMMARY'},'outer');
 const outerStreams=[];for(const channel of ['stdout','stderr']){const row=outerClose.streams[channel];expect(row,{eof:true,error:false},'outer '+channel);outerStreams.push(pin({...row,path:path.join(outer,channel+'.txt')}));}
 const proof=read(a.sourceInventory.path);
 return{status:'PASS_CURRENT_FINAL_CANDIDATE_ORIGINAL_NATIVE34',observedAt:new Date().toISOString(),verifier:fact(__filename),admission:preparation.admission,runner:preparation.runner,sourceProof:a.sourceInventory,sourceParent:proof.sourceParent,vsix:a.vsix,sourceFilesRehashed:a.sourceFiles.length,originalDriver:a.driver,originalSemantic:a.semantic,originalManifest:original,executionManifest,runtimeFiles:actualRuntimes,host:a.code,freeze:fact(path.join(run,'freeze.json')),summary:fact(path.join(run,'summary.json')),nativeChecks:34,passed:34,failed:0,notRun:0,phases,offline:{receipt:offlineCopy,ownerExitCode:offline.owner.exitCode,status:offline.status,helperClose:fact(path.join(run,'offline-helper-close.json'))},outer:{start:fact(path.join(outer,'start.json')),inputs:fact(path.join(outer,'inputs.json')),close:fact(path.join(outer,'close.json')),streams:outerStreams,elapsedMs:outerClose.elapsedMs},nativeLaunchesByVerifier:0,signalsRequested:0,independence:'LOW_SCRIPTED_NATIVE_API_DECISIONS',limits:['Nested client closure is not inferred from owning Git; original separate direct-client controls retain their own scope.','Developer bootstrap used exact four packaged runtimes.','Human usability, OS or all-descendant confinement, credential validity and other platforms remain unverified.']};
}
module.exports={verify};
if(require.main===module){try{const acceptance=verify();if(process.argv[2]==='--write'){fs.writeFileSync(own('native14-acceptance.json'),JSON.stringify(acceptance,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:acceptance.status,acceptance:fact(own('native14-acceptance.json')),nativeChecks:34,passed:34,failed:0}));}else console.log(JSON.stringify({status:acceptance.status,nativeChecks:34,passed:34,failed:0,nativeLaunches:0}));}catch(error){console.error(error);process.exitCode=1;}}
