'use strict';
// Immutable evidence preparation only; no subprocess or native launch.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const repo=path.resolve(__dirname,'../../../../..'),out=path.join(repo,'docs/soterai-lite/evidence/20261106-v01-remaining334-01'),own=n=>path.join(out,n);
const C=require(own('remaining-admission.cjs')),{fact,pin,read}=C;
const currentDir=path.join(repo,'docs/soterai-lite/evidence/20261106-v01-current-01'),priorDir=path.join(repo,'docs/soterai-lite/evidence/20261104-final-gate-readiness');
const current=require(path.join(currentDir,'v01-admission.cjs')).binding();
const put=(name,data)=>{fs.writeFileSync(own(name),typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data,null,2)+'\n',{flag:'wx'});return fact(own(name));};
assert(!fs.existsSync(own('binding.json')),'Preparation is one immutable packet');
const prior=read(path.join(priorDir,'prepared-final-host-binding-02.json')),provenance=read(pin(prior.driverProvenance));
assert.equal(prior.driverProvenance.sha256,'8505f71d4f4d08b986614a09fd6e4bdb6ffbc79778cb8319cc45e194dcd9a5d9');
for(const row of [...provenance.drivers,...provenance.sourceInputs,...provenance.auxiliaryInputs])pin(row);
const baselineFile=path.join(priorDir,'affected-acceptance-current-01.json'),baseline=read(baselineFile),accepted175File=path.join(currentDir,'affected-acceptance.json'),accepted175=read(accepted175File);
assert.equal(baseline.families.length,20);assert.equal(baseline.nativeChecks,509);assert.equal(accepted175.nativeChecks,175);assert.equal(accepted175.vsix.sha256,current.vsix.sha256);assert.equal(accepted175.sourceProof.sha256,current.sourceProof.sha256);
const contracts=[];
for(const family of prior.families){
 const old=baseline.families.find(x=>x.id===family.id);assert(old);assert.equal(old.checks,family.assertions);assert.equal(old.phases.length,family.phases);
 const phases=old.phases.map(phase=>{const result=read(pin(phase.result));assert.equal(phase.driverSha256,family.driver.sha256);assert.equal(result.observations.length,phase.checks);return{phase:phase.phase,checks:phase.checks,originalResult:phase.result,observations:result.observations.map(({id,scope})=>({id,scope}))};});
 contracts.push({id:family.id,assertions:family.assertions,driver:family.driver,phases});
}
const contract=put('assertion-contracts.json',{status:'UNCHANGED_DRIVER_ASSERTION_IDENTITIES_ONLY_NO_HISTORICAL_RESULT_REUSE',originalFamilies:20,originalAssertions:509,originalPhases:37,baseline:fact(baselineFile),families:contracts});
const skip=new Set(accepted175.families.map(f=>f.id));assert.deepEqual([...skip],['ps51','editor','mcp','retained']);
const families=[];
for(const family of prior.families.filter(f=>!skip.has(f.id))){
 const original=fs.readFileSync(pin(family.helper),'utf8');assert(original.includes('affected-native-binding-current-01.ps1'));
 const changed=original.replaceAll('affected-native-binding-current-01.ps1','remaining-native-binding-01.ps1');
 const bootstrap=/\$taskBootstrap=@'\r?\n([\s\S]*?)\r?\n'@/.exec(changed);assert(bootstrap,'Original bootstrap required');new vm.Script(bootstrap[1],{filename:family.id+'-bootstrap.cjs'});
 families.push({...family,originalHelper:family.helper,helper:put('remaining-'+family.id+'-01.ps1',changed),onlyDelta:'Current admission reference only; all original native driver/assertion/bootstrap/settings/phase bounds are unchanged.'});
}
assert.equal(families.length,16);assert.equal(families.reduce((sum,f)=>sum+f.assertions,0),334);assert.equal(families.reduce((sum,f)=>sum+f.phases,0),29);
put('content-inspection.json',fs.readFileSync(path.join(currentDir,'content-inspection.json')));
put('affected-preparation-pipe-ownership-01.ps1',fs.readFileSync(path.join(currentDir,'affected-preparation-pipe-ownership-01.ps1')));
let shared=fs.readFileSync(path.join(currentDir,'affected-native-binding-05.ps1'),'utf8');
shared=shared.replace("'v01-admission.cjs'","'remaining-admission.cjs'");
assert(shared.includes('45d85d8fdaefa9d5cec58706d660730a0f386b60911e43868ccad344924838af'));
shared=shared.replace('45d85d8fdaefa9d5cec58706d660730a0f386b60911e43868ccad344924838af',fact(own('remaining-admission.cjs')).sha256);
put('remaining-native-binding-01.ps1',shared);
const vendorInputs=prior.vendorFacts.filter(row=>/^C:\\Program Files\\(?:Git|WindowsPowerShell)\\/i.test(row.path));vendorInputs.forEach(pin);
const fixtureNames=[...families.map(f=>path.basename(f.helper.path)),'remaining-native-binding-01.ps1','remaining-admission.cjs','affected-preparation-pipe-ownership-01.ps1','content-inspection.json','assertion-contracts.json','run-remaining334.cjs','verify-remaining334.cjs'];
const binding=put('binding.json',{...current,status:'CURRENT_ORIGINAL_REMAINING16_334_PREPARED_NOT_RUN',common:fact(path.join(currentDir,'v01-admission.cjs')),commonBinding:fact(path.join(currentDir,'binding.json')),driverProvenance:prior.driverProvenance,vendorInputs,contract,accepted175:fact(accepted175File),families,fixtureInputs:fixtureNames.map(n=>fact(own(n))),preparationSource:fact(__filename),oldHostResultsReused:0,alreadyExecutedCurrentCandidateAssertions:175,remainingNativeAssertions:334,remainingNativePhases:29,limits:'Original LOW scripted native API controls. Same-candidate175 accepted; only remaining16 families execute. No authenticated provider/human/all-descendant/OS guarantee.'});
const validated=C.binding();put('preparation.json',{status:'PREPARED_CURRENT16_REMAINING334_NOT_NATIVE_RUN',binding,sourceProof:current.sourceProof,vsix:current.vsix,hostVersion:current.hostVersion,originalDriverSourceRowsRehashed:provenance.sourceInputs.length,auxiliaryRowsRehashed:provenance.auxiliaryInputs.length,originalDriverBytesPreserved:20,remainingFamilies:validated.families.length,remainingAssertions:334,remainingPhases:29,reusedSameCandidate175:fact(accepted175File),bootstrapSyntaxPass:16,nativeLaunches:0});
console.log(JSON.stringify({status:'PREPARED_CURRENT16_REMAINING334_NOT_NATIVE_RUN',binding,remainingFamilies:16,remainingAssertions:334,remainingPhases:29,nativeLaunches:0}));
