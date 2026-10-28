// Current F29 admission only. All frozen sources are checked on every call.
// Read-only: no host, browser, child, signal, retry or acceptance mutation.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const STATUS='BOUND_CURRENT_F29_FULL02_EXACT_ATTEMPT01_NATIVE_NOT_RUN';
const SOURCE_SHA='9c6ba8ba6d5e7f63bc3bb466ec5b5aacbfea03039b09135ef6b86af80039a67e';
const VSIX_SHA='100e86843e929c5e1bef8ae06ada04063fb3fe8cf29ce646b3a9e6b49f773105';
const FRONTEND_SHA='547e956909d28eeeb45503d7c94d23dac10885ef053a65915da54150e40acb1e';
const REQUIRED=['compiler-03','backend-typecheck-01','backend-tests-01','full-tests-02','readiness-01','package-01','content-02','native-fixture-typecheck-03','native-build-02'];
const SERIAL_NAMES=['compiler-03','native-fixture-typecheck-02','backend-typecheck-01','backend-tests-01','full-tests-02','readiness-01','package-01'];
const relativeFile=name=>{assert(typeof name==='string'&&!path.isAbsolute(name));const file=path.resolve(repo,name);assert(file.startsWith(repo+path.sep));return file;};
const relativeName=file=>path.relative(repo,file).replace(/\\/g,'/');
function recordShape(record){assert(record&&typeof record==='object'&&typeof record.path==='string');assert(Number.isSafeInteger(record.bytes)&&record.bytes>=0);assert(typeof record.sha256==='string'&&/^[a-f0-9]{64}$/.test(record.sha256));}
async function pin(record,external=false){
 recordShape(record);const file=external?path.resolve(record.path):relativeFile(record.path),before=fs.lstatSync(file);assert(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1);assert.equal(before.size,record.bytes);
 const hash=crypto.createHash('sha256');let bytes=0;for await(const raw of fs.createReadStream(file)){bytes+=raw.length;assert(bytes<=record.bytes);hash.update(raw);}assert.equal(bytes,record.bytes);assert.equal(hash.digest('hex'),record.sha256);
 const after=fs.lstatSync(file);assert(after.isFile()&&!after.isSymbolicLink()&&after.nlink===1);for(const key of ['size','ino','mtimeMs','ctimeMs'])assert.equal(before[key],after[key]);
}
// Same bounded descriptor/stat source checks as accepted H27 guard02. No cache.
function pinSource(record){
 recordShape(record);const file=relativeFile(record.path),before=fs.lstatSync(file);assert(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1);assert.equal(before.size,record.bytes);
 const fd=fs.openSync(file,'r'),hash=crypto.createHash('sha256'),buffer=Buffer.allocUnsafe(Math.min(65536,record.bytes+1));let bytes=0;
 try{const opened=fs.fstatSync(fd);for(const key of ['size','ino','mtimeMs','ctimeMs'])assert.equal(opened[key],before[key]);
  for(;;){const count=fs.readSync(fd,buffer,0,Math.min(buffer.length,record.bytes+1-bytes),null);if(count===0)break;bytes+=count;assert(bytes<=record.bytes);hash.update(buffer.subarray(0,count));}
 }finally{fs.closeSync(fd);}
 assert.equal(bytes,record.bytes);assert.equal(hash.digest('hex'),record.sha256);const after=fs.lstatSync(file);assert(after.isFile()&&!after.isSymbolicLink()&&after.nlink===1);for(const key of ['size','ino','mtimeMs','ctimeMs'])assert.equal(before[key],after[key]);
}
function expectedPath(record,file){assert.equal(path.resolve(relativeFile(record.path)),path.resolve(file));}
function verifyClosed(value,name){
 assert.equal(value.status,'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT');if(name!==undefined)assert.equal(value.name,name);
 for(const [key,expected]of Object.entries({actualClose:true,wrapperExit:0,innerExit:0,signal:null,stdoutEOF:true,stderrEOF:true,signalsRequested:0}))assert.equal(value[key],expected);
 if(Object.hasOwn(value,'deadlineExceeded'))assert.equal(value.deadlineExceeded,false);
}
async function verifyOwnedStep(step){
 assert(typeof step.name==='string');const name=step.name;
 const suffixes={canonical:'.txt.result.json',output:'.txt',verification:'-verification.json',ownedClose:'-owned-close.json',stdout:'-stdout.bin',stderr:'-stderr.bin'};
 for(const [key,suffix]of Object.entries(suffixes)){expectedPath(step[key],own(name+suffix));await pin(step[key]);}
 const canonical=read(relativeFile(step.canonical.path));assert.equal(canonical.exitCode,0);assert.equal(typeof canonical.output,'string');assert(/^[a-f0-9]{64}$/i.test(canonical.sha256));
 const normalized=path.normalize(canonical.output),output=path.isAbsolute(normalized)?path.resolve(normalized):path.resolve(repo,normalized);
 assert.equal(output,path.resolve(relativeFile(step.output.path)));assert.equal(canonical.sha256.toLowerCase(),step.output.sha256);
 verifyClosed(read(relativeFile(step.verification.path)),name);
 const closed=read(relativeFile(step.ownedClose.path));
 for(const [key,expected]of Object.entries({actualClose:true,exitCode:0,signal:null,stdoutEOF:true,stderrEOF:true,overflow:false,streamError:false,deadlineExceeded:false,signalsRequested:0}))assert.equal(closed[key],expected);
 assert(Number.isInteger(closed.pid)&&closed.pid>0);assert.equal(closed.streams.length,2);assert.deepEqual(closed.streams.map(row=>row.name).sort(),['stderr','stdout']);
 for(const channel of ['stdout','stderr']){const stream=closed.streams.find(row=>row.name===channel);assert.equal(stream.bytes,step[channel].bytes);assert.equal(stream.observedBytes,stream.bytes);assert.equal(stream.sha256,step[channel].sha256);}
 return canonical;
}
async function validateBinding(b){
 assert.equal(b.status,STATUS);assert.equal(b.fileCount,1024);assert.equal(b.native06,'F26a_USER_DEFERRED_NOT_RUN');
 expectedPath(b.sourceProof,own('full-inputs-03.json'));assert.equal(b.sourceProof.sha256,SOURCE_SHA);assert.equal(b.sourceProof.bytes,203135);
 assert.deepEqual(b.requiredReceipts.map(row=>path.basename(row.path,'.txt.result.json')).sort(),[...REQUIRED].sort());
 const expectedSteps=[...new Set([...REQUIRED,...SERIAL_NAMES])].sort();assert.deepEqual(b.ownedSteps.map(row=>row.name).sort(),expectedSteps);
 for(const step of b.ownedSteps)await verifyOwnedStep(step);
 for(const record of b.requiredReceipts){await pin(record);const name=path.basename(record.path,'.txt.result.json'),step=b.ownedSteps.find(row=>row.name===name);assert.deepEqual(record,step.canonical);}
 expectedPath(b.serialResult,own('serial-result-03.json'));await pin(b.serialResult);const serial=read(relativeFile(b.serialResult.path));
 assert.equal(serial.status,'SERIAL_CURRENT_F29_SOURCE_VERIFICATION_AND_NEW_PACKAGE_PASS_NATIVE_CONTENT_PENDING');assert.equal(serial.results.length,7);assert.deepEqual(serial.results.map(row=>row.name),SERIAL_NAMES);assert.equal(serial.signalsRequested,0);assert.equal(serial.native06,'F26a_USER_DEFERRED_NOT_RUN');
 for(const row of serial.results)verifyClosed(row,row.name);
 await pin(b.sourceProof);const proof=read(relativeFile(b.sourceProof.path));assert.equal(proof.feature,'F29');assert.equal(proof.status,'FROZEN_CURRENT_F29_SOURCE_NOT_NATIVE_ACCEPTANCE');assert.equal(proof.fileCount,1024);assert.equal(proof.files.length,1024);assert.equal(new Set(proof.files.map(row=>row.path)).size,1024);for(const record of proof.files)pinSource(record);
 expectedPath(b.driverProvenance,own('native-driver-provenance-02.json'));await pin(b.driverProvenance);const drivers=read(relativeFile(b.driverProvenance.path));
 assert.equal(drivers.status,'BUILT_NOT_RUN_ESM_PARSER_INLINED');assert.equal(drivers.compiler,'compiler-03');assert.equal(drivers.auxiliaryTypecheck,'native-fixture-typecheck-03');assert.equal(drivers.sourceProofSha256,SOURCE_SHA);assert.equal(drivers.drivers.length,23);assert.equal(drivers.native06,'F26a_NOT_INCLUDED_NOT_RUN');
 expectedPath(b.previousDriverProvenance,own('native-driver-provenance-01.json'));await pin(b.previousDriverProvenance);const prior=read(relativeFile(b.previousDriverProvenance.path));assert.equal(prior.drivers.length,23);assert.equal(prior.sourceProofSha256,SOURCE_SHA);
 const driverName=row=>path.basename(row.path),changed='lite-f29-protection-center-host.js';
 assert.equal(new Set(drivers.drivers.map(driverName)).size,23);assert.deepEqual(drivers.drivers.map(driverName).sort(),prior.drivers.map(driverName).sort());
 for(const old of prior.drivers.filter(row=>driverName(row)!==changed)){const current=drivers.drivers.find(row=>driverName(row)===driverName(old));assert.equal(current.bytes,old.bytes);assert.equal(current.sha256,old.sha256);}
 assert.equal(prior.drivers.filter(row=>driverName(row)!==changed).length,22);
 for(const record of drivers.auxiliaryInputs)await pin(record);
 expectedPath(b.candidateFixture,own('f29-native03.host.ts'));await pin(b.candidateFixture);assert(drivers.auxiliaryInputs.some(row=>JSON.stringify(row)===JSON.stringify(b.candidateFixture)));
 assert.equal(drivers.entryPoints['lite-f29-protection-center-host'],b.candidateFixture.path);
 for(const row of drivers.drivers)await pin({...row,path:relativeName(path.resolve(__dirname,row.path))});
 const selected=drivers.drivers.find(row=>driverName(row)===changed);assert(selected);assert.equal(path.resolve(__dirname,selected.path),relativeFile(b.newDriver.path));assert.equal(selected.bytes,b.newDriver.bytes);assert.equal(selected.sha256,b.newDriver.sha256);await pin(b.newDriver);
 assert.deepEqual(b.nativeOracles,{primary:25,restart:5,total:30});assert.equal(b.executionScope,'F29_INITIAL_INSTALLED_OWNER_NATIVE_API_VERIFICATION');
 expectedPath(b.contentInspection,own('content-inspection-01.json'));await pin(b.contentInspection);const inspection=read(relativeFile(b.contentInspection.path));
 assert.equal(inspection.status,'CONTENT_AND_OFFLINE_INVENTORY_PASS_NOT_NATIVE_OR_FEATURE_ACCEPTANCE');assert.equal(inspection.sourceCount,1024);assert.deepEqual(inspection.full,{tests:4421,pass:4417,fail:0,cancelled:0,skipped:4});assert.equal(inspection.machineSettings,85);assert.equal(inspection.selfHygieneDefault,false);assert.equal(inspection.protectionCenterDefault,true);assert.equal(inspection.restricted,true);assert.equal(inspection.releaseReady,false);assert.equal(inspection.entryCount,15);assert.equal(inspection.runtimeCount,4);
 assert.equal(b.vsix.sha256,VSIX_SHA);assert.equal(b.vsix.bytes,1724214);assert.equal(b.frontendSha256,FRONTEND_SHA);assert.equal(inspection.vsix.sha256,VSIX_SHA);assert.equal(inspection.vsix.extensionSha256,FRONTEND_SHA);
 expectedPath(b.vsix,path.join(repo,path.normalize(inspection.vsix.output)));await pin(b.vsix);assert.equal(b.extractedRoot,inspection.extractedRoot);assert.equal(b.extractedRoot,relativeName(own('vsix-extracted-01/extension')));
 assert.equal(b.contentEntries.length,15);assert.equal(new Set(b.contentEntries.map(row=>row.path)).size,15);
 const entries=inspection.entries.map(row=>({...row,path:relativeName(own('vsix-extracted-01/'+row.path))}));assert.deepEqual(b.contentEntries,entries);for(const record of b.contentEntries)await pin(record);
 const expectedRuntimes=[['extension.js',1868737,FRONTEND_SHA],['local-ai-broker.js',325408,'7f1285a6efcd9170ca61b0394c4c770f81a5854874bca93cf6741097697cab7c'],['pre-commit-client.js',14439,'67b2ef79c9d132db6ed70e8cdd9bed85e5e920359beb71532c85dceb0db20449'],['soterai-mcp-server.js',228803,'68ef81d9cf7bbee6717c590f0a7b83be18d28e039042cbd412fa97e1b8bb1777']];
 assert.equal(b.runtimes.length,4);for(const [name,bytes,hash]of expectedRuntimes){const row=b.runtimes.find(record=>record.name===name);assert(row);assert.equal(row.bytes,bytes);assert.equal(row.sha256,hash);expectedPath(row,path.join(relativeFile(b.extractedRoot),'dist',name));await pin(row);}
 assert.equal(b.hostReview.path,'docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/host-version-review-proposal06.json');assert.equal(b.hostReview.sha256,'8d0260e8f45fd0002fe0b1eab1d01e3448906aed9b42701013bb42cd34e939e6');await pin(b.hostReview);const review=read(relativeFile(b.hostReview.path));assert.equal(review.currentHost.version,'1.143.1');assert.equal(review.currentHost.executable.sha256,'325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6');for(const row of [review.currentHost.executable,...review.currentHost.applicationFiles])await pin(row,true);
 assert.equal(b.historyModuleCheckpoint.path,'docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/start-checkpoint-01.json');assert.equal(b.historyModuleCheckpoint.sha256,'b2388188f92a9db2d77214bb0fb576a6bf6f05fb4f56207803abd5912d3aaca3');await pin(b.historyModuleCheckpoint);const checkpoint=read(relativeFile(b.historyModuleCheckpoint.path));assert.equal(checkpoint.installedModule.files.length,4);for(const row of checkpoint.installedModule.files)await pin(row,true);
 return b;
}
async function guard(name='native-binding-01.json'){assert.equal(name,'native-binding-01.json');return validateBinding(read(own(name)));}
module.exports={guard,validateBinding,pin,pinSource,verifyOwnedStep,repo,read,sha,own,relativeFile,relativeName,STATUS,REQUIRED,SERIAL_NAMES};
if(require.main===module)guard(process.argv[2]).then(b=>console.log(JSON.stringify({status:'CURRENT_F29_NATIVE_BINDING_VERIFIED_NO_CODE_OR_BROWSER_LAUNCH',artifact:b.vsix.sha256,inputs:1024,drivers:23,nativeChecks:30,native06:b.native06}))).catch(()=>{console.error('F29 current native admission refused; no host or browser launch.');process.exitCode=1;});
