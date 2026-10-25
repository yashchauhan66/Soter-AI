'use strict';
if('__F25_TEMPLATE_BOUND__'!=='F25_CURRENT_FACTS_BOUND')throw Error('F25 materializer PREPARED_NOT_BOUND: root must review final current receipts and create a NEW owned copy before execution');
// Materialization only after binding. No child/compiler/editor/build/network calls.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8').replace(/^\uFEFF/,''));
const digest=/^[a-f0-9]{64}$/;
function owned(base,name){assert.equal(typeof name,'string');assert(!path.isAbsolute(name));const target=path.resolve(base,name);assert(target.startsWith(base+path.sep),'Owned input escaped workspace');return target;}
function file(base,fact){assert(digest.test(fact.sha256));const target=owned(base,fact.path),raw=fs.readFileSync(target);assert(!raw.includes(0),'NUL in required textual input '+fact.path);assert.equal(sha(raw),fact.sha256,fact.path);if(fact.bytes!==undefined)assert.equal(raw.length,fact.bytes,fact.path);return raw;}
const binding=read('native-binding-current-01.json');
assert.equal(binding.status,'F25_CURRENT_GATES_REVIEWED_FOR_MATERIALIZATION');assert.equal(binding.feature,'F25');
assert.equal(binding.expectedArtifact,'packages/soterai-lite/soterai-lite-0.7.0-f25-20261024-attempt01.vsix');
const library=require('./full-input-lib-02.cjs');library.check();
const fullFreeze=JSON.parse(file(__dirname,binding.fullInputs).toString('utf8').replace(/^\uFEFF/,''));
assert.equal(binding.fullInputs.path,'full-inputs-02.json','Latest corrected README/full03 freeze required; failed full02/old freeze never promoted');assert.equal(fullFreeze.records.length,932);assert.deepEqual(fullFreeze.nativeFixtureExclusions,[
 'packages/vscode-extension/src/__tests__/host/liteLogs.host.ts','packages/vscode-extension/src/__tests__/host/liteLogVaultRuntime.host.ts']);
const source=JSON.parse(file(__dirname,binding.nativeInputs).toString('utf8').replace(/^\uFEFF/,''));
const records=new Map(source.records.map(row=>[row.path,row]));assert.equal(records.size,934);assert.equal(source.records.length,934);
for(const row of fullFreeze.records)assert.deepEqual(records.get(row.path),row,'Full-tested input changed or omitted: '+row.path);
for(const name of fullFreeze.nativeFixtureExclusions)assert(records.has(name),'Final new host freeze omitted: '+name);
for(const row of source.records){const raw=fs.readFileSync(owned(repo,row.path));assert.equal(raw.length,row.bytes,row.path);assert.equal(sha(raw),row.sha256,row.path);}
const gates=new Map();
for(const gate of binding.gates){assert(!gates.has(gate.role));const resultRaw=file(__dirname,gate.result),result=JSON.parse(resultRaw.toString('utf8').replace(/^\uFEFF/,'')),raw=file(__dirname,{path:gate.raw,sha256:result.sha256});assert.equal(result.exitCode,0,gate.role);gates.set(gate.role,{gate,result,raw});}
for(const role of ['compiler','readiness','full','backendCompiler','backendTests','nativeBuild','package'])assert(gates.has(role),'Current required gate absent: '+role);
assert.deepEqual(Object.keys(binding.fullCounts).sort(),['cancelled','fail','pass','skipped','tests']);
assert.equal(binding.fullCounts.fail,0);assert.equal(binding.fullCounts.cancelled,0);assert(binding.fullCounts.tests>3570);assert.equal(binding.fullCounts.pass+binding.fullCounts.skipped,binding.fullCounts.tests);
for(const [key,expected] of Object.entries(binding.fullCounts)){const found=[...gates.get('full').raw.toString('utf8').matchAll(new RegExp('^# '+key+' (\\d+)\\r?$','gm'))];assert.equal(found.length,1);assert.equal(+found[0][1],expected,'Exact current full '+key);}
const packageLines=gates.get('package').raw.toString('utf8').split(/\r?\n/).filter(line=>line.startsWith('{"status":"PACKAGED_NOT_HOST_VERIFIED",'));assert.equal(packageLines.length,1);const pkg=JSON.parse(packageLines[0]);
assert.equal(pkg.output,binding.expectedArtifact);assert(digest.test(pkg.sha256)&&digest.test(pkg.extensionSha256));
const artifact=fs.readFileSync(owned(repo,pkg.output));assert.equal(artifact.length,pkg.bytes);assert.equal(sha(artifact),pkg.sha256); // Binary archive intentionally has NULs.
const host=JSON.parse(file(__dirname,binding.hostReview).toString('utf8').replace(/^\uFEFF/,''));assert.equal(host.currentFeature,'F25','Fresh F25 host inspection REQUIRED; retained F24 review refused');assert.equal(host.status,'REVIEWED_NEW_EDITOR_HOST_STATIC_ONLY_NATIVE_PENDING');assert.equal(host.currentHost.version,'1.143.1');assert.equal(host.currentHost.executable.sha256,'325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6');assert.equal(host.currentHost.executable.bytes,238249784);
for(const row of [host.currentHost.executable,...host.currentHost.applicationFiles]){const raw=fs.readFileSync(row.path);assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);}
const built=JSON.parse(file(__dirname,binding.nativeProvenance).toString('utf8').replace(/^\uFEFF/,''));assert.equal(built.status,'BUILT_NOT_RUN_ESM_PARSER_INLINED');assert.equal(built.drivers.length,20);
for(const row of built.drivers){const raw=fs.readFileSync(owned(__dirname,row.path));assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);}
const full=gates.get('full').gate;
const replacements={__F25_TEMPLATE_BOUND__:'F25_CURRENT_FACTS_BOUND',__F25_NATIVE_INPUTS_JSON__:binding.nativeInputs.path,__F25_NATIVE_INPUTS_SHA256__:binding.nativeInputs.sha256,
 __F25_HOST_VERSION_REVIEW_JSON__:binding.hostReview.path,__F25_HOST_VERSION_REVIEW_SHA256__:binding.hostReview.sha256,__F25_EDITOR_EXECUTABLE__:host.currentHost.executable.path,
 __F25_NATIVE_HOST_OUTPUT_DIR__:binding.nativeOutputDirectory,__F25_NATIVE_DRIVER_PROVENANCE_JSON__:binding.nativeProvenance.path,__F25_NATIVE_DRIVER_PROVENANCE_SHA256__:binding.nativeProvenance.sha256,
 __F25_EXTRACTED_EXTENSION_RELATIVE__:'vsix-extracted-01/extension',__F25_FULL_GATE_RESULT_JSON__:full.result.path,__F25_FULL_GATE_RESULT_SHA256__:full.result.sha256,
 __F25_FULL_GATE_RAW_RELATIVE__:path.relative(repo,path.join(__dirname,full.raw)).replaceAll('\\','/')};
