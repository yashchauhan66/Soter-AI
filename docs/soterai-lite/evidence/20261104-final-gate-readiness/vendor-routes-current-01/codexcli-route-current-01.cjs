'use strict';
// Inert current-object admission and owned runner. No import-time native action.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../../..'),F=path.join(repo,'docs/soterai-lite/evidence/20261103-f32-lifecycle-2e95d6a4');
const historical=path.join(repo,'docs/soterai-lite/evidence/20261020-f20c-gemini-cli-8a6d3e70');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),own=n=>path.join(__dirname,n);
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
function regular(f){const s=fs.lstatSync(f);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1);return s;}
function fact(f){const s=regular(f),fd=fs.openSync(f,'r'),chunk=Buffer.alloc(65536),digest=crypto.createHash('sha256');let bytes=0;
 try{while(true){const n=fs.readSync(fd,chunk,0,chunk.length,null);if(!n)break;bytes+=n;assert(bytes<=s.size);digest.update(chunk.subarray(0,n));}const a=fs.fstatSync(fd);assert.equal(a.ino,s.ino);assert.equal(a.size,s.size);assert.equal(a.mtimeMs,s.mtimeMs);}finally{fs.closeSync(fd)}
 assert.equal(bytes,s.size);return{path:path.resolve(f),bytes,sha256:digest.digest('hex')};}
function pin(r){assert.deepEqual(fact(r.path),{path:path.resolve(r.path),bytes:r.bytes,sha256:r.sha256});return r;}
function write(f,v){fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return fact(f);}
function inside(root,f){const r=path.relative(root,f);return !!r&&!path.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+path.sep);}
function verifyClose(c){for(const[k,v]of Object.entries({actualClose:true,exitCode:0,signal:null,stdoutEOF:true,stderrEOF:true,overflow:false,streamError:false,deadlineExceeded:false,signalsRequested:0}))assert.equal(c[k],v,k);return c;}
function expectedIds(){return Array.from({length:20},(_,i)=>'F20A-N'+String(i+1).padStart(2,'0')).sort();}
function verifyResult(result,frontendHash){
 assert.equal(result.status,'PASS_SCOPED_PRODUCT_CLI_MATRIX');assert.equal(result.runtimeSha256,frontendHash);
 assert.deepEqual(result.checks.map(r=>r.id).sort(),expectedIds());assert(result.checks.every(r=>r.status==='PASS'));
 assert.equal(result.mediatedContextControl.status,'BLOCKED_SCOPED');assert.equal(result.unmediatedContextControl.status,'LEAK_CONFIRMED');assert.equal(result.unmediatedContextControl.covered,false);
 for(const key of ['driverFailure','childShutdown','nativeRetained','providerFailure','unexpectedPrivateLeak'])assert(!result[key],key);
 assert(Array.isArray(result.native)&&result.native.length>0);for(const n of result.native){assert(n.closed&&n.stdoutEOF&&n.stderrEOF);assert.equal(n.signal,null);assert(!n.privateOutputSeen&&!n.outputOverflow&&!n.retainedWithoutSignal);}
 assert(Array.isArray(result.children)&&result.children.length>0);for(const c of result.children)assert(c.closed&&c.stdoutEOF&&c.stderrEOF);
 assert.equal(result.deniedSignals.length,0);assert.equal(result.deniedExternal.length,0);
 return{originalAssertions:20,selectedNativeClientCount:result.native.length,guardedDeclaredChildCount:result.children.length,outerAndDirectClients:'ACTUAL_CLOSE_AND_BOTH_EOF',unobservedNestedVendorClosure:'NOT_INFERRED',baselineOverride:'LEAK_CONFIRMED_UNCOVERED'};
}
async function verifyCurrent(){
 const qualification=fact(path.join(F,'current-package-qualification-01.json'));assert.equal(qualification.sha256,'e0b7677479089dfdfe7a2d64baa0ce7f66e4a9600c1094fcde96152101829f24');
 const q=read(qualification.path),source=fact(path.join(F,'full-inputs-04.json'));assert.equal(source.sha256,'21a9721cade24be9cb76a03350273dbc79f1f8e0e913bc92d7a1c5385db8b764');
 assert.equal(q.sourceProofSha256,source.sha256);const proof=read(source.path);assert.equal(proof.files.length,1110);assert.equal(proof.scopedSource.length,29);
 for(const r of proof.files)pin({...r,path:path.join(repo,r.path)});
 pin(q.vsix);assert.equal(q.vsix.sha256,'e2ce3dc44d45b5e160ab0f95d713a9434a9ea7d610ce7abd2bf2500abe89d649');assert.equal(q.vsix.bytes,1742100);
 const full=fact(path.join(F,'full-suite-acceptance-04.json'));assert.equal(full.sha256,q.fullAcceptanceSha256);const count=read(full.path).counts;
 assert.deepEqual(count,{tests:4891,pass:4887,fail:0,cancelled:0,skipped:4,todo:0});
 const vendorFact=fact(path.join(F,'public-vendor-observation-02.json'));assert.equal(vendorFact.sha256,q.currentVendorReceiptSha256);const vendor=read(vendorFact.path);
 assert.equal(vendor.currentHost.version,'1.144.1');assert.equal(vendor.currentHost.commit,'261c84cb1eddf11235f9e2c921425e9663fbe556');
 for(const row of vendor.vendorFacts){if(row.path.toLowerCase()==='c:\\windows\\system32\\windowspowershell\\v1.0\\powershell.exe'){
 const actual=factWithPublicLink(row);assert.equal(actual.sha256,row.sha256);assert.equal(actual.bytes,row.bytes);
 }else pin(row);}
 const {auditFinalRelease}=require(path.join(repo,'packages/soterai-lite/scripts/audit-release.cjs'));
 const build=path.join(repo,'packages/soterai-lite/builds/2026-11-03T14-37-01-797Z-c6ef06c0');
 pin(q.inspection);
 const audit=await auditFinalRelease({repoRoot:repo,vsixPath:q.vsix.path,expectedSha256:q.vsix.sha256,buildReceiptPath:path.join(build,'build-provenance.json'),packageReceiptPath:path.join(build,'package-receipt.json')});
 assert.equal(audit.report.entries.length,18);assert.equal(audit.report.runtimes.length,4);assert.deepEqual(audit.report.entries,read(q.inspection.path).entries);
 const inspectorFact=fact(path.join(F,'run-installed-lifecycle-proposed-04.cjs'));assert.equal(inspectorFact.sha256,'e856d33533a35258792f73f30384ff0e466d9cf05271fbf897579b099909c743');
 const payload=require(inspectorFact.path).inspectVsix(q.vsix,'0.7.0',4);assert.deepEqual(payload.runtimes,[...q.payload.runtimes].sort((a,b)=>a.relative.localeCompare(b.relative)));
 const oldVendor=read(path.join(historical,'installed-cli-public-inputs-01.json'));for(const row of oldVendor.files)pin(row);
 return{qualification,source,full,vendorFact,vendor,q,payload,originalVendorPin:fact(path.join(historical,'installed-cli-public-inputs-01.json')),oldVendor};
}
function factWithPublicLink(row){const s=fs.lstatSync(row.path);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===row.fileLinkCount&&s.nlink<=16);
 const raw=fs.readFileSync(row.path);return{path:path.resolve(row.path),bytes:raw.length,sha256:sha(raw)};}
