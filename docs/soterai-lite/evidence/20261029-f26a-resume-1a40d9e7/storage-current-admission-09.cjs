'use strict';
// Read-only current artifact admission; never launches Code, Git or a listener.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const H=require('../20261028-f30-setup-verification-847d2f09/current-native-guard-02.cjs');
const {repo,pin,pinSource,relativeFile,sha,fact}=H,own=n=>path.join(__dirname,n),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const STEPS=['compiler-09','backend-typecheck-08','backend-tests-08','full-tests-09','readiness-09','package-09','content-09','native-build-09'];
async function canonical(name){const r=read(own(name+'.txt.result.json')),raw=fs.readFileSync(own(name+'.txt'));assert.equal(r.exitCode,0,name);assert.equal(sha(raw),r.sha256.toLowerCase(),name);return raw;}
async function closed(name){
 const c=read(own(name+'-owned-close.json')),v=read(own(name+'-verification.json'));
 for(const [key,value]of Object.entries({actualClose:true,wrapperExit:0,innerExit:0,signal:null,stdoutEOF:true,stderrEOF:true,deadlineExceeded:false,signalsRequested:0}))assert.equal(v[key],value,name+':'+key);
 assert.equal(v.status,'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT');
 for(const [key,value]of Object.entries({actualClose:true,exitCode:0,signal:null,stdoutEOF:true,stderrEOF:true,overflow:false,streamError:false,deadlineExceeded:false,signalsRequested:0}))assert.equal(c[key],value,name+':'+key);
 for(const channel of ['stdout','stderr']){const b=fs.readFileSync(own(name+'-'+channel+'.bin')),r=c.streams.find(r=>r.name===channel);assert(r);assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);}
 await canonical(name);
}
function originalChecks(){
 const freeze=read(own('native-host-freeze-02.json'));assert.equal(freeze.primary.length,30);assert.equal(freeze.restart.length,4);assert.equal(freeze.sha256,'d773858448cd4969d47d258915098519acb856f1afa28f6ca6cab2c0a8e33741');pinSource({path:freeze.file,bytes:freeze.bytes,sha256:freeze.sha256});
 const original=fs.readFileSync(relativeFile(freeze.file),'utf8'),modified=fs.readFileSync(own('f26a-install-diagnostics-08.host.ts'),'utf8'),review=read(own('diagnostic-transform-08.json'));let reversed=modified;
 for(const r of [...review.changes].reverse()){assert.equal(reversed.split(r.after).length,2);reversed=reversed.replace(r.after,r.before);}assert.equal(reversed,original);
 const checks=text=>{const sf=ts.createSourceFile('fixture.ts',text,ts.ScriptTarget.Latest,true),rows=[];function visit(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='add')rows.push(n.getText(sf));ts.forEachChild(n,visit);}visit(sf);return rows;};assert.equal(checks(original).length,34);assert.deepEqual(checks(modified),checks(original));
}
async function validate(b){
 assert.equal(b.status,'FRESH1037_FULL09_COMPILER09_BUILD09_ATTEMPT02_BOUND_NATIVE_NOT_RUN');assert.equal(b.feature,'F26a');assert.equal(b.fileCount,1037);assert.equal(b.native08,'NOT_AUTHORIZED_NOT_RUN');
 assert.equal(relativeFile(b.sourceProof.path),own('full-inputs-09.json'));assert.equal(b.sourceProof.sha256,'f3ca94a5d02afef843bc0020b18b95b8d9129b4cf7d31ead7c87af019dd10e52');await pin(b.sourceProof);
 const proof=read(relativeFile(b.sourceProof.path));assert.equal(proof.fileCount,1037);assert.equal(proof.files.length,1037);assert.equal(new Set(proof.files.map(r=>r.path)).size,1037);assert.equal(proof.changedSource.length,3);for(const r of proof.files)pinSource(r);
 for(const name of STEPS)await closed(name);
 const serial=read(own('storage-serial-result-09.json'));assert.equal(serial.status,'CURRENT_F26A_STORAGE_FIX_SERIAL_SOURCE_AND_PACKAGE_PASS_NATIVE_CONTENT_PENDING');assert.deepEqual(serial.results.map(r=>r.name),STEPS.slice(0,6));assert(serial.results.every(r=>r.status==='PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT'&&r.actualClose&&r.stdoutEOF&&r.stderrEOF&&r.wrapperExit===0&&r.innerExit===0&&r.signalsRequested===0));
 const post=read(own('storage-postfull-result-09.json'));assert.equal(post.status,'CURRENT_CONTENT_DRIVERS_PASS_NATIVE08_NOT_AUTHORIZED_NOT_RUN');assert.deepEqual(post.results.map(r=>r.name),STEPS.slice(6));
 const full=(await canonical('full-tests-09')).toString(),count=k=>{const m=full.match(new RegExp('^# '+k+' (\\d+)$','m'));assert(m,k);return Number(m[1]);};assert.deepEqual({tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped')},{tests:4475,pass:4471,fail:0,cancelled:0,skipped:4});
 assert.equal(relativeFile(b.contentInspection.path),own('content-inspection-09.json'));await pin(b.contentInspection);const content=read(relativeFile(b.contentInspection.path));assert.equal(content.sourceCount,1037);assert.deepEqual(content.full,{tests:4475,pass:4471,fail:0,cancelled:0,skipped:4});assert.equal(content.entryCount,15);assert.equal(content.runtimeCount,4);assert.equal(content.machineSettings,86);assert.equal(content.releaseReady,false);
 assert.equal(b.vsix.path,'packages/soterai-lite/soterai-lite-0.7.0-f26a-20261029-attempt02.vsix');assert.equal(content.vsix.output.replace(/\\/g,'/'),b.vsix.path);assert.equal(content.vsix.sha256,b.vsix.sha256);assert.equal(content.vsix.bytes,b.vsix.bytes);assert.equal(content.vsix.extensionSha256,b.frontendSha256);await pin(b.vsix);
 assert.equal(b.extractedRoot,content.extractedRoot);assert.equal(relativeFile(b.extractedRoot),own('vsix-extracted-09/extension'));assert.equal(b.runtimes.length,4);const entries=content.entries.map(r=>({...r,path:path.relative(repo,own('vsix-extracted-09/'+r.path)).replace(/\\/g,'/')}));assert.deepEqual(b.contentEntries,entries);for(const r of entries)await pin(r);
 for(const r of b.runtimes){await pin(r);assert.equal(relativeFile(r.path),path.join(relativeFile(b.extractedRoot),'dist',r.name));assert(entries.some(e=>e.path===r.path&&e.bytes===r.bytes&&e.sha256===r.sha256));}
 assert.equal(b.runtimes.find(r=>r.name==='extension.js').sha256,b.frontendSha256);
 assert.equal(relativeFile(b.driverProvenance.path),own('native-driver-provenance-09.json'));await pin(b.driverProvenance);const drivers=read(relativeFile(b.driverProvenance.path));assert.equal(drivers.status,'BUILT_CURRENT1037_DRIVERS25_NOT_NATIVE_ACCEPTANCE');assert.equal(drivers.compiler,'compiler-09');assert.deepEqual(drivers.sourceProof,b.sourceProof);assert.equal(drivers.drivers.length,25);assert.equal(drivers.unchangedDriverCount,25);assert.equal(drivers.originalOracles,34);
 for(const r of drivers.drivers)await pin({...r,path:path.relative(repo,own(r.path)).replace(/\\/g,'/')});for(const r of [...drivers.sourceInputs,...drivers.auxiliaryInputs])await pin(r);
 await pin(b.newDriver);const selected=drivers.drivers.find(r=>r.path.endsWith('/lite-precommit-guard-host.js'));assert.equal(selected.sha256,b.newDriver.sha256);assert.equal(selected.bytes,b.newDriver.bytes);assert.equal(relativeFile(b.newDriver.path),own(selected.path));assert.equal(b.newDriver.sha256,'8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced');assert.equal(b.newDriver.bytes,74473);originalChecks();
 for(const name of ['storage-uri-focused-01','storage-uri-lite-cwd-02','native-typecheck-08','install-diagnostics-component-07','diagnostic-delegation-08','native07-syntax-01','storage-clock-focused-09'])await canonical(name);
 await pin(b.hostReview);const host=read(relativeFile(b.hostReview.path));assert.equal(host.currentHost.version,'1.143.1');assert.equal(host.currentHost.executable.sha256,'325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6');for(const r of [host.currentHost.executable,...host.currentHost.applicationFiles])await pin(r,true);
 await pin(b.historyModuleCheckpoint);const history=read(relativeFile(b.historyModuleCheckpoint.path));assert.equal(history.installedModule.files.length,4);for(const r of history.installedModule.files)await pin(r,true);
 await pin(b.toolInventory);const inventory=read(relativeFile(b.toolInventory.path)),{verifyStreamedPin}=require('../20261028-f29-protection-center-6c93e15a/streamed-vendor-pin-08.cjs');assert.equal(inventory.pins.length,11);for(const r of inventory.pins)verifyStreamedPin(r,{singleLink:!path.isAbsolute(r.path)||r.path.toLowerCase().startsWith(repo.toLowerCase()+path.sep)});assert.equal(inventory.versions.playwright,'1.61.1');assert.equal(inventory.versions.axe,'4.12.1');
 assert.equal(b.nativeOracles.primary,30);assert.equal(b.nativeOracles.restart,4);for(const r of b.facts)await pin(r);return b;
}
async function guard(){return validate(read(own('native-current-binding-09.json')));}
module.exports={guard,validate,repo,own,read,sha,fact,pin,pinSource,relativeFile,STEPS};
if(require.main===module)guard().then(b=>console.log(JSON.stringify({status:'CURRENT1037_STORAGE_FIX_METADATA_ADMISSION_PASS_NATIVE08_NOT_AUTHORIZED',sources:1037,full:4475,drivers:25,oracles:34,vsix:b.vsix.sha256}))).catch(e=>{console.error(e);process.exitCode=1;});
