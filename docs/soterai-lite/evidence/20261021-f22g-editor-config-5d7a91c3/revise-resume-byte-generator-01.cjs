'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let text=fs.readFileSync(path.join(__dirname,'resume-byte-generator-01.cjs'),'utf8');
for(const [a,b] of [['resource-observation-01.json','resume-resource-observation-01.json'],['resource-at-start-01.json','resume-resource-at-start-01.json']]){assert.equal(text.split(a).length-1,2);text=text.split(a).join(b);}
const old="const resumeBasis=read(own('resume-basis-01.json'));current(resumeBasis.resumeLedger);";
assert.equal(text.split(old).length-1,1);
const next="const resumeBasis=read(own('resume-basis-01.json'));assert.equal(resumeBasis.status,'PASS_UNCHANGED_CHECKPOINT_AND_OBSERVED_EXTERNAL_RESOURCE_INCREASE');assert.equal(resumeBasis.parent,parent);for(const field of ['productChanges','testChanges','assertionChanges','timingChanges'])assert.equal(resumeBasis[field],0);assert.equal(resumeBasis.boundedNativeRetry,1);for(const row of [resumeBasis.resumeLedger,resumeBasis.resource,resumeBasis.priorResource,resumeBasis.checkpointProof,resumeBasis.artifact])current(row);assert(resumeBasis.freeVirtualKiB>resumeBasis.priorFreeVirtualKiB);const observedResource=read(own('resume-resource-observation-01.json')),startResource=read(own('resume-resource-at-start-01.json'));assert.equal(observedResource.freeVirtualKiB,resumeBasis.freeVirtualKiB);for(const row of [observedResource,startResource]){assert.equal(row.signalsRequested,0);assert.equal(row.osChanges,0);assert(row.freeVirtualKiB>resumeBasis.priorFreeVirtualKiB);}";
text=text.replace(old,next);
fs.writeFileSync(path.join(__dirname,'resume-byte-generator-03.cjs'),text,{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',generator:'resume-byte-generator-03.cjs',correction:'Exact actual resume resource filenames and explicit unchanged-source/resource-basis assertions; original01 retained.'}));
