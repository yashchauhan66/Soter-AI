'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),G=require('./affected-current-admission-proposed-02.cjs');
const{own,repo,read,fact}=G,b=structuredClone(read(own('f05-current-binding-02.json'))),base=G.binding(),vendor=read(G.location(base.hostReview));
function all(s,a,v,count){assert.equal(s.split(a).length-1,count,a);return s.split(a).join(v);}
let js=fs.readFileSync(own('run-f05-current-proposed-02.cjs'),'utf8'),ps=fs.readFileSync(own('f05-current-proposed-02.ps1'),'utf8');
js=all(js,'affected-current-admission-proposed-01.cjs','affected-current-admission-proposed-02.cjs',1);js=all(js,'29dce5ff69759fd382c3917bb70373fdcb40933a225f24867caaf77d491530ae','4ed2dcecd94855806b4cf4dee239b8e51b9d1fb6d190229ae08b76f8174153dc',1);
js=all(js,'f05-current-binding-02.json','f05-current-binding-03.json',2);js=all(js,'f05-current-proposed-02.ps1','f05-current-proposed-03.ps1',1);js=all(js,'1.144.1','1.145.0',1);js=all(js,'261c84cb1e','a717861c07',1);
for(const n of ['consumption','acceptance','failure'])js=all(js,'f05-current-'+n+'-02.json','f05-current-'+n+'-03.json',1);js=all(js,"name:'f05-current-native-02'","name:'f05-current-native-03'",1);
ps=all(ps,'f05-current-binding-02.json','f05-current-binding-03.json',1);ps=all(ps,'run-f05-current-proposed-02.cjs','run-f05-current-proposed-03.cjs',1);ps=all(ps,'1.144.1','1.145.0',3);
fs.writeFileSync(own('run-f05-current-proposed-03.cjs'),js,{flag:'wx'});fs.writeFileSync(own('f05-current-proposed-03.ps1'),ps,{flag:'wx'});
for(const k of ['sourceProof','qualification','content','vsix','runtimes','hostReview','extractedRoot','frontendSha256'])b[k]=base[k];
b.code=vendor.currentHost.executable;b.codeVersion='1.145.0';b.vendorJsonRoot=vendor.currentHost.appRoot;b.vendorJsonPins=[vendor.currentHost.electronApplicationPackage,vendor.currentHost.product];b.gate=fact(own('affected-current-admission-proposed-02.cjs'));b.affectedBinding=fact(own('prepared-final-host-binding-02.json'));
b.fixtureInputs=b.fixtureInputs.map(r=>r.path.endsWith('/run-f05-current-proposed-02.cjs')?fact(own('run-f05-current-proposed-03.cjs')):r.path.endsWith('/f05-current-proposed-02.ps1')?fact(own('f05-current-proposed-03.ps1')):r);
b.hostRebind={reason:'EXTERNAL_CODE_UPDATE_BEFORE_ANY_F05_NATIVE_LAUNCH',oldHost:'1.144.1',newHost:'1.145.0',priorBinding:fact(own('f05-current-binding-02.json')),originalH01H10:'UNCHANGED',nativeLaunches:0};
fs.writeFileSync(own('f05-current-binding-03.json'),JSON.stringify(b,null,2)+'\n',{flag:'wx'});const result=require('./run-f05-current-proposed-03.cjs').admission();
console.log(JSON.stringify({status:'PASS_CURRENT_F05_11450_PACKET_PRELAUNCH_REBIND',binding:fact(own('f05-current-binding-03.json')),runner:fact(own('run-f05-current-proposed-03.cjs')),bindingSha256:result.bindingSha256,nativeLaunches:0}));
