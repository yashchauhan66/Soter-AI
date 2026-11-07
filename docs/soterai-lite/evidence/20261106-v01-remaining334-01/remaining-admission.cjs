'use strict';
// Read-only current admission. Import never launches Code or package code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=name=>path.join(__dirname,name),commonFile=path.resolve(__dirname,'../20261106-v01-current-01/v01-admission.cjs');
const read=file=>JSON.parse(fs.readFileSync(path.resolve(repo,file),'utf8').replace(/^\uFEFF/,''));
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function fact(file){file=path.resolve(repo,file);const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink());const raw=fs.readFileSync(file);assert.equal(st.size,raw.length);return{path:path.relative(repo,file).replaceAll('\\','/'),bytes:raw.length,sha256:sha(raw)};}
function pin(row){const current=fact(row.path);assert.equal(current.bytes,row.bytes,row.path);assert.equal(current.sha256,row.sha256,row.path);return path.resolve(repo,row.path);}
const remainingIds=['logs','owned-output','artifact','streaming-output','vault-runtime','cmd','gitbash','history','ci','service-account','registry','terraform','container','source','hygiene','vault'];
function binding(){
 const b=read(own('binding.json'));assert.equal(b.status,'CURRENT_ORIGINAL_REMAINING16_334_PREPARED_NOT_RUN');
 pin(b.common);assert.equal(path.resolve(repo,b.common.path),commonFile);pin(b.commonBinding);
 const current=require(commonFile).binding();assert.equal(current.sourceProof.sha256,'23fd63bb04122bf055f656a77424085b75ff3e3c813121c15034cd209fd1c8f6');assert.equal(current.vsix.sha256,'011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec');
 for(const key of ['sourceProof','vsix','code','runtimes'])assert.deepEqual(b[key],current[key]);assert.equal(b.hostVersion,'1.145.1');assert.equal(b.frontendSha256,current.frontendSha256);assert.equal(b.extractedRoot,current.extractedRoot);
 assert.equal(b.driverProvenance.sha256,'8505f71d4f4d08b986614a09fd6e4bdb6ffbc79778cb8319cc45e194dcd9a5d9');const p=read(pin(b.driverProvenance));assert.equal(p.drivers.length,20);
 for(const row of [...p.drivers,...p.sourceInputs,...p.auxiliaryInputs,...b.vendorInputs,...b.fixtureInputs])pin(row);
 const proof=read(pin(current.sourceProof));for(const row of p.sourceInputs){const tested=proof.files.find(x=>x.path===row.path);if(tested){assert.equal(tested.sha256,row.sha256);assert.equal(tested.bytes,row.bytes);}}
 const contract=read(pin(b.contract));assert.equal(contract.originalFamilies,20);assert.equal(contract.originalAssertions,509);assert.equal(contract.originalPhases,37);
 const accepted=read(pin(b.accepted175));assert.equal(accepted.status,'PASS_CURRENT_AFFECTED175_FUNCTIONAL10_SECURITY17_BASELINE_ONLY');assert.equal(accepted.sourceProof.sha256,current.sourceProof.sha256);assert.equal(accepted.vsix.sha256,current.vsix.sha256);assert.equal(accepted.hostVersion,b.hostVersion);assert.equal(accepted.nativeChecks,175);assert.equal(accepted.nativePhases,8);
 accepted.evidence.forEach(pin);assert.deepEqual(accepted.families.map(f=>f.id),['ps51','editor','mcp','retained']);
 for(const f of accepted.families)for(const phase of f.phases){const result=read(pin(phase.result)),expected=contract.families.find(x=>x.id===f.id).phases.find(x=>x.phase===phase.phase);assert.deepEqual(result.observations.map(({id,scope})=>({id,scope})),expected.observations);assert(result.observations.every(row=>row.status==='PASS'));}
 assert.deepEqual(b.families.map(f=>f.id),remainingIds);assert.equal(b.families.reduce((sum,f)=>sum+f.assertions,0),334);assert.equal(b.families.reduce((sum,f)=>sum+f.phases,0),29);
 for(const f of b.families){pin(f.helper);pin(f.originalHelper);pin(f.driver);const original=fs.readFileSync(path.resolve(repo,f.originalHelper.path),'utf8');const expected=original.replaceAll('affected-native-binding-current-01.ps1','remaining-native-binding-01.ps1');assert.equal(fs.readFileSync(path.resolve(repo,f.helper.path),'utf8'),expected,'Only current admission reference may change: '+f.id);assert(p.drivers.some(row=>row.path===f.driver.path&&row.sha256===f.driver.sha256));}
 return b;
}
module.exports={repo,own,read,sha,fact,pin,binding};
if(require.main===module){try{const b=binding();console.log(process.argv.includes('--emit-binding')?JSON.stringify(b):JSON.stringify({status:'PASS_READ_ONLY_REMAINING334_ADMISSION',newFamilies:16,newAssertions:334,newPhases:29,reusedSameCandidateAssertions:175,nativeLaunches:0}));}catch(error){console.error(error);process.exitCode=1;}}
