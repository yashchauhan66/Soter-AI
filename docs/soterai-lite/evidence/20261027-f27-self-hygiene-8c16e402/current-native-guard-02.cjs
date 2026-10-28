// Shared exact F27 native admission. Read-only; no process or host launch.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const relativeFile=name=>{assert(typeof name==='string'&&!path.isAbsolute(name));const file=path.resolve(repo,name);assert(file.startsWith(repo+path.sep));return file;};
async function pin(record,external=false){
 const file=external?path.resolve(record.path):relativeFile(record.path),before=fs.lstatSync(file);assert(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1);assert.equal(before.size,record.bytes);
 const hash=crypto.createHash('sha256');let bytes=0;for await(const raw of fs.createReadStream(file)){bytes+=raw.length;assert(bytes<=record.bytes);hash.update(raw);}assert.equal(bytes,record.bytes);assert.equal(hash.digest('hex'),record.sha256);
 const after=fs.lstatSync(file);for(const key of ['size','ino','mtimeMs','ctimeMs'])assert.equal(before[key],after[key]);
}
function pinSource(record){
 const file=relativeFile(record.path),before=fs.lstatSync(file);assert(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1);assert.equal(before.size,record.bytes);
 const fd=fs.openSync(file,'r'),hash=crypto.createHash('sha256'),buffer=Buffer.allocUnsafe(Math.min(65536,record.bytes+1));let bytes=0;
 try{const opened=fs.fstatSync(fd);for(const key of ['size','ino','mtimeMs','ctimeMs'])assert.equal(opened[key],before[key]);
  for(;;){const count=fs.readSync(fd,buffer,0,Math.min(buffer.length,record.bytes+1-bytes),null);if(count===0)break;bytes+=count;assert(bytes<=record.bytes);hash.update(buffer.subarray(0,count));}
 }finally{fs.closeSync(fd);}
 assert.equal(bytes,record.bytes);assert.equal(hash.digest('hex'),record.sha256);const after=fs.lstatSync(file);for(const key of ['size','ino','mtimeMs','ctimeMs'])assert.equal(before[key],after[key]);
}
async function guard(name='native-binding-01.json'){
 assert(['native-binding-01.json','affected-history-binding-01.json'].includes(name));
 const b=read(own(name));assert.equal(b.status,'BOUND_CURRENT_F27_FULL02_EXACT_ATTEMPT01_NATIVE_NOT_RUN');assert.equal(b.fileCount,1016);assert.equal(b.native06,'F26a_USER_DEFERRED_NOT_RUN');
 assert.equal(b.vsix.sha256,'0e6e204d423fcfcb8bedfedc7249a58dbfa7d832f3505d6ccadf352913b37e8b');
 assert.equal(b.sourceProof.path,path.relative(repo,own('full-inputs-04.json')).replace(/\\/g,'/'));
 const expectedNames=['compiler-06','backend-typecheck-03','backend-tests-03','full-tests-02','readiness-02','package-01','content-02','native-fixture-typecheck-01','native-build-01'];
 assert.deepEqual(b.requiredReceipts.map(row=>path.basename(row.path,'.txt.result.json')).sort(),expectedNames.sort());
 for(const record of b.requiredReceipts){await pin(record);const r=read(relativeFile(record.path));assert.equal(r.exitCode,0);const normalized=path.normalize(r.output);const output=relativeFile(path.isAbsolute(normalized)?path.relative(repo,normalized):normalized);assert.equal(sha(fs.readFileSync(output)),r.sha256.toLowerCase());}
 await pin(b.serialResult);const serial=read(relativeFile(b.serialResult.path));assert.equal(serial.status,'SERIAL_CURRENT_F27_VERIFICATION_AND_PACKAGE_PASS_NATIVE_CONTENT_ACCEPTANCE_PENDING');assert.equal(serial.results.length,6);
 for(const row of serial.results){assert.equal(row.status,'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT');assert.equal(row.actualClose,true);assert.equal(row.wrapperExit,0);assert.equal(row.innerExit,0);assert.equal(row.signal,null);assert.equal(row.stdoutEOF,true);assert.equal(row.stderrEOF,true);assert.equal(row.signalsRequested,0);}
 await pin(b.sourceProof);const proof=read(relativeFile(b.sourceProof.path));assert.equal(proof.fileCount,1016);assert.equal(proof.files.length,1016);for(const record of proof.files)pinSource(record);
 await pin(b.driverProvenance);const drivers=read(relativeFile(b.driverProvenance.path));assert.equal(drivers.drivers.length,22);assert.equal(drivers.sourceProofSha256,b.sourceProof.sha256);
 for(const record of drivers.auxiliaryInputs)await pin(record);
 await pin(b.candidateFixture);assert(drivers.auxiliaryInputs.some(row=>JSON.stringify(row)===JSON.stringify(b.candidateFixture)));
 for(const row of drivers.drivers)await pin({...row,path:path.relative(repo,path.join(__dirname,row.path)).replace(/\\/g,'/')});
 assert(drivers.drivers.some(row=>path.resolve(__dirname,row.path)===relativeFile(b.newDriver.path)&&row.sha256===b.newDriver.sha256));await pin(b.newDriver);
 if(name==='native-binding-01.json'){assert.equal(b.nativeOracles.primary,17);assert.equal(b.nativeOracles.restart,5);assert.equal(path.basename(b.candidateFixture.path),'f27-native01.host.ts');}
 else {assert.equal(b.nativeOracles.primary,23);assert.equal(b.nativeOracles.restart,5);assert.equal(path.basename(b.candidateFixture.path),'litePSReadLineHistory.proposal06.host.ts');}
 await pin(b.vsix);assert.equal(b.contentEntries.length,15);for(const entry of b.contentEntries)await pin(entry);assert.equal(b.runtimes.length,4);for(const runtime of b.runtimes)await pin(runtime);
 await pin(b.hostReview);const review=read(relativeFile(b.hostReview.path));assert.equal(review.currentHost.version,'1.143.1');assert.equal(review.currentHost.executable.sha256,'325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6');
 for(const row of [review.currentHost.executable,...review.currentHost.applicationFiles])await pin(row,true);
 await pin(b.historyModuleCheckpoint);const checkpoint=read(relativeFile(b.historyModuleCheckpoint.path));for(const row of checkpoint.installedModule.files)await pin(row,true);
 return b;
}
module.exports={guard,pin,pinSource,repo,read,sha,own,relativeFile};
if(require.main===module)guard(process.argv[2]).then(b=>console.log(JSON.stringify({status:'CURRENT_NATIVE_BINDING_VERIFIED_NO_CODE_LAUNCH',artifact:b.vsix.sha256,inputs:1016,drivers:22,native06:'F26a_USER_DEFERRED_NOT_RUN'}))).catch(()=>{console.error('F27 current native admission refused; no Code launch.');process.exitCode=1;});
