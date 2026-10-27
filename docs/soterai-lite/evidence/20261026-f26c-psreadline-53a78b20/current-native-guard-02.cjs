const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const relativeFile=name=>{assert(typeof name==='string'&&!path.isAbsolute(name));const file=path.resolve(repo,name);assert(file.startsWith(repo+path.sep));return file;};
async function pin(record,external=false){const file=external?record.path:relativeFile(record.path),stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink());assert.equal(stat.size,record.bytes);const hash=crypto.createHash('sha256');let bytes=0;for await(const raw of fs.createReadStream(file)){bytes+=raw.length;assert(bytes<=record.bytes);hash.update(raw);}assert.equal(bytes,record.bytes);assert.equal(hash.digest('hex'),record.sha256);}
async function guard(){
 const binding=read(own('native-binding-02.json'));assert.equal(binding.status,'BOUND_CURRENT_FULL02_BACKEND02_EXACT_ATTEMPT02_NATIVE_NOT_RUN');assert.equal(binding.fileCount,1003);assert.equal(binding.native06,'DEFERRED_NOT_RUN');
 for(const record of binding.requiredReceipts){await pin(record);const r=read(relativeFile(record.path));assert.equal(r.exitCode,0);const output=relativeFile(r.output.startsWith(repo+path.sep)?path.relative(repo,r.output):r.output);assert.equal(sha(fs.readFileSync(output)),r.sha256.toLowerCase());}
 await pin(binding.sourceProof);const proof=read(relativeFile(binding.sourceProof.path));assert.equal(proof.fileCount,1003);for(const record of proof.files)await pin(record);
 await pin(binding.driverProvenance);const drivers=read(relativeFile(binding.driverProvenance.path));assert.equal(drivers.drivers.length,21);assert.equal(drivers.sourceProofSha256,binding.sourceProof.sha256);for(const row of drivers.drivers)await pin({ ...row,path:path.relative(repo,path.join(__dirname,row.path)).replace(/\\/g,'/') });
 await pin(binding.vsix);for(const runtime of binding.runtimes)await pin(runtime);
 const review=read(relativeFile(binding.hostReview.path));await pin(binding.hostReview);assert.equal(review.currentHost.version,'1.143.1');assert.equal(review.currentHost.executable.sha256,'325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6');
 for(const row of [review.currentHost.executable,...review.currentHost.applicationFiles])await pin(row,true);
 const module=read(own('start-checkpoint-01.json'));for(const row of module.installedModule.files)await pin(row,true);
 return binding;
}
module.exports={guard,pin,repo,read,sha,own,relativeFile};
if(require.main===module)guard().then(binding=>console.log(JSON.stringify({status:'CURRENT_NATIVE_BINDING_VERIFIED_NO_CODE_LAUNCH',artifact:binding.vsix.sha256,inputs:1003,drivers:21,native06:'DEFERRED_NOT_RUN'}))).catch(()=>{console.error('F26c native binding unavailable; no Code launch authorized by this guard.');process.exitCode=1});
