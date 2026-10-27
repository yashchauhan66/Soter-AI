const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const relativeFile=name=>{assert(typeof name==='string'&&!path.isAbsolute(name));const file=path.resolve(repo,name);assert(file.startsWith(repo+path.sep));return file;};
async function pin(record,external=false){const file=external?record.path:relativeFile(record.path),stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink());assert.equal(stat.size,record.bytes);const hash=crypto.createHash('sha256');let bytes=0;for await(const raw of fs.createReadStream(file)){bytes+=raw.length;assert(bytes<=record.bytes);hash.update(raw);}assert.equal(bytes,record.bytes);assert.equal(hash.digest('hex'),record.sha256);}
async function guard(){
 const approval=read(own('proposal06-approval-01.json'));assert.equal(approval.status,'USER_AUTHORIZED_ONE_BOUNDED_F26C_PROPOSAL06_RUN');assert.equal(approval.proposalSha256,sha(fs.readFileSync(own('proposal06-review-01.json'))));
 const binding=read(own('native-binding-proposal06.json'));await pin(binding.candidateFixture);assert.equal(binding.status,'BOUND_CURRENT_FULL05_BACKEND03_EXACT_ATTEMPT03_NATIVE_NOT_RUN');assert.equal(binding.fileCount,1005);assert.equal(binding.native06,'DEFERRED_NOT_RUN');
 for(const record of binding.requiredReceipts){await pin(record);const r=read(relativeFile(record.path));assert.equal(r.exitCode,0);const normalizedOutput=path.normalize(r.output);const output=relativeFile(path.isAbsolute(normalizedOutput)?path.relative(repo,normalizedOutput):normalizedOutput);assert.equal(sha(fs.readFileSync(output)),r.sha256.toLowerCase());}
 await pin(binding.sourceProof);const proof=read(relativeFile(binding.sourceProof.path));assert.equal(proof.fileCount,1005);for(const record of proof.files)await pin(record);
 await pin(binding.driverProvenance);const drivers=read(relativeFile(binding.driverProvenance.path));assert.equal(drivers.drivers.length,21);assert.deepEqual(drivers.candidateFixture,binding.candidateFixture);assert.equal(drivers.sourceProofSha256,binding.sourceProof.sha256);for(const row of drivers.drivers)await pin({ ...row,path:path.relative(repo,path.join(__dirname,row.path)).replace(/\\/g,'/') });
 await pin(binding.vsix);assert.equal(binding.contentEntries.length,15);for(const entry of binding.contentEntries)await pin(entry);for(const runtime of binding.runtimes)await pin(runtime);
 const review=read(relativeFile(binding.hostReview.path));await pin(binding.hostReview);assert.equal(review.currentHost.version,'1.143.1');assert.equal(review.currentHost.executable.sha256,'325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6');
 for(const row of [review.currentHost.executable,...review.currentHost.applicationFiles])await pin(row,true);
 const module=read(own('start-checkpoint-01.json'));for(const row of module.installedModule.files)await pin(row,true);
 return binding;
}
module.exports={guard,pin,repo,read,sha,own,relativeFile};
if(require.main===module)guard().then(binding=>console.log(JSON.stringify({status:'CURRENT_NATIVE_BINDING_VERIFIED_NO_CODE_LAUNCH',artifact:binding.vsix.sha256,inputs:1005,drivers:21,native06:'DEFERRED_NOT_RUN'}))).catch(()=>{console.error('F26c native binding unavailable; no Code launch authorized by this guard.');process.exitCode=1});
