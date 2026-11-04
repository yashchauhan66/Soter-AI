'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),G=require('./affected-current-admission-proposed-02.cjs'),base=G.binding(),vendor=G.read(G.location(base.hostReview));
const own=n=>path.join(__dirname,'f28-current-01',n),put=(n,v)=>fs.writeFileSync(own(n),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'}),b=structuredClone(G.read(own('native-binding-current-01.json')));
const fileMap=Object.fromEntries(['current-admission-01.cjs','native-admission-current-01.ps1','native-launch-current-01.ps1','run-native-current-01.cjs','native-binding-current-01.json','native-materialization-current-01.json','native-consumption-current-01.json','native-acceptance-current-01.json','native-failure-current-01.json'].map(n=>[n,n.replace('-01.','-02.')]));
const jsonFacts=b.jsonBuiltinFacts.map(r=>{const p=r.path.replace('261c84cb1e','a717861c07'),f=G.fact(p);return{...f,path:p};});jsonFacts.forEach(G.pin);
const jsonRoot=vendor.currentHost.appRoot,changes=[];
for(const name of ['current-admission-01.cjs','native-admission-current-01.ps1','native-launch-current-01.ps1','run-native-current-01.cjs']){
 let s=fs.readFileSync(own(name),'utf8');const original=s;
 for(const[a,z]of Object.entries(fileMap))s=s.split(a).join(z);
 for(const[a,z]of [['affected-current-admission-proposed-01.cjs','affected-current-admission-proposed-02.cjs'],['29dce5ff69759fd382c3917bb70373fdcb40933a225f24867caaf77d491530ae','4ed2dcecd94855806b4cf4dee239b8e51b9d1fb6d190229ae08b76f8174153dc'],['1.144.1','1.145.0'],['261c84cb1e','a717861c07'],['af032b86db394d21ba86872f4237a11b8395d2f57e8187963a3718a2cc6666ad',vendor.currentHost.executable.sha256],['238751552',String(vendor.currentHost.executable.bytes)]]){const n=s.split(a).length-1;if(n){assert(n<=12);changes.push({file:name,from:a,to:z,count:n});s=s.split(a).join(z);}}
 if(name==='native-launch-current-01.ps1'){
  const start=s.indexOf('const jsonBuiltinPins = ['),end=s.indexOf(';',start)+1;assert(start>0&&end>start);
  const pins=jsonFacts.map(r=>({relative:path.relative(path.join(jsonRoot,'extensions/json-language-features'),r.path).replaceAll('\\','/'),bytes:r.bytes,sha256:r.sha256}));
  assert.deepEqual(pins.map(p=>p.relative),['package.json','client/dist/node/jsonClientMain.js','server/package.json','server/dist/node/jsonServerMain.js']);
  s=s.slice(0,start)+'const jsonBuiltinPins = '+JSON.stringify(pins,null,2)+';'+s.slice(end);
 }
 assert.notEqual(s,original);put(fileMap[name],s);
}
const priorProvenance=b.driverProvenance,provenance=G.read(G.location(priorProvenance));
put('driver-provenance-current-02.json',{...provenance,priorHostPreparation:priorProvenance,launcher:G.fact(own('native-launch-current-02.ps1')),jsonBuiltinAppRoot:jsonRoot,jsonBuiltinFacts:jsonFacts,hostUpdate:'EXTERNAL_11441_TO_11450_BEFORE_ANY_CURRENT_F28_NATIVE_LAUNCH',onlyLauncherDeltas:[...provenance.onlyLauncherDeltas,'Current1.145.0/a717 JSON builtin files and distinct02 receipt authority'],nativeLaunches:0});
for(const k of ['sourceProof','qualification','content','vsix','frontendSha256','extractedRoot','hostReview','runtimes'])b[k]=base[k];
b.guard=G.fact(own('current-admission-02.cjs'));b.admission=G.fact(own('native-admission-current-02.ps1'));b.candidate=G.fact(own('native-launch-current-02.ps1'));b.driverProvenance=G.fact(own('driver-provenance-current-02.json'));b.jsonBuiltinAppRoot=jsonRoot;b.jsonBuiltinFacts=jsonFacts;
b.fixtureInputs=['current-admission-02.cjs','native-admission-current-02.ps1','run-native-current-02.cjs'].map(n=>G.fact(own(n)));b.hostRebind={old:'1.144.1',new:'1.145.0',priorBinding:G.fact(own('native-binding-current-01.json')),nativeLaunches:0};put('native-binding-current-02.json',b);
const binding=G.fact(own('native-binding-current-02.json'));require(own('current-admission-02.cjs')).binding(binding.sha256);put('host-refresh-current-02.json',{status:'PASS_F28_CURRENT_11450_PRELAUNCH_STATIC_REBIND',observedAt:new Date().toISOString(),binding,changes,original30:'UNCHANGED',peer:'UNCHANGED',nativeLaunches:0,signalsRequested:0});console.log(JSON.stringify({status:'PASS_F28_CURRENT_11450_PRELAUNCH_REBIND',binding}));
