// Bind already verified current artifact/drivers. No host launch.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fact=file=>{const b=fs.readFileSync(file);return{path:path.relative(repo,file).replace(/\\/g,'/'),bytes:b.length,sha256:sha(b)}};
const inspection=read(own('content-inspection-01.json'));assert.equal(inspection.status,'CONTENT_AND_OFFLINE_INVENTORY_PASS_NOT_NATIVE_OR_FEATURE_ACCEPTANCE');assert.equal(inspection.sourceCount,1016);
const provenance=read(own('native-driver-provenance-01.json'));assert.equal(provenance.drivers.length,22);
const compiled=read(own('compiled-runtime-binding-01.json'));
const base={status:'BOUND_CURRENT_F27_FULL02_EXACT_ATTEMPT01_NATIVE_NOT_RUN',observedAt:new Date().toISOString(),fileCount:1016,sourceProof:fact(own('full-inputs-04.json')),
 requiredReceipts:['compiler-06','backend-typecheck-03','backend-tests-03','full-tests-02','readiness-02','package-01','content-02','native-fixture-typecheck-01','native-build-01'].map(name=>fact(own(name+'.txt.result.json'))),
 serialResult:fact(own('serial-result-03.json')),driverProvenance:fact(own('native-driver-provenance-01.json')),vsix:fact(path.join(repo,inspection.vsix.output)),frontendSha256:inspection.vsix.extensionSha256,
 extractedRoot:inspection.extractedRoot,contentEntries:inspection.entries.map(row=>({...row,path:path.relative(repo,own('vsix-extracted-01/'+row.path)).replace(/\\/g,'/')})),
 runtimes:compiled.runtimes.map(row=>({...row,path:inspection.extractedRoot+'/dist/'+row.name})),hostReview:compiled.hostReview,
 historyModuleCheckpoint:fact(path.join(repo,'docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/start-checkpoint-01.json')),native06:'F26a_USER_DEFERRED_NOT_RUN',coverage:'NO_NATIVE_BEHAVIOR_PASS_YET'};
for(const [name,fixture,driver,primary,scope]of [['native-binding-01.json','f27-native01.host.ts','lite-f27-self-hygiene-host.js',17,'F27_INITIAL_OWNER_API_VERIFICATION'],['affected-history-binding-01.json','litePSReadLineHistory.proposal06.host.ts','lite-psreadline-history-host.js',23,'F27_AFFECTED_F26C_REGRESSION_NOT_EXTRA_F26C_IMPROVEMENT']]){
 const candidateFixture=provenance.auxiliaryInputs.find(row=>path.basename(row.path)===fixture);assert(candidateFixture);const record=provenance.drivers.find(row=>path.basename(row.path)===driver);assert(record);
 const b={...base,candidateFixture,newDriver:fact(path.join(__dirname,record.path)),nativeOracles:{primary,restart:5,total:primary+5},executionScope:scope};
 fs.writeFileSync(own(name),JSON.stringify(b,null,2)+'\n',{flag:'wx'});
}
console.log(JSON.stringify({status:'TWO_EXACT_NATIVE_BINDINGS_MATERIALIZED_NOT_RUN',vsix:base.vsix.sha256,drivers:22,native06:base.native06}));
