'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),base=path.relative(repo,__dirname).replaceAll('\\','/'),own=n=>base+'/'+n;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function bytes(file){return fs.readFileSync(path.resolve(repo,file))}
function fact(file){const b=bytes(file);return {path:file.replaceAll('\\','/'),bytes:b.length,sha256:sha(b)}}
function read(file){return JSON.parse(bytes(file).toString('utf8').replace(/^\uFEFF/,''))}
function current(r){assert.deepEqual(fact(r.path),r);return r}
function write(n,b){fs.writeFileSync(path.join(__dirname,n),b,{flag:'wx'})}
function gate(n){const raw=fact(own(n+'.txt')),receipt=fact(own(n+'.txt.result.json')),r=read(receipt.path);assert.equal(r.exitCode,0,n);assert.equal(r.sha256.toLowerCase(),raw.sha256,n);assert.equal(path.resolve(repo,r.output).toLowerCase(),path.resolve(repo,raw.path).toLowerCase());return {raw,receipt,exitCode:0}}
function equal(name,testedFile,currentFile){const tested=fact(testedFile),now=fact(currentFile);assert.equal(tested.bytes,now.bytes,name);assert.equal(tested.sha256,now.sha256,name);return {name,tested,current:now}}
assert.equal(require('./full-input-lib-04.cjs').check(),932);
gate('full-gates-06');gate('full-tests-05');gate('backend-typecheck-02');gate('backend-tests-02');
const freshRebuildReceipt=gate('current-lite-rebuild-01'),freshDriverReceipt=gate('build-native-hosts-run-02');
const oldFullInputBinding=fact(own('full-inputs-02.json')),currentFullInputBinding=fact(own('full-inputs-04.json')),oldNativeInputBinding=fact(own('native-source-inputs-01.json')),currentNativeInputBinding=fact(own('native-source-inputs-03.json'));
const old=read(oldNativeInputBinding.path),fresh=read(currentNativeInputBinding.path),oldMap=new Map(old.records.map(r=>[r.path,r])),freshMap=new Map(fresh.records.map(r=>[r.path,r]));
assert.equal(oldMap.size,934);assert.equal(freshMap.size,934);for(const r of fresh.records)current(r);
const fixtureFile='packages/vscode-extension/src/__tests__/historyGitProcess.test.ts',metadata=['package-lock.json','package.json'];
assert.deepEqual(fresh.records.filter(r=>JSON.stringify(r)!==JSON.stringify(oldMap.get(r.path))).map(r=>r.path).sort(),[...metadata,fixtureFile].sort());
const differences=metadata.map(file=>({path:file,before:oldMap.get(file),after:freshMap.get(file)}));
const correctionEvidence=fact(own('deadline-fixture-correction-01.json')),correction=read(correctionEvidence.path),targetedGate=gate('deadline-fixture-tests-01');
const fixtureCorrection={path:fixtureFile,before:oldMap.get(fixtureFile),after:freshMap.get(fixtureFile),beforeSnapshot:correction.before,correctionEvidence,targetedGate,deadlineMilliseconds:30,initialClock:1000,deadline:1030,advancedClock:1031,childCountBeforeAdvance:1,assertionsPreserved:true};current(fixtureCorrection.beforeSnapshot);
const content=read(own('vsix-inspection-01.json')),runtimeReceiptFile='packages/soterai-lite/dist/build-receipt.json',freshRuntime=read(runtimeReceiptFile);
assert.equal(freshRuntime.runtimeCount,3);assert.notEqual(freshRuntime.runId,content.sourceProvenance.runId);
const attempt='packages/soterai-lite/'+freshRuntime.attempt.replaceAll('\\','/');assert(attempt.startsWith('packages/soterai-lite/builds/'));
const rebuildOutputs=bytes(freshRebuildReceipt.raw.path).toString('utf8').split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}}).filter(r=>r.status==='BUILT_NOT_HOST_VERIFIED');assert.equal(rebuildOutputs.length,1);assert.equal(rebuildOutputs[0].attempt.replaceAll('\\','/'),attempt);
const freshRuntimeProvenance=fact(attempt+'/build-provenance.json');assert.deepEqual(read(freshRuntimeProvenance.path),freshRuntime);
const runtimeComparisons=[];for(const oldRuntime of content.sourceProvenance.inventory){const rebuilt=freshRuntime.inventory.find(r=>r.name===oldRuntime.name);assert(rebuilt);assert.deepEqual([...rebuilt.inputs].sort((a,b)=>a.path.localeCompare(b.path)),[...oldRuntime.inputs].sort((a,b)=>a.path.localeCompare(b.path)),'Exact bundled input membership and bytes');for(const r of rebuilt.inputs)current(r);runtimeComparisons.push(equal(oldRuntime.name,own('vsix-extracted-01/extension/dist/'+oldRuntime.name),attempt+'/dist/'+oldRuntime.name))}
const freshDriverProvenance=fact(own('native-driver-provenance-02.json')),drivers=read(freshDriverProvenance.path),oldDrivers=read(own('native-driver-provenance-01.json'));
assert.equal(drivers.drivers.length,20);assert.equal(oldDrivers.drivers.length,20);
const driverComparisons=oldDrivers.drivers.map(r=>{const name=path.basename(r.path),now=drivers.drivers.find(d=>path.basename(d.path)===name);assert(now);return equal(name,own(r.path),own(now.path))});
const manifest=read(attempt+'/package.json');delete manifest.scripts;delete manifest.devDependencies;
const projected=Buffer.from(JSON.stringify(manifest,null,2)+'\n'),testedManifest=bytes(own('vsix-extracted-01/extension/package.json'));assert.deepEqual(projected,testedManifest,'Exact current stripped package manifest');
write('current-packaged-manifest-projection-01.json',projected);
const manifestComparison=equal('package.json',own('vsix-extracted-01/extension/package.json'),own('current-packaged-manifest-projection-01.json'));
const assets=['readme.md','changelog.md','LICENSE.md','media/icon.svg','media/logo_circle_whiter.png','media/walkthrough/demo.md','media/walkthrough/integrate.md','media/walkthrough/vault.md'];
const assetComparisons=assets.map(name=>equal(name,own('vsix-extracted-01/extension/'+name),'packages/soterai-lite/'+(name==='readme.md'?'README.md':name==='changelog.md'?'CHANGELOG.md':name)));
const ancestryEvidence=fact(own('external-commit-ancestry-02.json')),ancestry=read(ancestryEvidence.path);
const proof={status:'PASS_EXACT_TWO_METADATA_AND_ONE_FIXTURE_DELTA_REBUILT_RUNTIME_DRIVER_EQUIVALENCE',parent:ancestry.parent,oldParent:ancestry.oldParent,externalCommits:ancestry.externalCommits,ancestryEvidence,oldFullInputBinding,currentFullInputBinding,oldNativeInputBinding,currentNativeInputBinding,differences,fixtureCorrection,freshRebuildReceipt,freshRuntimeProvenance,freshDriverReceipt,freshDriverProvenance,runtimeComparisons,driverComparisons,manifestComparison,assetComparisons,scope:'Same exact previously executed VSIX remains current Lite artifact: three rebuilt runtime bytes+all bundled source/dependency memberships,20rebuilt driver bytes, stripped manifest and8assets exact. Explicit root metadata2 and one unit fixture-only clock correction require current full05/backend02/compiler-build02 actual0. Original native execution freezes/provenance and all failures unchanged. No evidence transferred to any new package.',observedAt:new Date().toISOString()};
write('current-metadata-equivalence-02.json',JSON.stringify(proof,null,2)+'\n');
const proofFact=fact(own('current-metadata-equivalence-02.json'));let guard=fs.readFileSync(path.join(__dirname,'metadata-equivalence-guard-02.template.cjs'),'utf8');
for(const [key,value]of Object.entries({'__F25_METADATA_EQUIVALENCE_BOUND__':'F25_CURRENT_METADATA_EQUIVALENCE_REVIEWED','__F25_METADATA_EQUIVALENCE_SHA256__':proofFact.sha256})){assert(guard.includes(key));guard=guard.replaceAll(key,value)}assert(!guard.includes('__F25_'));write('metadata-equivalence-guard-02.cjs',guard);
const verified=require('./metadata-equivalence-guard-02.cjs').check();
console.log(JSON.stringify({status:'PASS_CURRENT_METADATA_AND_FIXTURE_EQUIVALENCE',proof:proofFact,runtimes:runtimeComparisons.length,drivers:driverComparisons.length,assets:assetComparisons.length,unchangedFull:verified.unchangedFullInputs,unchangedNative:verified.unchangedNativeInputs}));
