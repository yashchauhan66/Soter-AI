'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{own}=require('./native09-current-admission-01.cjs');
let body=fs.readFileSync(own('prepare-native12-result-tools-01.cjs'),'utf8');
const old="assert(body.includes('native09-current-binding-01.json'));";assert.equal(body.split(old).length,2);
body=body.replace(old,"assert(body.includes('C.guard()')); // Transition uses C.guard rather than a literal binding filename.");
const write="fs.writeFileSync(own(name),body,{flag:'wx'});outputs.push(fact(own(name)));";assert.equal(body.split(write).length,2);
body=body.replace(write,"if(fs.existsSync(own(name)))assert.equal(fs.readFileSync(own(name),'utf8'),body,'Only identical previously prepared text may be reused');else fs.writeFileSync(own(name),body,{flag:'wx'});outputs.push(fact(own(name)));");
body=body.replaceAll('native12-result-tools-preparation-01.json','native12-result-tools-preparation-02.json');
new vm.Script(body);fs.writeFileSync(own('prepare-native12-result-tools-02.cjs'),body,{flag:'wx'});require(own('prepare-native12-result-tools-02.cjs'));
