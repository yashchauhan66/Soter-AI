'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n),old=fs.readFileSync(own('native-refusal-fixture.component-01.cjs'),'utf8');let current=old;
for(const[from,to]of [
 ['body=options.body??Buffer.from(value);','body=Buffer.from(value);'],
 [' const owner=new exports.PrePushOwnerService('," const privateKey=crypto.generateKeyPairSync('ed25519').privateKey;\n const owner=new exports.PrePushOwnerService("],
 ["loadKey:async()=>crypto.generateKeyPairSync('ed25519').privateKey","loadKey:async()=>privateKey"],
 ['driver.observeRequest(req,res);handler(req,res);', 'driver.observeRequest(req,res);const observedEnd=res.end;res.end=function(value,...rest){return Reflect.apply(observedEnd,this,[options.body??value,...rest]);};handler(req,res);']
]){assert.equal(current.split(from).length,2);current=current.replace(from,to);}
fs.writeFileSync(own('native-refusal-fixture.component-02.cjs'),current,{flag:'wx'});
console.log('Component seam correction: retain one key across service lifetime; mutate response body before actual observer, not after it. Earlier results retained, not a native run.');
