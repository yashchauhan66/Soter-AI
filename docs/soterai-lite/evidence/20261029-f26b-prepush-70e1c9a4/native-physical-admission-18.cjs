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
function verifyRow(row,installed=false){assert.equal(typeof installed,"boolean");const helper=path.resolve(__dirname,'../20261028-f29-protection-center-6c93e15a/streamed-vendor-pin-08.cjs'),binding=path.join(path.dirname(helper),'accessibility-binding-01.cjs');assert.equal(sha(fs.readFileSync(helper)),'c75755d859d04551742c375b49440f7f5a1e9bc01b350440ddb4e89a4f415b90');assert.equal(sha(fs.readFileSync(binding)),'041484fc2204b3054eb72e8f9e101c77b677b0f2f71ae08aafa0b611ca4b7fe3');return require(helper).verifyStreamedPin(row,{singleLink:!installed});}
function run(expected){
 assert(process.argv.length===3&&/^[a-f0-9]{64}$/.test(expected));const bindingFile=own('native-launch-binding-09.json');ordinary(bindingFile);const raw=fs.readFileSync(bindingFile);assert.equal(sha(raw),expected);
 const b=JSON.parse(raw);assert.equal(b.status,'F26B_EXACT_CURRENT_FULL_CONTENT_NATIVE36_PREPARED_NOT_RUN_NO_PUSH');assert.equal(b.sourceProof.path,'full-inputs-03.json');assert.equal(b.sourceProof.sha256,'81fb9f8d559434242a67a316f0609a5c79c1b6b351cb783d7f3af365669f495f');
 const ownRow=row=>({...row,path:path.resolve(__dirname,row.path)});verifyRow(ownRow(b.physicalAdmission));assert.equal(path.resolve(__dirname,b.physicalAdmission.path),__filename);verifyRow(ownRow(b.sourceProof));
 const proof=JSON.parse(fs.readFileSync(own(b.sourceProof.path),'utf8'));assert.equal(proof.fileCount,1070);proof.files.forEach(row=>verifyRow(row));
 const records=[b.serial,b.content,b.driver,b.driverSource,b.caseFreeze,b.driverProvenance,b.guard,b.admission,b.candidate];records.map(ownRow).forEach(row=>verifyRow(row));verifyRow(b.hostReview);b.vendorFacts.forEach(row=>verifyRow(row,true));
 const content=JSON.parse(fs.readFileSync(own(b.content.path),'utf8')),extracted=path.resolve(__dirname,b.extractedRoot);verifyRow(b.vsix);
 for(const row of content.entries){const file=path.resolve(extracted,'..',row.path);assert(file.toLowerCase().startsWith(path.dirname(extracted).toLowerCase()+path.sep));verifyRow({...row,path:file});}
 const materialFile=own('native-launch-materialization-09.json');if(fs.existsSync(materialFile)){ordinary(materialFile);const m=JSON.parse(fs.readFileSync(materialFile,'utf8'));assert.equal(m.executableCandidate.path,'native-launch-candidate-15.ps1');assert.equal(m.executableCandidate.sha256,b.candidate.sha256);verifyRow(ownRow(m.executableCandidate));}
 ordinary(bindingFile);assert.equal(sha(fs.readFileSync(bindingFile)),expected);console.log(JSON.stringify({status:'PASS_EXACT_NODE_PHYSICAL_ANCESTRY_NOT_GUI',bindingSha256:expected,sourceFiles:1070,redirectsRefused:true}));
}
module.exports={ordinary,verifyRow};if(require.main===module)try{run(process.argv[2]);}catch(error){console.error(error instanceof Error?error.message:'Physical admission refused.');process.exitCode=1;}
