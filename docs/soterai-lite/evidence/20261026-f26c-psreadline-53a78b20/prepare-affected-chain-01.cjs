const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const own=n=>path.join(__dirname,n);
let text=fs.readFileSync(own('run-serial-05.cjs'),'utf8').replace('async function step(name,args,cwd=repo){','async function step(name,args,cwd=repo,program=process.execPath){').replace('quote(process.execPath)','quote(program)');
const start=text.indexOf('async function main(){'),end=text.indexOf('\nmain().catch(',start);assert(start>=0&&end>start);
text=text.slice(0,start)+`async function main(){
 json('affected-chain-start-01.json',{status:'STARTED_NOT_COMPLETED',observedAt:new Date().toISOString(),pid:process.pid,signalsRequested:0,native06:'EXCLUDED_NOT_RUN',historyExtraRound:'NOT_INCLUDED_REQUIRES_APPROVAL'});
 verifyInputs();assert.equal(read(own('serial-result-05.json')).status,'SERIAL_VERIFICATION_PASSED_NOT_FEATURE_OR_NATIVE_ACCEPTANCE');
 const admission=read(own('affected-validation-01.txt.result.json'));assert.equal(admission.exitCode,0);assert.equal(sha(fs.readFileSync(own('affected-validation-01.txt'))),admission.sha256.toLowerCase());
 const binding=await require('./current-native-guard-05.cjs').guard(),host=read(path.join(repo,binding.hostReview.path)).currentHost;
 const artifact=['-VsixPath',path.join(repo,binding.vsix.path),'-ExpectedVsixSha256',binding.vsix.sha256,'-ExpectedBundleSha256',binding.frontendSha256];
 const nativeArgs=(helper,driver)=>['-NoProfile','-ExecutionPolicy','Bypass','-File',own(helper),'-CodePath',host.executable.path,...artifact,'-HostTestsPath',own('prebuilt-native-hosts-03/'+driver),'-ExtensionRoot',path.join(repo,binding.extractedRoot)];
 await step('affected-logs-run-01',nativeArgs('run-logs-native-04.ps1','lite-logs-host.js'),repo,powershell);verifyInputs();
 await step('affected-owned-output-run-01',nativeArgs('run-owned-output-native-04.ps1','lite-log-vault-runtime-host.js'),repo,powershell);verifyInputs();
 await step('affected-current-suite-run-01',['-NoProfile','-ExecutionPolicy','Bypass','-File',own('run-current-affected-suite-04.ps1'),...artifact],repo,powershell);verifyInputs();
 json('affected-chain-result-01.json',{status:'AFFECTED_CONTROLS_CLOSED_PASS_REQUIRES_ROOT_RESULT_AGGREGATION_NOT_FEATURE_ACCEPTANCE',observedAt:new Date().toISOString(),results,signalsRequested:0,historyExtraRound:'NOT_INCLUDED',native06:'EXCLUDED_NOT_RUN'});
}`+text.slice(end);
text=text.replaceAll('serial-failure-05.json','affected-chain-failure-01.json').replaceAll('F26c serial verification refused','F26c affected verification chain refused');fs.writeFileSync(own('run-affected-chain-01.cjs'),text,{flag:'wx'});console.log('Prepared sequential20 affected families+functional/security; extra history/native06 excluded.');