function validateAdmissionShape(a){
 assert.equal(a.feature,'V01_CODEXCLI');assert.equal(a.status,'ROOT_REVIEWED_EXACT_CURRENT_CODEXCLI_ROUTE');assert.equal(a.syntheticOnly,true);assert.equal(a.signalsRequested,0);assert.equal(a.maxAttempts,1);
 assert(/^D:\\SoterAI-Lite-test-profiles\\f20a-product-[0-9TZ]+-[a-f0-9]{8}$/.test(a.runRoot));assert.equal(path.dirname(a.runRoot),'D:\\SoterAI-Lite-test-profiles');
 assert(inside(__dirname,a.receipts));assert.equal(path.dirname(a.receipts),__dirname);assert(/^codexcli-run-[0-9TZ]+-[a-f0-9]{8}$/.test(path.basename(a.receipts)));
 assert.equal(a.uniqueAssertions,20);assert.equal(a.selectedRoute,'F20A_CODEXCLI_0_160_1');
 for(const r of Object.values(a.fixtures)){assert(inside(__dirname,r.path));pin(r);}
 assert.equal(a.fixtures.runner.path,__filename);assert.equal(a.fixtures.wrapper.path,own('run-codexcli-current-01.ps1'));
 return a;
}
async function admit(admissionFile,expectedSha,{fresh=true}={}){
 assert.equal(path.dirname(path.resolve(admissionFile)),__dirname);assert.equal(path.basename(admissionFile),'codexcli-admission-01.json');assert.equal(fact(admissionFile).sha256,expectedSha);
 const a=validateAdmissionShape(read(admissionFile)),current=await verifyCurrent();
 for(const key of ['qualification','source','full','vendorFact','originalVendorPin'])assert.deepEqual(a[key],current[key]);
 assert.equal(a.currentVsixSha256,current.q.vsix.sha256);assert.equal(a.originalDriver.sha256,fact(path.join(historical,'responses-matrix-01.cjs')).sha256);
 assert.equal(a.originalGuard.sha256,fact(path.join(historical,'matrix-guards-01.cjs')).sha256);pin(a.originalDriver);pin(a.originalGuard);
 assert.equal(a.fixtures.driver.sha256,a.originalDriver.sha256);assert.equal(a.fixtures.guard.sha256,a.originalGuard.sha256);
 pin(a.inspection);const i=read(a.inspection.path);assert.equal(i.status,'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED');assert.equal(i.sha256,current.q.vsix.sha256);assert.equal(i.entries.length,18);
 for(const entry of i.entries.filter(r=>r.path.startsWith('extension/'))){const rel=entry.path.slice(10);pin({path:path.join(i.extractedExtensionRoot,rel),bytes:entry.bytes,sha256:entry.sha256});}
 const graph=read(a.publicGraph.path);pin(a.publicGraph);assert.equal(graph.originalVendorPinSha256,current.originalVendorPin.sha256);
 for(const row of graph.files)pin(row);
 if(fresh){assert(!fs.existsSync(a.runRoot));assert(!fs.existsSync(a.receipts));}
 return{a,current};
}
async function makeAdmission({runRoot,receipts}){
 const c=await verifyCurrent();return{feature:'V01_CODEXCLI',status:'ROOT_REVIEWED_EXACT_CURRENT_CODEXCLI_ROUTE',syntheticOnly:true,signalsRequested:0,maxAttempts:1,uniqueAssertions:20,selectedRoute:'F20A_CODEXCLI_0_160_1',runRoot,receipts,
 ...Object.fromEntries(['qualification','source','full','vendorFact','originalVendorPin'].map(k=>[k,c[k]])),currentVsixSha256:c.q.vsix.sha256,
 originalDriver:fact(path.join(historical,'responses-matrix-01.cjs')),originalGuard:fact(path.join(historical,'matrix-guards-01.cjs')),
 inspection:fact(own('current-inspection-01.json')),publicGraph:fact(own('codexcli-public-graph-01.json')),
 fixtures:Object.fromEntries(['codexcli-route-current-01.cjs','run-codexcli-current-01.ps1','run-owned-code-current-01.cjs','codexcli/responses-matrix-01.cjs','codexcli/matrix-guards-01.cjs','codexcli/installed-cli-public-inputs-01.json'].map((n,i)=>[['runner','wrapper','codeOwner','driver','guard','vendorPin'][i],fact(own(n))]))};
}
async function run(admissionFile,expectedSha){
 const {a,current}=await admit(admissionFile,expectedSha);const consumed=own('codexcli-one-attempt-consumed-01.json');assert(!fs.existsSync(consumed));
 write(consumed,{feature:'V01_CODEXCLI',status:'CONSUMED_ONE_ROOT_REVIEWED_CURRENT_ROUTE_NO_RETRY',admission:fact(admissionFile),runRoot:a.runRoot,observedAt:new Date().toISOString(),signalsRequested:0});
 fs.mkdirSync(a.receipts);const helper=path.join(F,'../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');assert.equal(fact(helper).sha256,'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
 const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',COMSPEC:'C:\\Windows\\System32\\cmd.exe',PATH:'C:\\Windows\\System32;C:\\Program Files\\nodejs',USERPROFILE:path.join(a.runRoot,'profile'),HOME:path.join(a.runRoot,'profile'),TEMP:path.join(a.runRoot,'profile','Temp'),TMP:path.join(a.runRoot,'profile','Temp')};
 const owned=await require(helper).phase({executable:current.vendor.systemPowerShell.path,args:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',a.fixtures.wrapper.path,'-AdmissionPath',admissionFile,'-AdmissionSha256',expectedSha],cwd:repo,env,run:a.receipts,name:'codexcli-wrapper',profile:path.join(a.runRoot,'profile'),deadlineMs:420000});
 verifyClose(owned.close);const result=read(path.join(a.runRoot,'product-result.json'));const report=verifyResult(result,current.q.payload.runtimes.find(r=>r.relative==='dist/extension.js').sha256);
 const code=read(path.join(a.receipts,'codexcli-code-owned-close.json'));verifyClose(code);await verifyCurrent();
 write(path.join(a.receipts,'codexcli-result-acceptance-01.json'),{feature:'V01_CODEXCLI',status:'PASS_EXACT_CURRENT_SCOPED_ORIGINAL20',...report,currentVsix:current.q.vsix,source:current.source,qualification:current.qualification,codeClose:fact(path.join(a.receipts,'codexcli-code-owned-close.json')),wrapperClose:fact(path.join(a.receipts,'codexcli-wrapper-owned-close.json')),result:fact(path.join(a.runRoot,'product-result.json')),independence:'LOW_SCRIPTED_NATIVE_APIS_DEVELOPER_BOOTSTRAP',releaseReady:false,signalsRequested:0});
}
if(require.main===module){const action=process.argv[2];if(action==='--run'&&process.argv.length===5)run(process.argv[3],process.argv[4]).catch(e=>{console.error(JSON.stringify({status:'INCOMPLETE_NO_RETRY',errorName:e.name,signalsRequested:0}));process.exitCode=1});
 else if(['--validate','--validate-prepared'].includes(action)&&process.argv.length===5)admit(process.argv[3],process.argv[4],{fresh:action==='--validate'}).then(()=>console.log('PASS_READ_ONLY_ADMISSION_NATIVE_NOT_RUN')).catch(e=>{console.error(e);process.exitCode=1});else{console.error('INERT: --validate or root-authorized --run plus exact admission path/hash required');process.exitCode=1;}}
module.exports={fact,pin,verifyClose,verifyResult,verifyCurrent,validateAdmissionShape,admit,makeAdmission};
