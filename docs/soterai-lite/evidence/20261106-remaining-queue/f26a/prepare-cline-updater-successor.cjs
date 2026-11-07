'use strict';
// Evidence-only successor. Root owns the eventual native launch after updater absence.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const repo=path.resolve(__dirname,'../../../../..'),old=path.join(repo,'docs/soterai-lite/evidence/20261106-v01-cline-01'),out=path.join(repo,'docs/soterai-lite/evidence/20261106-v01-cline-02');
const own=n=>path.join(out,n),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fact=p=>{const raw=fs.readFileSync(p);return{path:path.relative(repo,p).replaceAll('\\','/'),bytes:raw.length,sha256:sha(raw)};};
const pin=row=>{const p=path.resolve(repo,row.path),st=fs.lstatSync(p);assert(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1);assert.deepEqual({bytes:st.size,sha256:sha(fs.readFileSync(p))},{bytes:row.bytes,sha256:row.sha256},p);return p;};
const put=(name,value)=>fs.writeFileSync(own(name),typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const once=(text,from,to)=>{assert.equal(text.split(from).length,2,from);return text.replace(from,to);};
function prepare(){
 const r=read(path.join(old,'route-binding.json')),failed='f18-product-20261106T150514Z-a872bfe3',failedDir=path.join(old,failed);
 assert.equal(r.id,'cline');assert.equal(r.count,20);assert.equal(r.vsix.sha256,'011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec');
 const close=read(path.join(old,'route-owned-close.json')),editor=read(path.join(failedDir,'owned-editor-close.json')),error=fs.readFileSync(path.join(failedDir,'stderr.txt'),'utf8');
 assert(close.actualClose&&close.exitCode===1&&close.stdoutEOF&&close.stderrEOF&&close.signalsRequested===0);assert(editor.observedExit&&editor.exitCode===1&&editor.stdoutEOF&&editor.stderrEOF);
 assert(error.includes('checkInnoSetupMutex: vscode-updating still held'));assert(error.includes('Code is currently being updated.'));assert(!fs.existsSync(path.join(failedDir,'product-result.json')));
 const before=read(path.join(old,'public-vendor-relocation-before.json')),relocation=read(path.join(old,'public-vendor-relocation.json'));
 assert.equal(relocation.status,'COMPLETE_BYTE_EXACT_SCOPED_PUBLIC_VENDOR_RELOCATION');assert.equal(relocation.beforeReceiptSha256,fact(path.join(old,'public-vendor-relocation-before.json')).sha256);
 assert.equal(before.originalBindingSha256,fact(path.join(old,'route-binding.json')).sha256);assert.equal(before.files,38);assert.equal(before.bytes,38239400);assert.equal(before.entries.length,38);
 const archive=path.resolve('D:/SoterAI-Lite-test-profiles/cline01-public-vendor-archive-20261106-3a1d7b9c/public-vendor');assert.equal(path.resolve(before.archiveRoot),archive);assert.equal(path.resolve(relocation.archiveRoot),archive);
 const publicRows=before.entries.map(row=>{assert(path.resolve(row.archive).startsWith(archive+path.sep));const result={path:row.archive,bytes:row.bytes,sha256:row.sha256};pin(result);return result;});
 assert.equal(publicRows.reduce((n,row)=>n+row.bytes,0),38239400);assert.equal(publicRows.length,r.publicInputs.length);
 assert(!fs.existsSync(out),'Fresh successor required');fs.mkdirSync(out);
 for(const name of ['product-matrix-05.cjs','matrix-guards-01.cjs','run-v01-route.cjs','pipe-ownership.ps1','route-inspection.json','test-generated-hook-04.ts']){const original=r.fixtureInputs.find(row=>path.basename(row.path)===name);assert(original);pin(original);put(name,fs.readFileSync(path.join(old,name)));}
 const updater=`# Read-only external updater observation; never acquire the mutex or stop the updater.
$ErrorActionPreference='Stop'
function Assert-ClineUpdaterIdle {
 $taskMutex=$null;$taskPresent=$false
 try{$taskMutex=[Threading.Mutex]::OpenExisting('vscode-updating');$taskPresent=$true}catch [Threading.WaitHandleCannotBeOpenedException]{$taskPresent=$false}finally{if($null -ne $taskMutex){$taskMutex.Dispose()}}
 if($taskPresent){throw 'CLINE_NATIVE_PREFLIGHT_UPDATER_BUSY_NO_CODE_LAUNCH'}
 $taskSetups=@(Get-Process -Name '*Code*Setup*','*Inno*' -ErrorAction SilentlyContinue)
 if($taskSetups.Count -gt 0){throw 'CLINE_NATIVE_PREFLIGHT_SETUP_PROCESS_PRESENT_NO_CODE_LAUNCH'}
}
`;
 put('updater-preflight.ps1',updater);
 let admission=fs.readFileSync(path.join(old,'route-admission.cjs'),'utf8');pin(r.fixtureInputs.find(row=>path.basename(row.path)==='route-admission.cjs'));
 admission=once(admission,'...r.publicInputs, ...r.fixtureInputs]','...r.publicInputs, ...r.fixtureInputs, ...r.failedAttemptInputs]');put('route-admission.cjs',admission);
 let wrapper=fs.readFileSync(pin(r.wrapper),'utf8');
 wrapper=once(wrapper,r.fixtureInputs.find(row=>path.basename(row.path)==='route-admission.cjs').sha256,fact(own('route-admission.cjs')).sha256);
 wrapper=once(wrapper,"$taskVendor='"+path.join(old,'public-vendor')+"'","$taskVendor='"+archive+"'");
 const initial=". (Join-Path $PSScriptRoot 'pipe-ownership.ps1')";
 wrapper=once(wrapper,initial,initial+"\n$taskUpdaterGuard=Join-Path $PSScriptRoot 'updater-preflight.ps1'\nif((Get-FileHash -LiteralPath $taskUpdaterGuard -Algorithm SHA256).Hash.ToLowerInvariant() -cne '"+fact(own('updater-preflight.ps1')).sha256+"'){throw 'Cline updater preflight changed'}\n. $taskUpdaterGuard\nAssert-ClineUpdaterIdle");
 wrapper=once(wrapper,'[void]$taskProcess.Start();','Assert-ClineUpdaterIdle\n [void]$taskProcess.Start();');put('run-current-route.ps1',wrapper);
 const vendor=read(path.join(old,'installed-public-inputs-01.json'));
 const relocateInput=row=>{const relative=path.relative(path.join(old,'public-vendor'),path.resolve(row.path));assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));const next={...row,path:path.join(archive,relative)};pin(next);return next;};
 vendor.root=archive;vendor.inputs=vendor.inputs.map(relocateInput);vendor.preparation={...vendor.preparation,successorObservedAt:new Date().toISOString(),archiveRelocation:fact(path.join(old,'public-vendor-relocation.json')),currentInstalledVersionCovered:false};put('installed-public-inputs-01.json',vendor);
 r.selectedInputs=r.selectedInputs.map(relocateInput);r.publicInputs=publicRows;r.vendorUse=vendor.preparation;r.wrapper=fact(own('run-current-route.ps1'));r.driver=fact(own('product-matrix-05.cjs'));r.guard=fact(own('matrix-guards-01.cjs'));r.hook.driver=fact(own('test-generated-hook-04.ts'));
 r.copied=r.copied.map(row=>({...row,target:fact(own(path.basename(row.target.path)))}));
 r.fixtureInputs=r.fixtureInputs.map(row=>fact(own(path.basename(row.path))));r.fixtureInputs.push(fact(own('updater-preflight.ps1')));
 r.failedAttemptInputs=['route-binding.json','route-owned-close.json','route-failure.json','public-vendor-relocation-before.json','public-vendor-relocation.json',failed+'/owned-editor-close.json',failed+'/helper-pipe-ownership.json',failed+'/stderr.txt',failed+'/stdout.txt',failed+'/freeze.json'].map(name=>fact(path.join(old,name)));
 r.successor={reason:'External vscode-updating mutex caused Code main-process refusal before Cline product activation',priorFailurePreserved:true,newProductEdits:0,assertionsUnchanged:true,driverSha256:r.driver.sha256,guardSha256:r.guard.sha256,preflight:'Read-only updater absence required before profile creation and Code start; no bypass/signals',vendorRelocation:'Exactly38 public vendor files moved to verified D archive; same public bytes',priorResultTransfer:false};
 put('route-binding.json',r);
 put('syntax.ps1',"$ErrorActionPreference='Stop'\n$taskTokens=$null;$taskErrors=$null\nforeach($taskName in @('run-current-route.ps1','pipe-ownership.ps1','updater-preflight.ps1')){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count){throw ($taskErrors|Out-String)}}\nWrite-Output 'PASS: successor syntax only; no native launch'\n");
 for(const name of ['route-admission.cjs','run-v01-route.cjs','product-matrix-05.cjs','matrix-guards-01.cjs'])new vm.Script(fs.readFileSync(own(name),'utf8'),{filename:name});
 require(own('route-admission.cjs')).validate();
 const result={status:'PREPARED_CURRENT_CLINE20_HOOK4_UPDATER_IDLE_REQUIRED_NOT_RUN',at:new Date().toISOString(),binding:fact(own('route-binding.json')),runner:fact(own('run-v01-route.cjs')),sourceProof:r.sourceProof,vsix:r.vsix,originalDriver:r.driver,guard:r.guard,priorFailure:r.failedAttemptInputs,newNativeLaunches:0,productWrites:0,releaseReady:false};put('preparation.json',result);console.log(JSON.stringify(result));return result;
}
module.exports={prepare};if(require.main===module){try{prepare();}catch(error){console.error(error);process.exitCode=1;}}
