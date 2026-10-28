// Requires the real current28 result; never manufactures a future emitted script.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {guard,pin,repo,own,read,sha,relativeFile}=require('./affected-history-current-guard-01.cjs');
const fact=file=>{const b=fs.readFileSync(file);return{path:path.relative(repo,file).replace(/\\/g,'/'),bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}};
async function main(){
 const b=await guard();assert.equal(read(own('affected-history-chain-result-02.json')).status,'AFFECTED_HISTORY28_WRAPPER_CLOSED_PASS_ROOT_AGGREGATION_PENDING');
 const receipt=read(own('affected-psreadline-regression-run-01.txt.result.json')),raw=fs.readFileSync(own('affected-psreadline-regression-run-01.txt'));assert.equal(receipt.exitCode,0);assert.equal(sha(raw),receipt.sha256.toLowerCase());
 const rows=raw.toString().split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));const result=rows.find(row=>row.status==='PASS_SCOPED_NATIVE_OWNER_API_ONLY'&&row.nativeChecks===28);assert(result);
 const run=path.resolve(result.evidence);assert(run.startsWith(__dirname+path.sep));assert(/^f27-affected-history-native-[0-9TZ]+-[a-f0-9]{8}$/.test(path.basename(run)));
 const summary=read(path.join(run,'summary.json'));assert.equal(summary.nativeChecks,28);assert.equal(summary.vsixSha256,b.vsix.sha256);
 for(const phase of ['primary','restart']){const close=read(path.join(run,phase+'-owned-close.json'));assert.equal(close.actualClose,true);assert.equal(close.exitCode,0);assert.equal(close.signal,null);assert(close.stdoutEOF&&close.stderrEOF&&!close.deadlineExceeded&&!close.overflow&&!close.streamError);assert.equal(close.signalsRequested,0);}
 const inputs=read(path.join(run,'inputs.json')),execution=path.resolve(inputs.execution);assert(/^D:\\SoterAI-Lite-test-profiles\\f27-affected-history-native-[0-9TZ]+-[a-f0-9]{8}$/.test(execution));
 const emitted=path.join(run,'native-emitted-history-profile.ps1'),nativeEmitted=path.join(execution,'native-emitted-history-profile.ps1');assert.equal(sha(fs.readFileSync(emitted)),sha(fs.readFileSync(nativeEmitted)));
 const binding={schemaVersion:1,feature:'F27',status:'BOUND_CURRENT_F27_NATIVE28_EMITTED_PROFILE_CONSOLE_NOT_RUN',candidate:b.vsix,nativeSummary:fact(path.join(run,'summary.json')),primaryResult:fact(path.join(run,'primary-results.json')),restartResult:fact(path.join(run,'restart-results.json')),emittedProfile:fact(emitted),sourceProof:b.sourceProof,currentDriverProvenance:b.driverProvenance,vendorReview:b.hostReview,script:fact(own('history-console-01.ps1')),native06:'F26a_USER_DEFERRED_NOT_RUN'};
 const checkpoint=read(relativeFile(b.historyModuleCheckpoint.path));for(const row of checkpoint.installedModule.files)await pin(row,true);
 const exe='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',powerShell={path:exe,bytes:454656,sha256:'8e8b07b3e7de55252ecc09dd7082542b6592afba8410e640acb7cda965a4ba16'};require('./console-powershell-pin-01.cjs').pinPowerShell(powerShell);
 const vendor={schemaVersion:1,status:'BOUND_CURRENT_F27_HISTORY_VENDOR_REVIEWED',powershell:powerShell,installedModule:checkpoint.installedModule,hostReview:b.hostReview};
 fs.writeFileSync(own('history-console-binding-01.json'),JSON.stringify(binding,null,2)+'\n',{flag:'wx'});fs.writeFileSync(own('history-console-vendor-01.json'),JSON.stringify(vendor,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'CURRENT_NATIVE_EMITTED_SCRIPT_BOUND_CONSOLE_NOT_RUN',candidate:b.vsix.sha256,emittedProfile:binding.emittedProfile,checksExpected:8,native06:binding.native06}));
}
main().catch(error=>{console.error(error.stack);console.error('Current emitted history console binding refused; no console launch.');process.exitCode=1;});