assert(/^[a-z0-9-]+$/.test(binding.nativeOutputDirectory));
const manifest=JSON.parse(file(__dirname,binding.templateManifest).toString('utf8').replace(/^\uFEFF/,''));assert.equal(manifest.status,'PREPARED_TEMPLATES_NOT_EXECUTED_NOT_BOUND');assert.equal(manifest.templates.length,29);
const outputs=[];
for(const row of manifest.templates){
 if(row.materializeAs==='build-native-hosts-01.cjs')continue; // Its separately reviewed bound copy already produced the current nativeBuild receipt.
 const raw=file(__dirname,{path:row.template,bytes:row.bytes,sha256:row.sha256});let text=raw.toString('utf8');for(const [token,value] of Object.entries(replacements))text=text.replaceAll(token,value);assert(!/__F25_[A-Z0-9_]+__/.test(text),'Unbound placeholder: '+row.template);assert(!fs.existsSync(owned(__dirname,row.materializeAs)),'Existing helper refused: '+row.materializeAs);outputs.push({path:row.materializeAs,bytes:Buffer.from(text),source:row.template,sourceSha256:row.sha256});
}
assert.equal(outputs.length,28);assert(!fs.existsSync(path.join(__dirname,'native-materialization-01.json')));
library.check();for(const row of source.records){const raw=fs.readFileSync(owned(repo,row.path));assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);}
for(const row of outputs)fs.writeFileSync(owned(__dirname,row.path),row.bytes,{flag:'wx'});
const receipt={status:'MATERIALIZED_CURRENT_BOUND_FIXTURES_NOT_NATIVE_EXECUTED',feature:'F25',bindingSha256:sha(fs.readFileSync(path.join(__dirname,'native-binding-current-01.json'))),artifact:{path:pkg.output,bytes:pkg.bytes,sha256:pkg.sha256,frontendSha256:pkg.extensionSha256},nativeDrivers:20,declaredNativeChecks:509,declaredNativePhases:37,files:outputs.map(row=>({path:row.path,bytes:row.bytes.length,sha256:sha(row.bytes),source:row.source,sourceSha256:row.sourceSha256})),time:new Date().toISOString(),scope:'Current gates/input membership/host/build/package bytes checked. New bound fixture copies only; actual ZIP inspection, native execution, owned close/EOF, custody, acceptance and source+transition byte barriers remain pending.'};
fs.writeFileSync(path.join(__dirname,'native-materialization-01.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:receipt.status,files:outputs.length,artifact:pkg.sha256}));
