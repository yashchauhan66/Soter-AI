'use strict';
// Host-only preparation. No native launch or product/source mutation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const BASE=path.resolve(__dirname,'../../20261103-f32-lifecycle-2e95d6a4');
const own=name=>path.join(BASE,name);
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const source=file=>fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
const fact=file=>{const raw=fs.readFileSync(file);return{path:path.resolve(file),bytes:raw.length,sha256:sha(raw)};};
function pin(row){assert(row&&path.isAbsolute(row.path));assert.deepEqual(fact(row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256});return row;}
const pinned=row=>{pin(row);return read(row.path);};
function one(text,before,after){assert(text.includes(before)&&text.indexOf(before)===text.lastIndexOf(before),'Expected one host-only anchor: '+before.slice(0,100));return text.replace(before,after);}
const VERSION='1.145.2',COMMIT='c4453f8ea430795f941c1b2ff6c9321135a74a02';
const APP='C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\c4453f8ea4\\resources\\app';
const CODE='C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
const previous=`
function verifyUnconsumedExtra09(a) {
  const previous=a.supersededExtra09;assert(previous);
  assert.equal(previous.admission.path,path.join(__dirname,'installed-extra09-admission.json'));
  const old=pinnedJson(previous.admission);pin(previous.staticVerification);
  assert.equal(old.status,'ROOT_REVIEWED_F32_INSTALLED_EXTRA09_FINAL_INPUTS');
  assert(!fs.existsSync(path.join(__dirname,'installed-extra09-consumed.json')),'Superseded09 must remain unconsumed');
  assert(!fs.existsSync(old.runRoot),'Superseded09 never launched its reserved root');
  assert.notEqual(old.runRoot.toLowerCase(),a.runRoot.toLowerCase());
  for(const key of ['sourceProof','fullAcceptance','currentVsix','oldVsix','notificationAwaitRegression'])assert.deepEqual(old[key],a[key]);
  for(const row of Object.values(old.fixtures))pin(row);
  assert.notEqual(old.vendorReceipt.sha256,a.vendorReceipt.sha256);
  const verification=pinnedJson(previous.staticVerification);
  assert.equal(verification.status,'PASS_EXACT_EXTRA09_STATIC_VERIFICATION_NATIVE_NOT_RUN');
  assert.deepEqual(verification.admission,previous.admission);assert.equal(verification.nativeLaunches,0);
}
`;
function buildSources(host){
  assert.equal(host.version,VERSION);assert.equal(host.commit,COMMIT);assert.equal(host.appRoot,APP);
  assert.equal(host.executable.path,CODE);assert(/^[a-f0-9]{64}$/.test(host.executable.sha256));
  assert(Number.isSafeInteger(host.executable.bytes)&&host.executable.bytes>100000000&&host.executable.bytes<536870912);
  const original=source(own('run-installed-lifecycle-proposed-09.cjs'));
  let runner=original;
  for(const[a,b]of [['extra09','extra10'],['EXTRA09','EXTRA10'],['PROPOSAL10','PROPOSAL11'],['run-installed-lifecycle-proposed-09.cjs','run-installed-lifecycle-proposed-10.cjs'],['native-owned-gui-phase-proposed-09.cjs','native-owned-gui-phase-proposed-10.cjs'],['installed-owner-custody-proposed-07.ps1','installed-owner-custody-proposed-08.ps1']])runner=runner.replaceAll(a,b);
  runner=one(runner,"assert.equal(vendor.currentHost.version, '1.145.1');",`assert.equal(vendor.currentHost.version, '${VERSION}');`);
  runner=one(runner,"assert.equal(vendor.currentHost.commit, '6bab64e2d12b04d04c0d99c27ff166023efd1dda');",`assert.equal(vendor.currentHost.commit, '${COMMIT}');`);
  runner=one(runner,"assert.equal(vendor.currentHost.appRoot, 'C:\\\\Users\\\\USER\\\\AppData\\\\Local\\\\Programs\\\\Microsoft VS Code\\\\6bab64e2d1\\\\resources\\\\app');",`assert.equal(vendor.currentHost.appRoot, ${JSON.stringify(APP)});`);
  runner=one(runner,'function reviewedAdmission(admissionFile, expectedSha) {',previous+'\nfunction reviewedAdmission(admissionFile, expectedSha) {');
  assert.equal(runner.split('verifyPreviousExtra08(a);').length-1,2);
  runner=runner.replaceAll('verifyPreviousExtra08(a);','verifyPreviousExtra08(a); verifyUnconsumedExtra09(a);');
  runner=one(runner,'module.exports = { verifyPreviousExtra08,','module.exports = { verifyUnconsumedExtra09, verifyPreviousExtra08,');
  const nativePart=text=>text.slice(text.indexOf('  async function native('),text.indexOf('  try {\n    // Each new profile'));
  assert.equal(nativePart(runner),nativePart(original),'Host successor cannot change native lifecycle/early custody semantics');
  const phasePart=text=>text.slice(text.indexOf('    const primary = binding'),text.indexOf('    stable();\n    // No new human/admin gate.'));
  assert.equal(phasePart(runner),phasePart(original),'Host successor cannot change8/44/59 matrix');
  let gui=source(own('native-owned-gui-phase-proposed-09.cjs')).replaceAll('EXTRA09','EXTRA10').replaceAll('PROPOSAL10','PROPOSAL11');
  gui=one(gui,"const CODE_SHA='2361449e044667cd5030a1396db3ac6785424ff7bf3047c691bc79e9011ae91d';",`const CODE_SHA='${host.executable.sha256}';`);
  assert.equal(gui.split('238751552').length-1,3);gui=gui.replaceAll('238751552',String(host.executable.bytes));
  const originalCustody=source(own('installed-owner-custody-proposed-07.ps1'));
  assert.equal(originalCustody.split("'1.145.1'").length-1,3);
  const custody=originalCustody.replaceAll("'1.145.1'",`'${VERSION}'`);
  const result={'run-installed-lifecycle-proposed-10.cjs':runner,'native-owned-gui-phase-proposed-10.cjs':gui,'installed-owner-custody-proposed-08.ps1':custody};
  for(const[name,text]of Object.entries(result))if(name.endsWith('.cjs'))new vm.Script(text,{filename:name});
  return result;
}
function verifyClose(row){
  const close=pinned(row);
  for(const[key,value]of Object.entries({actualClose:true,exitCode:0,signal:null,stdoutEOF:true,stderrEOF:true,overflow:false,streamError:false,deadlineExceeded:false,signalsRequested:0}))assert.equal(close[key],value);
  for(const stream of close.streams){assert.equal(stream.bytes,stream.observedBytes);pin({path:row.path.replace(/owned-close\.json$/,stream.name+'.bin'),bytes:stream.bytes,sha256:stream.sha256});}
  return close;
}

