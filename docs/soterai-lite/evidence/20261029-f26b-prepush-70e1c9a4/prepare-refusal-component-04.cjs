'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const own=n=>path.join(__dirname,n);let current=fs.readFileSync(own('native-refusal-fixture.component-03.cjs'),'utf8');
const before=' driver=vm.runInNewContext(fixture,scope,{timeout:1000});',after=" const assertionFailures=[];scope.assert=new Proxy(assert,{get(target,name){const value=Reflect.get(target,name);return typeof value==='function'?function(...args){try{return Reflect.apply(value,target,args);}catch(error){assertionFailures.push({method:String(name),message:String(error.message).slice(0,400)});throw error;}}:value;}});\n"+before;
assert.equal(current.split(before).length,2);current=current.replace(before,after);
const end=' finally{await owner.close();}';assert.equal(current.split(end).length,2);current=current.replace(end," catch(error){if(Object.keys(options).length===0)console.error(JSON.stringify({componentDiagnostics:true,outcome,statusCode,signCalls,responseBytes:body?.length,headers,wire:wires[0],assertionFailures}));throw error;}\n"+end);
fs.writeFileSync(own('native-refusal-fixture.component-04.cjs'),current,{flag:'wx'});
