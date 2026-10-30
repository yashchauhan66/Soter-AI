'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n);let current=fs.readFileSync(own('native-refusal-fixture.component-02.cjs'),'utf8');
for(const[from,to]of [
 ['let handler,driver,finishChild,body,statusCode,headers,signCalls=0;','let serviceSession,handler,driver,finishChild,body,statusCode,headers,signCalls=0;'],
 ["signHookDescriptor:()=>Buffer.from('{}')","signHookDescriptor:payload=>{serviceSession=payload.session;return Buffer.from('{}');}"],
 ['session:crypto.randomUUID(),nonce:crypto.randomUUID()','session:serviceSession,nonce:crypto.randomUUID()']
]){assert.equal(current.split(from).length,2);current=current.replace(from,to);}
fs.writeFileSync(own('native-refusal-fixture.component-03.cjs'),current,{flag:'wx'});
console.log('HTTP request seam now uses actual owner descriptor session, preserving real response session/nonce checks. Earlier seam failures retained.');
