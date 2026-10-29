'use strict';
// Read-only filesystem admission. Cloud placeholders are not redirect links:
// require actual Node link classification AND an exact physical path instead.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function ordinary(file,allowInstalledGit=false){
 const absolute=path.resolve(file),same=(a,b)=>a.toLowerCase()===b.toLowerCase();
 assert(same(fs.realpathSync.native(absolute),absolute),'Physical redirect refused.');
 for(let current=absolute;;){const stat=fs.lstatSync(current,{bigint:true});assert(!stat.isSymbolicLink(),'Linked ancestry refused.');const parent=path.dirname(current);if(parent===current)break;current=parent;}
 const stat=fs.lstatSync(absolute,{bigint:true});assert(stat.isFile()||stat.isDirectory(),'Ordinary file/directory required.');
 if(stat.isFile())assert(stat.nlink===(allowInstalledGit?2n:1n),'Unexpected file links.');
 return stat;
}
function verifyRow(row){
 assert(row&&typeof row.path==='string'&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=536870912&&/^[a-f0-9]{64}$/.test(row.sha256));
 const file=path.isAbsolute(row.path)?row.path:path.resolve(repo,row.path),git=file.toLowerCase()==='c:\\program files\\git\\cmd\\git.exe';
 const before=ordinary(file,git),hash=crypto.createHash('sha256'),buffer=Buffer.alloc(65536),fd=fs.openSync(file,'r');let total=0;
 try{for(;;){const n=fs.readSync(fd,buffer,0,buffer.length,null);if(!n)break;total+=n;assert(total<=row.bytes);hash.update(buffer.subarray(0,n));}}finally{fs.closeSync(fd);buffer.fill(0);}
 const after=ordinary(file,git);for(const key of ['dev','ino','size','mtimeNs','ctimeNs','birthtimeNs','nlink'])assert.equal(before[key],after[key]);assert.equal(total,row.bytes);assert.equal(hash.digest('hex'),row.sha256);
}
function run(expected){
 assert(process.argv.length===3&&/^[a-f0-9]{64}$/.test(expected));const bindingFile=own('native-launch-binding-02.json');ordinary(bindingFile);const raw=fs.readFileSync(bindingFile);assert.equal(sha(raw),expected);
 const b=JSON.parse(raw);assert.equal(b.status,'F26B_EXACT_CURRENT_FULL_CONTENT_NATIVE36_PREPARED_NOT_RUN_NO_PUSH');assert.equal(b.sourceProof.path,'full-inputs-03.json');assert.equal(b.sourceProof.sha256,'81fb9f8d559434242a67a316f0609a5c79c1b6b351cb783d7f3af365669f495f');
 const ownRow=row=>({...row,path:path.resolve(__dirname,row.path)});verifyRow(ownRow(b.physicalAdmission));assert.equal(path.resolve(__dirname,b.physicalAdmission.path),__filename);verifyRow(ownRow(b.sourceProof));
 const proof=JSON.parse(fs.readFileSync(own(b.sourceProof.path),'utf8'));assert.equal(proof.fileCount,1070);proof.files.forEach(verifyRow);
 const records=[b.serial,b.content,b.driver,b.driverSource,b.caseFreeze,b.driverProvenance,b.guard,b.admission,b.candidate];records.map(ownRow).forEach(verifyRow);verifyRow(b.hostReview);b.vendorFacts.forEach(verifyRow);
 const content=JSON.parse(fs.readFileSync(own(b.content.path),'utf8')),extracted=path.resolve(__dirname,b.extractedRoot);verifyRow(b.vsix);
 for(const row of content.entries){const file=path.resolve(extracted,'..',row.path);assert(file.toLowerCase().startsWith(path.dirname(extracted).toLowerCase()+path.sep));verifyRow({...row,path:file});}
 ordinary(bindingFile);assert.equal(sha(fs.readFileSync(bindingFile)),expected);console.log(JSON.stringify({status:'PASS_EXACT_NODE_PHYSICAL_ANCESTRY_NOT_GUI',bindingSha256:expected,sourceFiles:1070,redirectsRefused:true}));
}
module.exports={ordinary,verifyRow};if(require.main===module)try{run(process.argv[2]);}catch(error){console.error(error instanceof Error?error.message:'Physical admission refused.');process.exitCode=1;}
