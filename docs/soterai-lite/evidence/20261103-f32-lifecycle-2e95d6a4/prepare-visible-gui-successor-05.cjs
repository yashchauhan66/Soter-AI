'use strict';
// Authoring only: creates inert successor fixture sources, never imports a
// runner, opens a listener, creates a profile or launches a native process.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const file=n=>path.join(__dirname,n), sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>fs.readFileSync(file(n),'utf8');
const write=(n,s)=>fs.writeFileSync(file(n),s,{flag:'wx'});
function change(s,before,after,count=1){assert.equal(s.split(before).length-1,count,before);return s.split(before).join(after)}
let owned=fs.readFileSync(path.join(__dirname,'../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs'),'utf8');
assert.equal(sha(Buffer.from(owned)),'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
const guiValidation=String.raw`
// Inert GUI-only contract. All original stream/close/deadline logic follows.
const launchContract=require('./installed-launch-contract-proposed-03.cjs');
const CODE_PATH='C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
const CODE_SHA='af032b86db394d21ba86872f4237a11b8395d2f57e8187963a3718a2cc6666ad';
function validateGuiContract(options){
 const {executable,args,cwd,env,run,name,profile,deadlineMs=240000,guiAuthority:a}=options;
 assert(a&&a.status==='EXPLICIT_EXTRA05_VISIBLE_OWNED_GUI_ONLY'&&a.feature==='F32');
 const b=a.binding;launchContract.validate(b);
 assert.equal(b.normalRound,3);assert.equal(a.extraAttempt,'PROPOSAL05');
 assert.equal(executable,CODE_PATH);assert.equal(a.executable.path,CODE_PATH);
 assert.equal(a.executable.sha256,CODE_SHA);assert.equal(a.executable.bytes,238751552);
 assert.equal(profile,b.profile);assert.equal(cwd,b.workspace);assert.equal(run,b.gate);
 assert.equal(name,b.phase+'-code');assert.equal(deadlineMs,600000);
 assert.equal(path.dirname(b.gate),path.join(b.profile,'F32Gate'));
 assert.equal(path.basename(b.gate),b.phase);assert.equal(path.dirname(b.profile),b.runRoot);
 assert(['profile-primary','profile-restricted','profile-upgrade'].includes(path.basename(b.profile)));
 assert.equal(path.dirname(b.workspace),b.runRoot);
 assert(['workspace-primary','workspace-upgrade'].includes(path.basename(b.workspace)));
 assert.equal(path.dirname(b.observerRoot),b.runRoot);
 assert(['observer-current','observer-old'].includes(path.basename(b.observerRoot)));
 assert.equal(b.rootMarker.path,path.join(b.runRoot,'.f32-owned-installed-root.json'));
 assert(/^[a-f0-9]{64}$/.test(b.rootMarker.sha256)&&Number.isSafeInteger(b.rootMarker.bytes)&&b.rootMarker.bytes>0);
 const endpoint=new URL(b.endpoint);assert.equal(endpoint.hostname,'127.0.0.1');assert.equal(endpoint.protocol,'http:');
 assert.equal(endpoint.pathname,'/');assert(!endpoint.search&&!endpoint.hash&&!endpoint.username&&!endpoint.password);
 assert.deepEqual(args,launchContract.windowArgs(b,b.phase,Number(endpoint.port)));
 assert.deepEqual(env,launchContract.environment(b,b.bindingFile,false));
 return {windowsHide:false,guiVisibility:'EXPLICIT_VISIBLE_OWNED_SYNTHETIC_CODE',codeSha256:CODE_SHA};
}
function verifyGuiFiles(options){
 const observed=validateGuiContract(options),b=options.guiAuthority.binding;
 for(const f of [b.runRoot,b.profile,b.workspace,b.gate,b.observerRoot]){
  for(let cursor=f;;cursor=path.dirname(cursor)){
   const s=fs.lstatSync(cursor);assert(!s.isSymbolicLink());if(path.dirname(cursor)===cursor)break;
  }
  assert(fs.lstatSync(f).isDirectory());
 }
 const markerStat=fs.lstatSync(b.rootMarker.path);assert(markerStat.isFile()&&!markerStat.isSymbolicLink()&&markerStat.nlink===1);
 const markerRaw=fs.readFileSync(b.rootMarker.path);assert.equal(markerRaw.length,b.rootMarker.bytes);assert.equal(sha(markerRaw),b.rootMarker.sha256);
 const marker=JSON.parse(markerRaw.toString('utf8'));assert.equal(marker.feature,'F32');assert.equal(marker.syntheticOnly,true);assert.equal(marker.signalsRequested,0);
 const before=fs.lstatSync(options.executable);assert(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size===238751552);
 const fd=fs.openSync(options.executable,'r'),chunk=Buffer.alloc(65536),digest=crypto.createHash('sha256');let bytes=0;
 try{while(true){const n=fs.readSync(fd,chunk,0,chunk.length,null);if(!n)break;bytes+=n;assert(bytes<=before.size);digest.update(chunk.subarray(0,n));}
 const after=fs.fstatSync(fd);assert.equal(after.ino,before.ino);assert.equal(after.size,before.size);assert.equal(after.mtimeMs,before.mtimeMs);}finally{fs.closeSync(fd)}
 assert.equal(bytes,238751552);assert.equal(digest.digest('hex'),CODE_SHA);
 return observed;
}
`;
owned=change(owned,"async function phase({executable,args,cwd,env,run,name,profile,deadlineMs=240000}){",guiValidation+"\nasync function phase(options){\n const {executable,args,cwd,env,run,name,profile,deadlineMs=240000}=options;\n const guiObservation=verifyGuiFiles(options);");
owned=change(owned,'windowsHide:true','windowsHide:false');
owned=change(owned,"status:'STARTED_NOT_COMPLETED',observedAt:","status:'STARTED_NOT_COMPLETED',...guiObservation,observedAt:");
owned=change(owned,'const close={observedAt:','const close={...guiObservation,observedAt:');
owned=change(owned,'module.exports={phase};','module.exports={phase,validateGuiContract};');
write('native-owned-gui-phase-proposed-05.cjs',owned);
for(const [input,output] of [['installed-observer-proposed-04.cjs','installed-observer-proposed-05.cjs'],['installed-upgrade-old-observer-proposed-03.cjs','installed-upgrade-old-observer-proposed-04.cjs']]){
 let s=read(input);
 s=change(s,"const vscode = require('vscode');","const vscode = require('vscode');\nconst { collectTrustSnapshot } = require('./installed-trust-diagnostics-proposed-05.cjs');");
 s=change(s,"  observedStage = 'NATIVE_TRUST_HANDSHAKE';","  observedStage = 'NATIVE_TRUST_HANDSHAKE';\n  write(path.join(b.gate,b.phase+'-trust-before.json'),collectTrustSnapshot(vscode));");
 s=change(s,"errorName: error instanceof Error ? error.name : 'UnknownFailure', ...safeDiagnostic(error),","errorName: error instanceof Error ? error.name : 'UnknownFailure', ...safeDiagnostic(error),\n        trust: collectTrustSnapshot(vscode),");
 s=change(s,"  await until(()=>vscode.workspace.isTrusted===expected,90000,'Native workspace trust state has not settled');","  await until(()=>vscode.workspace.isTrusted===expected,90000,'Native workspace trust state has not settled');\n  write(path.join(b.gate,b.phase+'-trust-after.json'),collectTrustSnapshot(vscode));");
 write(output,s);
}
let renderer=read('installed-renderer-proposed-03.cjs');
renderer=change(renderer,'async function run() {',String.raw`let observedStage='PRELUDE',safeTrustMetadata;
function safeRendererDiagnostic(error){
 const result={stage:observedStage};
 const stack=error instanceof Error&&typeof error.stack==='string'?error.stack.slice(0,8192):'';
 const match=stack.match(/(?:renderer\.cjs|installed-renderer-proposed-0[1-9]\.cjs):([0-9]{1,6}):([0-9]{1,5})/);
 if(match){result.sourceLine=Number(match[1]);result.sourceColumn=Number(match[2]);}
 if(safeTrustMetadata)result.trust=safeTrustMetadata;
 return result;
}
async function run() {`);
renderer=change(renderer,"    if (b.trustChoice) {","    observedStage='NATIVE_TRUST_UI';\n    safeTrustMetadata=await page.evaluate(()=>({documentFocused:document.hasFocus(),visibleNativeDialogCount:[...document.querySelectorAll('.monaco-dialog-box')].filter(e=>e.getClientRects().length>0).length,trustWordsPresent:[...document.querySelectorAll('.monaco-dialog-box')].filter(e=>e.getClientRects().length>0).some(e=>/trust the authors/i.test(e.textContent||''))}));\n    write(path.join(b.gate,b.phase+'-renderer-trust-before.json'),safeTrustMetadata);\n    if (b.trustChoice) {");
renderer=change(renderer,"      assert((await dialog.innerText()).includes(path.basename(b.workspace)));","      safeTrustMetadata=await page.evaluate(()=>({documentFocused:document.hasFocus(),visibleNativeDialogCount:[...document.querySelectorAll('.monaco-dialog-box')].filter(e=>e.getClientRects().length>0).length,trustWordsPresent:[...document.querySelectorAll('.monaco-dialog-box')].filter(e=>e.getClientRects().length>0).some(e=>/trust the authors/i.test(e.textContent||''))}));\n      assert((await dialog.innerText()).includes(path.basename(b.workspace)));");
renderer=change(renderer,'    let next = 1;',"    observedStage='NATIVE_PRODUCT_UI';\n    let next = 1;");
renderer=change(renderer,"errorName: error instanceof Error ? error.name : 'UnknownFailure', signalsRequested: 0 })","errorName: error instanceof Error ? error.name : 'UnknownFailure', ...safeRendererDiagnostic(error), signalsRequested: 0 })");
renderer=change(renderer,'module.exports = { run };','module.exports = { run, safeRendererDiagnostic };');
write('installed-renderer-proposed-04.cjs',renderer);
let runner=read('run-installed-lifecycle-proposed-04.cjs');
runner=change(runner,"'installed-admission-03.json'","'installed-extra05-admission.json'");
runner=change(runner,"assert.equal(a.status, 'ROOT_REVIEWED_F32_INSTALLED_ROUND03_FINAL_INPUTS');","assert.equal(a.status, 'ROOT_REVIEWED_F32_INSTALLED_EXTRA05_FINAL_INPUTS');\n  assert.equal(a.extraAttempt,'PROPOSAL05');");
runner=change(runner,"observer: 'installed-observer-proposed-04.cjs'","observer: 'installed-observer-proposed-05.cjs'");
runner=change(runner,"oldObserver: 'installed-upgrade-old-observer-proposed-03.cjs'","oldObserver: 'installed-upgrade-old-observer-proposed-04.cjs'");
runner=change(runner,"renderer: 'installed-renderer-proposed-03.cjs'","renderer: 'installed-renderer-proposed-04.cjs'");
runner=change(runner,"brokerObservation: 'installed-broker-observation-proposed-03.cjs', brokerCustody: 'installed-broker-custody-proposed-02.ps1'","brokerObservation: 'installed-broker-observation-proposed-03.cjs', brokerCustody: 'installed-broker-custody-proposed-02.ps1',\n    guiHelper:'native-owned-gui-phase-proposed-05.cjs',trustDiagnostics:'installed-trust-diagnostics-proposed-05.cjs'");
runner=change(runner,"  verifyPreviousRound(a); verifyPreviousRound02(a);","  verifyPreviousRound(a); verifyPreviousRound02(a); verifyPreviousRound03(a);",2);
runner=change(runner,"const launch = require(a.fixtures.launch.path), { phase } = require(admitted.helper);","const launch = require(a.fixtures.launch.path), { phase } = require(admitted.helper);\n  const { phase: guiPhase } = require(a.fixtures.guiHelper.path);\n  verifyExtraApproval(a);\n  const consumed05=path.join(__dirname,'installed-extra05-consumed.json');\n  assert(!fs.existsSync(consumed05),'ONE extra attempt cannot retry');");
runner=change(runner,"const consumeFile = path.join(__dirname, 'installed-normal-round-03-consumed.json');","const consumeFile = consumed05;");
runner=change(runner,"  for (const number of ['03']) assert(!fs.existsSync(path.join(__dirname, 'installed-normal-round-' + number + '-consumed.json')), 'A recorded current/future round forbids implicit retry');","  assert(!fs.existsSync(consumeFile),'Recorded extra05 consumption forbids retry');");
runner=change(runner,"status: 'CONSUMED_ONE_NORMAL_ROUND_NO_RETRY',","status: 'CONSUMED_ONE_EXPLICIT_EXTRA05_NO_RETRY', extraAttempt:'PROPOSAL05', extraApproval:a.extraApproval,");
runner=change(runner,"    if (directory === paths.observer) copy(a.fixtures.brokerObservation, path.join(directory, 'installed-broker-observation-proposed-03.cjs'));","    if (directory === paths.observer) copy(a.fixtures.brokerObservation, path.join(directory, 'installed-broker-observation-proposed-03.cjs'));\n    copy(a.fixtures.trustDiagnostics,path.join(directory,'installed-trust-diagnostics-proposed-05.cjs'));");
runner=change(runner,"    const promise = phase({ executable, args, cwd: b.workspace, env: launch.environment(b, b.bindingFile ?? '', false),\n      run: b.gate, name, profile: b.profile, deadlineMs });","    const isGui=name===b.phase+'-code';\n    const phaseToUse=isGui?guiPhase:phase;\n    const promise = phaseToUse({ executable, args, cwd: b.workspace, env: launch.environment(b, b.bindingFile ?? '', false),\n      run: b.gate, name, profile: b.profile, deadlineMs,\n      ...(isGui?{guiAuthority:{feature:'F32',status:'EXPLICIT_EXTRA05_VISIBLE_OWNED_GUI_ONLY',extraAttempt:'PROPOSAL05',binding:b,executable:vendor.currentHost.executable}}:{}) });");
runner=change(runner,"    assert.equal(start.signalsRequested, 0); b.codePid = start.pid;","    assert.equal(start.signalsRequested, 0); assert.equal(start.windowsHide,false);\n    assert.equal(start.guiVisibility,'EXPLICIT_VISIBLE_OWNED_SYNTHETIC_CODE'); b.codePid = start.pid;");
runner=change(runner,"    b.ownerClose = settled[1].value.close;","    b.ownerClose = settled[1].value.close;\n    const codeCloseValue=pinnedJson(b.ownerClose);assert.equal(codeCloseValue.windowsHide,false);\n    assert.equal(codeCloseValue.guiVisibility,'EXPLICIT_VISIBLE_OWNED_SYNTHETIC_CODE');");
runner=change(runner,"'installed-round-03-result.json'","'installed-extra05-result.json'");
runner=change(runner,"'installed-round-03-failure.json'","'installed-extra05-failure.json'");
const review=String.raw`
function verifyExtraApproval(a){
 assert(a.extraApproval,'Explicit single-extra approval is required before consumption or launch');
 assert.equal(a.extraApproval.path,path.join(__dirname,'installed-extra05-user-approval.json'));
 const approval=pinnedJson(a.extraApproval);
 assert.equal(approval.feature,'F32');assert.equal(approval.status,'USER_APPROVED_ONE_BOUNDED_EXTRA05_VISIBLE_GUI_DIAGNOSTIC');
 assert.equal(approval.extraAttempt,'PROPOSAL05');assert.equal(approval.approved,true);assert.equal(approval.maxAttempts,1);
 assert.equal(approval.signalsRequested,0);assert.equal(approval.syntheticOnly,true);assert.equal(approval.runRoot,a.runRoot);
 assert.equal(approval.proposal.path,path.join(__dirname,'TRUST-DIAGNOSTIC-PROPOSAL05.md'));pin(approval.proposal);
 assert.deepEqual(approval.runner,a.fixtures.runner);assert.deepEqual(approval.sourceProof,a.sourceProof);assert.deepEqual(approval.currentVsix,a.currentVsix);
 assert(typeof approval.userAnswer==='string'&&approval.userAnswer.trim().length>0);
 return approval;
}
function verifyPreviousRound03(a){
 const p=a.previousRound03;assert(p);
 for(const [key,name]of Object.entries({consumed:'installed-normal-round-03-consumed.json',admission:'installed-admission-03.json',rootResult:'installed-native-03.txt.result.json'}))assert.equal(p[key].path,path.join(__dirname,name));
 const consumed=pinnedJson(p.consumed),earlier=pinnedJson(p.admission),failure=pinnedJson(p.failure);
 assert.equal(consumed.status,'CONSUMED_ONE_NORMAL_ROUND_NO_RETRY');assert.equal(consumed.normalRound,3);assert.equal(consumed.maxNormalRounds,3);assert.equal(consumed.signalsRequested,0);
 assert.deepEqual(consumed.admission,p.admission);assert.equal(consumed.runRoot,earlier.runRoot);
 assert.equal(earlier.status,'ROOT_REVIEWED_F32_INSTALLED_ROUND03_FINAL_INPUTS');assert.equal(earlier.normalRound,3);
 assert.equal(earlier.sourceProof.sha256,a.sourceProof.sha256);assert.deepEqual(earlier.currentVsix,a.currentVsix);assert.notEqual(a.runRoot.toLowerCase(),earlier.runRoot.toLowerCase());
 assert.equal(p.failure.path,path.join(earlier.runRoot,'receipts','installed-round-03-failure.json'));
 assert.equal(failure.status,'FAIL_OR_INCOMPLETE_RETAIN_OWNERSHIP_NO_RETRY_NO_NEXT_PHASE');assert.equal(failure.signalsRequested,0);
 assert.deepEqual(failure.completed.map(r=>r.name),['primary-before-cli-absence','primary-inventory-before','primary-install-current','primary-inventory-installed','primary-prelaunch-absence','primary-listener-custody','primary-code']);
 for(const row of failure.completed)verifyClose(row.close);
 const gate=path.join(earlier.runRoot,'profile-primary','F32Gate','primary');
 assert.equal(p.rendererClose.path,path.join(gate,'primary-renderer-owned-close.json'));
 const closed=pinnedJson(p.rendererClose);for(const[k,v]of Object.entries({actualClose:true,exitCode:1,signal:null,stdoutEOF:true,stderrEOF:true,overflow:false,streamError:false,deadlineExceeded:false,signalsRequested:0}))assert.equal(closed[k],v);
 assert.deepEqual(closed.streams.map(r=>r.name).sort(),['stderr','stdout']);
 for(const stream of closed.streams){assert.equal(stream.observedBytes,stream.bytes);pin({path:p.rendererClose.path.replace(/owned-close\.json$/,stream.name+'.bin'),bytes:stream.bytes,sha256:stream.sha256});}
 assert.equal(p.observerFailure.path,path.join(gate,'primary-observer-failure.json'));
 const observer=pinnedJson(p.observerFailure);assert.equal(observer.status,'FAIL_NO_RETRY');assert.equal(observer.stage,'NATIVE_TRUST_HANDSHAKE');assert.equal(observer.signalsRequested,0);
 const root=pinnedJson(p.rootResult);assert.equal(root.exitCode,1);assert.equal(root.file,'node');
 assert.equal(path.resolve(REPO,root.output),path.join(__dirname,'installed-native-03.txt'));assert.equal(sha(readFile(path.resolve(REPO,root.output),16*1024*1024)),root.sha256.toLowerCase());
 assert.equal(root.arguments[1],p.admission.path);assert.equal(root.arguments[2],p.admission.sha256);assert.equal(path.resolve(REPO,root.arguments[0]),consumed.fixtureRunner.path);pin(consumed.fixtureRunner);
 return p;
}
`;
runner=change(runner,'function reviewedAdmission(admissionFile, expectedSha) {',review+'\nfunction reviewedAdmission(admissionFile, expectedSha) {');
runner=change(runner,'module.exports = { run, reviewedAdmission,','module.exports = { run, reviewedAdmission, verifyExtraApproval, verifyPreviousRound03,');
write('run-installed-lifecycle-proposed-05.cjs',runner);
console.log(JSON.stringify({status:'INERT_SUCCESSOR_SOURCES_AUTHORED_NO_NATIVE',files:6}));
