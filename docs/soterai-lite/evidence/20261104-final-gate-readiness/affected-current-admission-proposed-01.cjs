'use strict';
// Read-only exact-input gate for the final affected workflow fixtures. No native launch.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),base=path.resolve(__dirname,'../20261103-f32-lifecycle-2e95d6a4');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
function location(r){return path.isAbsolute(r.path)?path.resolve(r.path):path.resolve(repo,r.path);}
function fact(file){const raw=fs.readFileSync(file);return{path:path.relative(repo,file).replaceAll('\\','/'),bytes:raw.length,sha256:sha(raw)};}
function pin(row){
 const file=location(row),before=fs.lstatSync(file);assert(before.isFile()&&!before.isSymbolicLink());assert.equal(before.size,row.bytes,file);assert.equal(before.nlink,row.fileLinkCount??1,file+': links');
 for(let p=path.dirname(file);p!==path.dirname(p);p=path.dirname(p))assert(!fs.lstatSync(p).isSymbolicLink(),file+': linked parent');
 const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(65536),hash=crypto.createHash('sha256');let bytes=0;
 try{let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))){bytes+=n;hash.update(buffer.subarray(0,n));}const after=fs.fstatSync(fd);assert.equal(after.ino,before.ino);assert.equal(after.mtimeMs,before.mtimeMs);assert.equal(after.size,before.size);}finally{fs.closeSync(fd);}
 assert.equal(bytes,row.bytes);assert.equal(hash.digest('hex'),row.sha256,file);return file;
}
function closed(row){pin(row);const v=read(location(row));for(const[k,x]of Object.entries({actualClose:true,exitCode:0,signal:null,stdoutEOF:true,stderrEOF:true,overflow:false,streamError:false,deadlineExceeded:false,signalsRequested:0}))assert.equal(v[k],x,row.path+':'+k);for(const s of v.streams){assert(['stdout','stderr'].includes(s.name));assert.equal(s.bytes,s.observedBytes);pin({path:location(row).replace(/-owned-close\.json$/,'-'+s.name+'.bin'),bytes:s.bytes,sha256:s.sha256});}}
function sources(){const f=path.join(base,'full-inputs-04.json');assert.equal(fact(f).sha256,'21a9721cade24be9cb76a03350273dbc79f1f8e0e913bc92d7a1c5385db8b764');const p=read(f);assert.equal(p.files.length,1110);assert.equal(p.scopedSource.length,29);p.files.forEach(pin);return p;}
function binding(){
 const b=read(own('prepared-affected-binding-01.json'));assert.equal(b.status,'F32_CURRENT_AFFECTED20_509_37_PREPARED_NOT_RUN');assert.equal(b.f26a,'USER_SKIPPED_NO_MORE_ORIGINAL34_OR_NATIVE_RUNS');assert.equal(b.gitPushAuthorized,false);assert.equal(b.configuredPush,'NO_REMAINING_AUTHORITY_NOT_RUN');assert.equal(b.signalsRequested,0);
 assert.equal(b.vsix.sha256,'e2ce3dc44d45b5e160ab0f95d713a9434a9ea7d610ce7abd2bf2500abe89d649');assert.equal(b.frontendSha256,'b611dee998d11824d523b3d561704f4a5dc15e27274e6e1d85c7154b9d42cfa0');pin(b.vsix);sources();pin(b.sourceProof);
 pin(b.qualification);const q=read(location(b.qualification));assert.equal(q.sourceProofSha256,b.sourceProof.sha256);assert.equal(q.vsix.sha256,b.vsix.sha256);assert.deepEqual(q.full,{tests:4891,pass:4887,fail:0,cancelled:0,skipped:4,todo:0});for(const c of q.ownedCloseReceipts)closed(c);
 pin(b.fullAcceptance);assert.equal(b.fullAcceptance.sha256,q.fullAcceptanceSha256);const full=read(location(b.fullAcceptance));assert.equal(full.sourceProofSha256,b.sourceProof.sha256);assert.equal(full.fileCount,357);assert.deepEqual(full.counts,q.full);
 pin(b.content);const content=read(location(b.content));assert.equal(content.status,'PASS_FINAL_OFFLINE_PACKAGE_NOT_RELEASE_READY');assert.equal(content.artifact.sha256,b.vsix.sha256);assert.equal(content.entries.length,18);assert.equal(content.runtimes.length,4);
 for(const row of content.entries.filter(r=>r.path.startsWith('extension/')))pin({...row,path:path.resolve(repo,b.extractedRoot,'..',row.path)});
 assert.equal(b.runtimes.length,4);b.runtimes.forEach(pin);const manifest=read(path.resolve(repo,b.extractedRoot,'package.json'));assert.equal(manifest.soteraiLiteRelease.unsupportedFeatures.includes('preCommit'),true);assert.equal(manifest.capabilities.virtualWorkspaces.supported,false);
 pin(b.hostReview);const vendor=read(location(b.hostReview));assert.equal(vendor.currentHost.version,'1.144.1');assert.equal(vendor.currentHost.commit,'261c84cb1eddf11235f9e2c921425e9663fbe556');assert.equal(vendor.currentHost.executable.sha256,'af032b86db394d21ba86872f4237a11b8395d2f57e8187963a3718a2cc6666ad');b.vendorFacts.forEach(pin);
 pin(b.signatureReceipt);const signatures=read(location(b.signatureReceipt));assert.equal(signatures.vendorReceiptSha256,b.hostReview.sha256);assert.equal(signatures.rows[0].status,'Valid');assert(signatures.rows[0].signerSubject.includes('Microsoft Corporation'));assert.equal(signatures.rows[0].sha256,vendor.currentHost.executable.sha256);
 pin(b.driverProvenance);const p=read(location(b.driverProvenance));assert.equal(p.drivers.length,20);for(const r of [...p.drivers,...p.sourceInputs,...p.auxiliaryInputs])pin(r);
 assert.equal(b.families.length,20);assert.equal(b.families.reduce((n,f)=>n+f.assertions,0),509);assert.equal(b.families.reduce((n,f)=>n+f.phases,0),37);assert(!b.families.some(f=>/precommit|pre-commit/i.test(f.id+f.driver.path)));assert.equal(b.functional,10);assert.equal(b.security,17);
 for(const r of b.fixtureInputs)pin(r);return b;
}
module.exports={repo,own,read,sha,fact,pin,location,sources,binding};
if(require.main===module)try{const b=binding();console.log(JSON.stringify(process.argv.includes('--emit-binding')?b:{status:'PASS_F32_READ_ONLY_EXACT_AFFECTED_INPUTS_NOT_NATIVE',families:20,checks:509,phases:37,functional:10,security:17,nativeLaunches:0}));}catch(e){console.error(e);process.exitCode=1;}
