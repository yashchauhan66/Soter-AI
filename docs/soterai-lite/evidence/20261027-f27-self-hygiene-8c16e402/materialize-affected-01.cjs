// Rebind accepted earlier controls to exact F27 facts; no native launch.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fact=file=>{const b=fs.readFileSync(file);return{path:path.relative(repo,file).replace(/\\/g,'/'),bytes:b.length,sha256:sha(b)}};
assert.equal(read(own('native-guard-equivalence-02.json')).status,'PASS_BOTH_COMPLETE_GUARDS_AND_BYTE_DRIFT_REFUSAL_NOT_NATIVE');
const prepared=read(own('affected-preparation-materialization-01.json')),source=read(own('affected-preparation-source-provenance-01.json')),provenance=read(own('native-driver-provenance-01.json')),binding=read(own('native-binding-01.json'));
assert.equal(source.families.length,20);assert.equal(provenance.drivers.length,22);assert.equal(prepared.outputs.length,27);
const mappings=new Map(prepared.outputs.filter(row=>row.target.path.endsWith('.template.ps1')).map(row=>[path.basename(row.target.path),path.basename(row.target.path).replace('affected-preparation-','affected-').replace('.template.ps1','.ps1')]));
mappings.set('affected-preparation-binding-01.template.ps1','affected-native-binding-01.ps1');
const retained=['affected-preparation-functional10-driver-01.js','affected-preparation-security17-driver-01.js'];
let guard=fs.readFileSync(path.join(repo,'docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/affected-native-binding-01b.template.ps1'),'utf8');
for(const [from,to]of [['native-binding-04.json','native-binding-01.json'],['current-native-guard-04c.cjs','current-native-guard-02.cjs'],['__F26C_BINDING_SHA256__',sha(fs.readFileSync(own('native-binding-01.json')))],['__F26C_GUARD_SHA256__',sha(fs.readFileSync(own('current-native-guard-02.cjs')))],['offline-inventory-03/','offline-inventory-01/'],['retained-functional10-driver-01.js',retained[0]],['retained-security17-driver-01.js',retained[1]]])guard=guard.split(from).join(to);
assert(!/__F26C_/.test(guard));assert(!fs.existsSync(own('affected-native-binding-01.ps1')));
const plans=[];
for(const row of prepared.outputs){
 const file=path.join(repo,row.target.path);assert.deepEqual(fact(file),row.target);
 if(!mappings.has(path.basename(file)))continue;
 const before=fs.readFileSync(file,'utf8');let text=before;
 for(const [from,to]of mappings)text=text.split(from).join(to);
 text=text.replaceAll('__F27_AFFECTED_UNBOUND__','F27_AFFECTED_CURRENT_FACTS_BOUND').replaceAll('affected-preparation-vsix-extracted-','vsix-extracted-');
 const deadlines=value=>[...value.matchAll(/WaitForExit\([^)]*\)|(?:TotalSeconds|TotalMilliseconds)\s*-lt\s*\d+/g)].map(row=>row[0]);assert.deepEqual(deadlines(text),deadlines(before));
 const name=mappings.get(path.basename(file));assert(!fs.existsSync(own(name)));plans.push({name,text,source:row.target});
}
assert.equal(plans.length,23);
fs.writeFileSync(own('affected-native-binding-01.ps1'),guard,{flag:'wx'});for(const row of plans)fs.writeFileSync(own(row.name),row.text,{flag:'wx'});
const families=source.families.map(family=>{const name=path.basename(family.acceptedDriver.path),driver=provenance.drivers.find(row=>path.basename(row.path)===name);assert(driver);return{id:family.id,assertions:family.assertions,phases:family.phases,helper:mappings.get(family.helperOutput),driver:fact(path.join(__dirname,driver.path))};});
assert(families.every(row=>row.helper));assert.equal(families.reduce((n,row)=>n+row.assertions,0),509);
fs.writeFileSync(own('affected-materialization-01.json'),JSON.stringify({status:'BOUND_CURRENT_F27_CONTROLS_NOT_EXECUTED',observedAt:new Date().toISOString(),binding:fact(own('native-binding-01.json')),guard:fact(own('current-native-guard-02.cjs')),bindingHelper:fact(own('affected-native-binding-01.ps1')),sourceManifest:fact(own('affected-preparation-source-provenance-01.json')),sourceAdmission:'ALL_1016_EXACT_BYTE_AND_STAT_CHECKS_RETAINED_EACH_INVOCATION',families,outputs:plans.map(row=>({source:row.source,target:fact(own(row.name))})),retainedDrivers:retained.map(name=>fact(own(name))),native06:'F26a_USER_DEFERRED_NOT_RUN',native:'NOT_RUN'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'BOUND_NOT_RUN',families:families.length,assertions:509,phases:37,helpers:plans.length,sourceChecksRemoved:0,vsix:binding.vsix.sha256}));
