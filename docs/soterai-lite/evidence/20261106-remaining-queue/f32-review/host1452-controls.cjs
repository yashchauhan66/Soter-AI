'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const G=require('./prepare-host1452-successor.cjs');
const BASE=path.resolve(__dirname,'../../20261103-f32-lifecycle-2e95d6a4');
const host={version:G.VERSION,commit:G.COMMIT,appRoot:G.APP,executable:{path:G.CODE,bytes:238888888,sha256:'a'.repeat(64)}};
const sources=G.buildSources(host);let passed=1;
for(const change of [h=>h.version='1.145.1',h=>h.commit='0'.repeat(40),h=>h.appRoot+='-wrong',h=>h.executable.path='C:\\other.exe',h=>h.executable.sha256='bad',h=>h.executable.bytes=1]){
 const bad=structuredClone(host);change(bad);assert.throws(()=>G.buildSources(bad));passed++;
}
assert(sources['native-owned-gui-phase-proposed-10.cjs'].includes("'"+'a'.repeat(64)+"'"));
assert(!sources['native-owned-gui-phase-proposed-10.cjs'].includes('238751552'));passed+=2;
assert.equal(sources['installed-owner-custody-proposed-08.ps1'].replaceAll("'1.145.2'","'1.145.1'"),fs.readFileSync(path.join(BASE,'installed-owner-custody-proposed-07.ps1'),'utf8').replaceAll('\r\n','\n'));passed++;
const runner=sources['run-installed-lifecycle-proposed-10.cjs'];
const start=runner.indexOf('function verifyUnconsumedExtra09(a)'),end=runner.indexOf('function reviewedAdmission',start);
function fixture(){
 const admission={path:path.join(BASE,'installed-extra09-admission.json'),sha256:'old-admission'};
 const verification={status:'PASS_EXACT_EXTRA09_STATIC_VERIFICATION_NATIVE_NOT_RUN',admission,nativeLaunches:0};
 const old={status:'ROOT_REVIEWED_F32_INSTALLED_EXTRA09_FINAL_INPUTS',runRoot:'old-root',sourceProof:{sha256:'source'},fullAcceptance:{sha256:'full'},currentVsix:{sha256:'vsix'},oldVsix:{sha256:'oldvsix'},notificationAwaitRegression:{sha256:'regression'},fixtures:{test:{path:'old-helper'}},vendorReceipt:{sha256:'old-vendor'}};
 const a={...structuredClone(old),runRoot:'new-root',vendorReceipt:{sha256:'new-vendor'},supersededExtra09:{admission,staticVerification:{path:'verification'}}};
 return{a,old,verification,present:new Set()};
}
function invoke(f){
 const context={assert,path,__dirname:BASE,fs:{existsSync:file=>f.present.has(file)},pin:()=>{},pinnedJson:row=>row.path==='verification'?f.verification:f.old};
 vm.runInNewContext(runner.slice(start,end)+'\nverifyUnconsumedExtra09',context)(f.a);
}
invoke(fixture());passed++;
for(const change of [f=>f.present.add(path.join(BASE,'installed-extra09-consumed.json')),f=>f.present.add('old-root'),f=>f.a.runRoot='old-root',f=>f.a.currentVsix.sha256='different',f=>f.a.sourceProof.sha256='different',f=>f.a.vendorReceipt.sha256='old-vendor',f=>f.verification.nativeLaunches=1]){
 const f=fixture();change(f);assert.throws(()=>invoke(f));passed++;
}
console.log(JSON.stringify({status:'PASS_HOST1452_PREPARATION_CONTROLS_ONLY',passed,failed:0,syntheticHostOnly:true,nativeLaunches:0,signalsRequested:0,generatedAdmissions:0}));
