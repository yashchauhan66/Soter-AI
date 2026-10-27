const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pin,repo,read,sha,own}=require('./current-native-guard-01.cjs');
const fact=file=>{const raw=fs.readFileSync(file);return{path:path.relative(repo,file).replace(/\\/g,'/'),bytes:raw.length,sha256:sha(raw)}};
async function main(){
 const required=['compiler-06','full-tests-02','backend-typecheck-02','backend-tests-02','native-build-01','package-02','offline-inventory-02','readiness-02'];
 const receipts=required.map(name=>{const file=own(name+'.txt.result.json'),r=read(file);assert.equal(r.exitCode,0,name);assert.equal(sha(fs.readFileSync(own(name+'.txt'))),r.sha256.toLowerCase());return fact(file)});
 const full=fs.readFileSync(own('full-tests-02.txt'),'utf8');for(const[field,value]of Object.entries({tests:4303,pass:4299,fail:0,cancelled:0,skipped:4}))assert(new RegExp('^# '+field+' '+value+'\\r?$','m').test(full));
 const proof=read(own('full-inputs-02.json'));assert.equal(proof.fileCount,1003);for(const row of proof.files)await pin(row);
 const inventory=read(own('offline-inventory-02/release-inventory.json'));assert.equal(inventory.artifact.sha256,'55c587193a069fcea7b9cab27a016b9f61b8928c982e755cde51cb9ccb458965');assert.equal(inventory.runtimes.length,4);assert.equal(inventory.entries.length,15);assert.equal(inventory.releaseReady,false);
 const extracted='docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/vsix-extracted-02/extension';
 const runtimes=inventory.runtimes.map(row=>({...row,path:extracted+'/dist/'+row.name}));for(const row of runtimes)await pin(row);
 const oldPath=path.join(repo,'docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62/host-version-review-01.json'),previous=read(oldPath),host=previous.currentHost;assert.equal(host.version,'1.143.1');
 for(const row of [host.executable,...host.applicationFiles])await pin(row,true);
 const apiFile=host.applicationFiles.find(row=>row.path.endsWith('extensionHostProcess.js'));assert(apiFile);const api=fs.readFileSync(apiFile.path,'utf8');
 const witness=['registerTextDocumentContentProvider','showSaveDialog','onDidChangeConfiguration','onDidChangeWorkspaceFolders'].map(name=>{assert(api.includes(name));return{api:name,present:true,sourceSha256:apiFile.sha256,status:'STATIC_ONLY_NOT_BEHAVIOR'}});
 const review={...previous,currentFeature:'F26c',scope:'Fresh exact-byte recheck of accepted installed Code1.143.1 files plus four F26c API witnesses; no editor launched by review.',observedAt:new Date().toISOString(),priorReview:fact(oldPath),f26cApiWitnesses:witness};
 fs.writeFileSync(own('host-version-review-01.json'),JSON.stringify(review,null,2)+'\n',{flag:'wx'});
 const provenance=read(own('native-driver-provenance-01.json'));assert.equal(provenance.drivers.length,21);assert.equal(provenance.sourceProofSha256,sha(fs.readFileSync(own('full-inputs-02.json'))));
 const driver=provenance.drivers.find(row=>row.path.endsWith('/lite-psreadline-history-host.js'));assert(driver);const newDriver={...driver,path:path.relative(repo,path.join(__dirname,driver.path)).replace(/\\/g,'/')};await pin(newDriver);
 const binding={status:'BOUND_CURRENT_FULL02_BACKEND02_EXACT_ATTEMPT02_NATIVE_NOT_RUN',observedAt:new Date().toISOString(),fileCount:1003,sourceProof:fact(own('full-inputs-02.json')),requiredReceipts:receipts,driverProvenance:fact(own('native-driver-provenance-01.json')),newDriver,vsix:fact(path.join(repo,'packages/soterai-lite/soterai-lite-0.7.0-f26c-20261026-attempt02.vsix')),runtimes,frontendSha256:runtimes.find(row=>row.name==='extension.js').sha256,extractedRoot:extracted,hostReview:fact(own('host-version-review-01.json')),nativeOracles:{primary:23,restart:5,total:28,workCard:fact(own('native-work-card-01.md'))},native06:'DEFERRED_NOT_RUN',coverage:'NO_NATIVE_BEHAVIOR_PASS_YET'};
 fs.writeFileSync(own('native-binding-01.json'),JSON.stringify(binding,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:binding.status,artifact:binding.vsix.sha256,frontend:binding.frontendSha256,sourceInputs:1003,drivers:21,nativeChecksPrepared:28,full:{tests:4303,pass:4299,skipped:4,fail:0},native06:'DEFERRED_NOT_RUN'}));
}
main().catch(()=>{console.error('F26c native binding refused; no editor launch.');process.exitCode=1});
