// New exact binding only; never executes a runtime or accepts a feature.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),home=path.relative(repo,__dirname).replace(/\\/g,'/'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
function pin(name){const file=path.resolve(repo,name);assert(file.startsWith(repo+path.sep));const raw=fs.readFileSync(file);return {path:path.relative(repo,file).replace(/\\/g,'/'),bytes:raw.length,sha256:sha(raw)};}
assert.equal(read(own('content-watcher-result-02.json')).status,'CONTENT_WRAPPER_CLOSED_PASS_NATIVE_NOT_RUN');
const inspection=read(own('content-inspection-01.json'));assert.equal(inspection.status,'CONTENT_AND_OFFLINE_INVENTORY_PASS_NOT_NATIVE_OR_FEATURE_ACCEPTANCE');assert.equal(inspection.sourceCount,1016);
const result=read(own('content-02.txt.result.json'));assert.equal(result.exitCode,0);assert.equal(sha(fs.readFileSync(own('content-02.txt'))),result.sha256.toLowerCase());
const closed=read(own('content-02-owned-close.json'));assert.equal(closed.actualClose,true);assert.equal(closed.stdoutEOF,true);assert.equal(closed.stderrEOF,true);assert.equal(closed.signal,null);assert.equal(closed.wrapperExit,0);assert.equal(closed.signalsRequested,0);
const template=read(own('compiled-runtime-binding-01.template.json'));
const binding={...template,status:template.expectedBoundStatus,observedAt:new Date().toISOString(),fixture:pin(home+'/compiled-runtime-fixture-01.cjs'),serialDriver:pin(home+'/run-serial-04.cjs'),serialResult:pin(home+'/serial-result-03.json')};
binding.requiredReceipts=['compiler-06','backend-typecheck-03','backend-tests-03','full-tests-02','readiness-02','package-01'].map(name=>({name,receipt:pin(home+'/'+name+'.txt.result.json'),close:pin(home+'/'+name+'-owned-close.json'),stdout:pin(home+'/'+name+'-wrapper-stdout.bin'),stderr:pin(home+'/'+name+'-wrapper-stderr.bin')}));
binding.vsix=pin(inspection.vsix.output);assert.equal(binding.vsix.sha256,inspection.vsix.sha256);assert.equal(binding.vsix.bytes,inspection.vsix.bytes);
binding.buildProvenance=pin(inspection.buildReceipt);binding.packageReceipt=pin(path.posix.dirname(inspection.buildReceipt)+'/package-receipt.json');
const inventory=read(own('offline-inventory-01/release-inventory.json'));binding.entries=inventory.entries;binding.runtimes=inventory.runtimes;
assert.equal(binding.entries.length,15);assert.equal(binding.runtimes.length,4);assert.equal(binding.fileCount,1016);
binding.contentInspection=pin(home+'/content-inspection-01.json');delete binding.receiptGroupShape;delete binding.expectedBoundStatus;delete binding.rootHandoff;
const output=own('compiled-runtime-binding-01.json');fs.writeFileSync(output,JSON.stringify(binding,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'BOUND_NOT_EXECUTED',binding:pin(home+'/compiled-runtime-binding-01.json'),candidate:binding.vsix,native:'NOT_RUN',native06:'F26a_USER_DEFERRED_NOT_RUN'}));
