'use strict';
// Metadata successors only. The failed native06 packet remains immutable.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(own(n),'utf8').replace(/^\uFEFF/,'')),put=(n,s)=>fs.writeFileSync(own(n),s,{flag:'wx'}),save=(n,v)=>put(n,JSON.stringify(v,null,2)+'\n');
const fact=file=>{const b=fs.readFileSync(file);return{path:path.relative(repo,file).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)};};
const priorSha='293aa9d49b57495fea319fb7305dce7eb86c14a84e89913a46b72648cff3c4ed',nativeSha='417f248b31a4f994ed9b19e79e910c84db229c03e0172039db07a1e114fa6216';
assert.equal(sha(fs.readFileSync(own('native-launch-binding-07.json'))),nativeSha);
const oldScope=read('affected-scope-03.json'),helperRows=[];
const helperNames=[...new Set([...oldScope.families.map(row=>row.helper),'affected-functional10-01.ps1','affected-security17-01.ps1','affected-functional-security-01.ps1'])];
for(const name of helperNames){
 const before=fs.readFileSync(own(name),'utf8');let current=before.replaceAll('affected-native-binding-01.ps1','affected-native-binding-02.ps1');
 if(name==='affected-functional-security-01.ps1')current=current.replaceAll('affected-functional10-01.ps1','affected-functional10-02.ps1').replaceAll('affected-security17-01.ps1','affected-security17-02.ps1');
 const next=name.replace(/-01\.ps1$/,'-02.ps1');assert.notEqual(next,name);
 let reverse=current.replaceAll('affected-native-binding-02.ps1','affected-native-binding-01.ps1');
 if(name==='affected-functional-security-01.ps1')reverse=reverse.replaceAll('affected-functional10-02.ps1','affected-functional10-01.ps1').replaceAll('affected-security17-02.ps1','affected-security17-01.ps1');
 assert.equal(reverse,before,'All original helper assertions must remain byte exact.');put(next,current);helperRows.push({source:fact(own(name)),target:fact(own(next)),assertionReversalByteExact:true});
}
save('affected-scope-04.json',{...oldScope,families:oldScope.families.map(row=>({...row,helper:row.helper.replace(/-01\.ps1$/,'-02.ps1')})),driverInventory:'native-driver-provenance-04.json',componentGate:'Exact native07 binding417f248b acceptance36/closure required; failed native06 is not a substitute'});
let admission=fs.readFileSync(own('affected-current-admission-04.cjs'),'utf8');
for(const[from,to]of [['native-launch-binding-06.json','native-launch-binding-07.json'],[priorSha,nativeSha],['native-driver-provenance-03.json','native-driver-provenance-04.json'],['affected-scope-03.json','affected-scope-04.json'],['affected-packet-binding-03.json','affected-packet-binding-04.json']]){assert(admission.includes(from));admission=admission.replaceAll(from,to);}
put('affected-current-admission-05.cjs',admission);
const guardFact=fact(own('affected-current-admission-05.cjs')),priorGuardSha=sha(fs.readFileSync(own('affected-current-admission-04.cjs')));
let shared=fs.readFileSync(own('affected-native-binding-01.ps1'),'utf8');
for(const[from,to]of [['native-launch-binding-06.json','native-launch-binding-07.json'],[priorSha,nativeSha],['affected-current-admission-04.cjs','affected-current-admission-05.cjs'],[priorGuardSha,guardFact.sha256]]){assert(shared.includes(from));shared=shared.replaceAll(from,to);}
put('affected-native-binding-02.ps1',shared);
(async()=>{
 const b=await require(own('affected-current-admission-05.cjs')).validateNativeBinding(nativeSha);
 const inputs=[...helperRows.map(row=>row.target),...['affected-native-binding-02.ps1','affected-current-admission-05.cjs','affected-preparation-pipe-ownership-01.ps1','affected-preparation-functional10-driver-01.js','affected-preparation-security17-driver-01.js'].map(n=>fact(own(n)))];
 save('affected-packet-binding-04.json',{...b,status:'F26B_AFFECTED_CURRENT_PACKET_BOUND_NOT_RUN',observedAt:new Date().toISOString(),fixtureInputs:inputs,scope:fact(own('affected-scope-04.json')),toolInventory:fact(own('accessibility-tooling-code1144-01.json')),componentGate:'Only exact accepted native-component-acceptance-01 binding417f248b/36checks/allOwnersClosed/bothEOF permits execution',precommit:'USER_DEFERRED_UNVERIFIED_NO_SUBSTITUTE',configuredPush:'NOT_AUTHORIZED_NOT_RUN'});
 const scope=read('affected-scope-04.json'),provenance=read('native-driver-provenance-04.json');
 const families=scope.families.map(row=>{const driver=provenance.drivers.find(r=>path.basename(r.path)===row.driver);assert(driver);return{...row,driver:fact(own(driver.path)),helper:fact(own(row.helper))};});
 save('affected-current-materialization-04.json',{status:'CURRENT1070_VSIX6C_BOUND_AFFECTED20_509_37_NOT_RUN',observedAt:new Date().toISOString(),families,precommitExcluded:true,deferredScope:scope.deferred,vsix:b.vsix,sourceProof:b.sourceProof,bindingHelper:fact(own('affected-native-binding-02.ps1')),outputs:helperRows,packet:fact(own('affected-packet-binding-04.json')),admission:guardFact,componentGate:nativeSha,configuredPush:'NOT_AUTHORIZED_NOT_RUN',signalsRequested:0});
 save('affected-native07-preparation-04.json',{status:'CURRENT_NATIVE07_AFFECTED20_509_37_PLUS_FUNCTIONAL10_SECURITY17_PREPARED_NOT_RUN',observedAt:new Date().toISOString(),packet:fact(own('affected-packet-binding-04.json')),admission:guardFact,materialization:fact(own('affected-current-materialization-04.json')),helperBinding:fact(own('affected-native-binding-02.ps1')),sourceProof:b.sourceProof,vsix:b.vsix,helperRows,sourceAssertionChanges:0,hostVersion:'1.144.0',nativeRuns:0,signalsRequested:0});
 console.log(JSON.stringify({status:'CURRENT_NATIVE07_AFFECTED_PACKET_PREPARED_NOT_RUN',families:20,assertions:509,phases:37,allHelperAssertionsByteExact:true,packet:fact(own('affected-packet-binding-04.json'))}));
})().catch(error=>{console.error(error);process.exitCode=1;});