function prepare(config){
  const oldFact=fact(own('installed-extra09-admission.json')),old=read(oldFact.path);
  assert.equal(oldFact.sha256,'863d776a117967d76754a4d2823e3903511d6053f8f1e460bd956e2dd28de5a1');
  assert(!fs.existsSync(old.runRoot)&&!fs.existsSync(own('installed-extra09-consumed.json')),'09 remains unconsumed');
  for(const row of [old.sourceProof,old.fullAcceptance,old.currentVsix,old.oldVsix,...Object.values(old.fixtures)])pin(row);
  const previousRunner=require(old.fixtures.runner.path);previousRunner.verifySource(pinned(old.sourceProof),old.sourceParent);
  const vendor=pinned(config.vendorReceipt),review=pinned(config.vendorReview),contract=pinned(config.installerContract);
  assert.equal(vendor.feature,'F32');assert.equal(vendor.twoStableObservations,true);
  const generated=new Map(Object.entries(buildSources(vendor.currentHost)).map(([name,text])=>[name,Buffer.from(text)]));
  assert.equal(review.status,'CURRENT_VENDOR_SIGNATURE_CLI_METADATA_AND_ATTACH_TRANSPORT_REVIEWED');assert.equal(review.vendorReceiptSha256,config.vendorReceipt.sha256);
  for(const key of ['currentCodeSigner','localCliNoDownload','exactInstallerMetadataSerialization','playwrightAttachDisconnectOnly','completePlaywrightGraph'])assert.equal(review.checks[key],'PASS_STATIC_REVIEW');
  assert.equal(contract.status,'PASS_CURRENT_VENDOR_INSTALLED_SIZE_INCLUDES_EXACT_VSIXMANIFEST');assert.equal(contract.vendorReceiptSha256,config.vendorReceipt.sha256);
  assert.equal(contract.oldVsixSha256,old.oldVsix.sha256);
  for(const name of ['current','old'])for(const key of ['installClose','listClose'])verifyClose(contract[name][key]);
  for(const row of vendor.vendorFacts)pin(row);
  const future=name=>{const raw=generated.get(name);assert(raw);return{path:own(name),bytes:raw.length,sha256:sha(raw)};};
  const add=(name,value)=>{assert(!generated.has(name));generated.set(name,Buffer.from(JSON.stringify(value,null,2)+'\n'));return future(name);};
  const a=structuredClone(old);a.status='ROOT_REVIEWED_F32_INSTALLED_EXTRA10_FINAL_INPUTS';a.extraAttempt='PROPOSAL11';
  a.vendorReceipt=config.vendorReceipt;a.vendorReview=config.vendorReview;a.playwrightEntry=vendor.playwright.entry;
  a.runRoot=config.runRoot??('D:\\SoterAI-Lite-test-profiles\\f32-installed-'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')+'-'+crypto.randomBytes(4).toString('hex'));
  assert(/^D:\\SoterAI-Lite-test-profiles\\f32-installed-[0-9TZ]+-[a-f0-9]{8}$/.test(a.runRoot)&&!fs.existsSync(a.runRoot));
  a.debugPorts=[54931,54932,54933,54934,54935,54936,54937,54938];a.configuredBrokerPort=54939;
  for(const[key,name]of Object.entries({runner:'run-installed-lifecycle-proposed-10.cjs',guiHelper:'native-owned-gui-phase-proposed-10.cjs',custody:'installed-owner-custody-proposed-08.ps1'}))a.fixtures[key]=future(name);
  a.supersededExtra09={admission:oldFact,staticVerification:fact(path.join(__dirname,'early-attach-verification-01.json'))};
  const qualification=pinned(old.finalQualification);
  a.finalQualification=add('current-candidate-host1452-qualification-01.json',{...qualification,observedAt:new Date().toISOString(),currentVendorReceiptSha256:config.vendorReceipt.sha256,hostUpdate:{scope:'HOST_ONLY_SOURCE_TESTS_VSIX_UNCHANGED',previousQualification:old.finalQualification,previousVendorReceipt:old.vendorReceipt,currentVendorReceipt:config.vendorReceipt,currentVendorReview:config.vendorReview,nativeResultsTransferred:false}});
  const expected=pinned(old.installerSizeQualification);
  a.installerSizeQualification=add('candidate-installer-size-contract-02.json',{...expected,retainedVendorContract:config.installerContract,vendorReceiptSha256:config.vendorReceipt.sha256,nativeCandidateInstallAlreadyObserved:false,scope:'Expected sizes derived from freshly observed1.145.2 native CLI metadata contract. Actual lifecycle installations are separately verified; no previous lifecycle success is transferred.'});
  const proposal='CURRENT-CANDIDATE-VERIFICATION-PROPOSAL11.md';
  generated.set(proposal,Buffer.from('# F32 Code1.145.2 host-only successor\n\nExtra09 remains immutable and unconsumed. This successor binds freshly observed Code1.145.2 signer/CLI/install-size/vendor facts while retaining exactly the same source proof, full tests, VSIX, real trust keyboard assertions, early-root attach followed by full custody, observer ACKs, natural EOFs, and8/44/59 matrix. No earlier native lifecycle success is transferred. Standing explicit user approval covers local isolated checks. Preparation itself launches nothing.\n'));
  a.extraApproval=add('installed-extra10-user-approval.json',{feature:'F32',status:'USER_APPROVED_REMAINING_WORK_AND_ISOLATED_LOCAL_TESTS',extraAttempt:'PROPOSAL11',approved:true,maxAttempts:1,syntheticOnly:true,signalsRequested:0,runRoot:a.runRoot,userAnswer:'continue complete remaninig work very fast | Haan, local tests aur isolated VS Code checks approve hain',authorityScope:'Standing local test approval and user-approved Code1.145.2 update, relayed by root.',proposal:future(proposal),runner:a.fixtures.runner,sourceProof:a.sourceProof,currentVsix:a.currentVsix});
  const admission=add('installed-extra10-admission.json',a);
  for(const name of generated.keys())assert(!fs.existsSync(own(name)),'Never overwrite frozen evidence '+name);
  for(const[name,raw]of generated)fs.writeFileSync(own(name),raw,{flag:'wx'});
  const runner=require(a.fixtures.runner.path);runner.reviewedAdmission(admission.path,admission.sha256);runner.verifyExtraApproval(a);
  const result={status:'PASS_HOST1452_EXTRA10_STATIC_ADMISSION_NATIVE_NOT_RUN',admission,runRoot:a.runRoot,currentVsix:a.currentVsix,vendorReceipt:a.vendorReceipt,generated:[...generated.keys()].map(name=>fact(own(name))),nativeLaunches:0,signalsRequested:0};
  fs.writeFileSync(path.join(__dirname,'host1452-preparation-01.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
if(require.main===module){
  assert(process.argv.length===2||process.argv.length===3,'Optional config with vendorReceipt/vendorReview/installerContract facts');
  const config=process.argv[2]?read(path.resolve(process.argv[2])):{vendorReceipt:fact(own('public-vendor-observation-05.json')),vendorReview:fact(own('current-vendor-review-04.json')),installerContract:fact(own('vendor-installed-size-qualification-05.json'))};
  console.log(JSON.stringify(prepare(config),null,2));
}
module.exports={buildSources,prepare,verifyClose,fact,pin,VERSION,COMMIT,APP,CODE};
