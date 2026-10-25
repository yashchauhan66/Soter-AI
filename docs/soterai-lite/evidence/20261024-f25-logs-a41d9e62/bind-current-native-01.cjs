'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function fact(name){const raw=fs.readFileSync(path.join(__dirname,name));return {path:name,bytes:raw.length,sha256:sha(raw)};}
function gate(role,name){const raw=fs.readFileSync(path.join(__dirname,name)),resultName=name+'.result.json',result=JSON.parse(fs.readFileSync(path.join(__dirname,resultName),'utf8').replace(/^\uFEFF/,''));assert.equal(result.exitCode,0,role);assert.equal(result.sha256.toLowerCase(),sha(raw),role);return {role,raw:name,result:fact(resultName)};}
assert.equal(require('./full-input-lib-02.cjs').check(),932);
const binding=JSON.parse(fs.readFileSync(path.join(__dirname,'native-binding-required-04.json'),'utf8'));
binding.status='F25_CURRENT_GATES_REVIEWED_FOR_MATERIALIZATION';binding.templateManifest=fact('native-template-inputs-03.json');binding.fullInputs=fact('full-inputs-02.json');binding.nativeInputs=fact('native-source-inputs-01.json');binding.hostReview=fact('host-version-review-01.json');binding.nativeProvenance=fact('native-driver-provenance-01.json');
const native=JSON.parse(fs.readFileSync(path.join(__dirname,binding.nativeInputs.path),'utf8'));assert.equal(native.records.length,934);
binding.gates=[gate('compiler','build-native-hosts-run-01.txt'),gate('readiness','readiness-tests-01.txt'),gate('full','full-tests-03.txt'),gate('backendCompiler','backend-typecheck-01.txt'),gate('backendTests','backend-tests-01.txt'),gate('nativeBuild','build-native-hosts-run-01.txt'),gate('package','package-01.txt')];
const full=fs.readFileSync(path.join(__dirname,'full-tests-03.txt'),'utf8');binding.fullCounts={};for(const key of ['tests','pass','fail','cancelled','skipped']){const values=[...full.matchAll(new RegExp('^# '+key+' (\\d+)\\r?$','gm'))];assert.equal(values.length,1);binding.fullCounts[key]=+values[0][1];}
assert.deepEqual(binding.fullCounts,{tests:3757,pass:3753,fail:0,cancelled:0,skipped:4});
assert(fs.readFileSync(path.join(__dirname,'build-native-hosts-run-01.txt'),'utf8').includes('Current native fixture TypeScript compiler PASS.'));
binding.compilerScope='Compiler and nativeBuild roles share one actual successful fresh934-input tsc+20-driver build gate. No doubled test/native count.';
binding.factsReviewedAt=new Date().toISOString();delete binding.bindingInstructions;
assert(!JSON.stringify(binding).includes('__F25_'));
const templateName='materialize-native-05.template.cjs',raw=fs.readFileSync(path.join(__dirname,templateName)),text=raw.toString('utf8').replace("if('__F25_TEMPLATE_BOUND__'!=='F25_CURRENT_FACTS_BOUND')","if('F25_CURRENT_FACTS_BOUND'!=='F25_CURRENT_FACTS_BOUND')");
assert.notEqual(text,raw.toString('utf8'));new vm.Script(text,{filename:'materialize-native-01.cjs'});
fs.writeFileSync(path.join(__dirname,'native-binding-current-01.json'),JSON.stringify(binding,null,2),{flag:'wx'});fs.writeFileSync(path.join(__dirname,'materialize-native-01.cjs'),text,{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'materializer-current-binding-01.json'),JSON.stringify({status:'CURRENT_GATE_BINDING_WRITTEN_MATERIALIZATION_NOT_RUN',binding:fact('native-binding-current-01.json'),sourceTemplate:fact(templateName),ownedMaterializer:fact('materialize-native-01.cjs'),time:new Date().toISOString()},null,2),{flag:'wx'});
console.log(JSON.stringify({status:'CURRENT_FACTS_BOUND_NOT_NATIVE_EXECUTED',full:binding.fullCounts,inputs:934,nativeDrivers:20,templateSha256:sha(raw)}));
