// Build one current F29 admission receipt only after corrected03 inputs exist.
// No host/browser launch. Existing files and proofs are never overwritten.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {validateBinding,repo,read,sha,own,relativeName,STATUS,REQUIRED,SERIAL_NAMES}=require('./current-native-guard-01.cjs');
const fact=file=>{const before=fs.lstatSync(file);assert(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1);const raw=fs.readFileSync(file),after=fs.lstatSync(file);for(const key of ['size','ino','mtimeMs','ctimeMs'])assert.equal(before[key],after[key]);assert.equal(raw.length,before.size);return{path:relativeName(file),bytes:raw.length,sha256:sha(raw)};};
async function main(){
 const target=own('native-binding-01.json');assert(!fs.existsSync(target),'Existing admission receipt refuses overwrite.');
 // Read successor03/provenance02 first; missing corrected fixtures refuse before writes.
 const candidateFixture=fact(own('f29-native03.host.ts')),driverProvenance=fact(own('native-driver-provenance-02.json'));
 const drivers=read(path.join(repo,driverProvenance.path)),selected=drivers.drivers.find(row=>path.basename(row.path)==='lite-f29-protection-center-host.js');assert(selected);
 const inspection=read(own('content-inspection-01.json'));
 const ownedSteps=[...new Set([...REQUIRED,...SERIAL_NAMES])].map(name=>({name,
  canonical:fact(own(name+'.txt.result.json')),output:fact(own(name+'.txt')),verification:fact(own(name+'-verification.json')),ownedClose:fact(own(name+'-owned-close.json')),stdout:fact(own(name+'-stdout.bin')),stderr:fact(own(name+'-stderr.bin'))}));
 const hostReview=fact(path.join(repo,'docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/host-version-review-proposal06.json'));
 const binding={status:STATUS,observedAt:new Date().toISOString(),fileCount:1024,sourceProof:fact(own('full-inputs-03.json')),
  requiredReceipts:REQUIRED.map(name=>fact(own(name+'.txt.result.json'))),ownedSteps,serialResult:fact(own('serial-result-03.json')),
  driverProvenance,previousDriverProvenance:fact(own('native-driver-provenance-01.json')),candidateFixture,newDriver:fact(path.resolve(__dirname,selected.path)),
  nativeOracles:{primary:25,restart:5,total:30},executionScope:'F29_INITIAL_INSTALLED_OWNER_NATIVE_API_VERIFICATION',
  vsix:fact(path.join(repo,path.normalize(inspection.vsix.output))),frontendSha256:inspection.vsix.extensionSha256,
  extractedRoot:inspection.extractedRoot,contentInspection:fact(own('content-inspection-01.json')),
  contentEntries:inspection.entries.map(row=>({...row,path:relativeName(own('vsix-extracted-01/'+row.path))})),
  runtimes:['extension.js','local-ai-broker.js','pre-commit-client.js','soterai-mcp-server.js'].map(name=>({name,...fact(path.join(repo,inspection.extractedRoot,'dist',name))})),
  hostReview,historyModuleCheckpoint:fact(path.join(repo,'docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/start-checkpoint-01.json')),
  native06:'F26a_USER_DEFERRED_NOT_RUN',coverage:'NO_F29_NATIVE_OR_RENDERER_BEHAVIOR_PASS_YET',independence:'LOW_SAME_LINEAGE_NOT_HUMAN'};
 await validateBinding(binding);
 fs.writeFileSync(target,JSON.stringify(binding,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'CURRENT_F29_NATIVE_BINDING_MATERIALIZED_NOT_RUN',artifact:binding.vsix.sha256,inputs:1024,drivers:23,oracles:binding.nativeOracles,native06:binding.native06}));
}
main().catch(()=>{console.error('F29 native binding not materialized; corrected fixtures, receipts and every current pin must be available. No host or browser launched.');process.exitCode=1;});
