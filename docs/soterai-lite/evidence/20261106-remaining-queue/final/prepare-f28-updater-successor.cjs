'use strict';
// New evidence-only retry packet. Refuse a busy updater; never stop or bypass it.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../../../..'),parent=path.join(root,'docs/soterai-lite/evidence/20261106-editor-reliability-01'),old=path.join(parent,'f28-current-01'),out=path.join(parent,'f28-updater-successor-02');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const fact=p=>{const b=fs.readFileSync(p);return{path:path.relative(root,p).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)};};
const put=(name,value)=>fs.writeFileSync(path.join(out,name),typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
assert(!fs.existsSync(out));fs.mkdirSync(out);const b=read(path.join(old,'native-binding-current-02.json'));
const failedRoot=path.join(old,'f28-reliability-native-20261106T145753Z-20410e2b'),raw=read(path.join(failedRoot,'primary-results.json'));
assert.deepEqual([raw.passed,raw.failed,raw.notRun],[20,1,4]);assert.equal(raw.observations.find(o=>o.status==='FAIL').id,'F28-HP21');assert.equal(raw.peerChildren[0].code,1);assert(raw.peerChildren[0].stdoutEOF&&raw.peerChildren[0].stderrEOF);
const peerErr=fs.readFileSync(raw.peerChildren[0].streams.find(s=>s.channel==='stderr').file,'utf8');assert(peerErr.includes('checkInnoSetupMutex: vscode-updating still held'));assert(peerErr.includes('Code is currently being updated.'));
for(const stream of raw.peerChildren[0].streams){const actual=fact(stream.file);assert.equal(actual.sha256,stream.sha256);assert.equal(actual.bytes,stream.bytes);put('retained-failed-peer-'+stream.channel+'.bin',fs.readFileSync(stream.file));}
const guard=`# Read-only preflight: open existing mutex handle without waiting/acquiring it; never modify/stop updater.
$ErrorActionPreference='Stop'
function Assert-F28UpdaterIdle {
 $taskMutex=$null;$taskPresent=$false
 try {$taskMutex=[Threading.Mutex]::OpenExisting('vscode-updating');$taskPresent=$true} catch [Threading.WaitHandleCannotBeOpenedException] {$taskPresent=$false} finally {if($null -ne $taskMutex){$taskMutex.Dispose()}}
 if($taskPresent){throw 'F28_NATIVE_PREFLIGHT_UPDATER_BUSY_NO_CODE_LAUNCH'}
 $taskActive=@(Get-Process -Name '*Code*Setup*','*Inno*' -ErrorAction SilentlyContinue)
 if($taskActive.Count -gt 0){throw 'F28_NATIVE_PREFLIGHT_SETUP_PROCESS_PRESENT_NO_CODE_LAUNCH'}
}
`;
put('updater-preflight.ps1',guard);const guardFact=fact(path.join(out,'updater-preflight.ps1'));
const names=['lite-reliability-host.js','native-reliability-04.host.ts.txt','native-case-freeze-04.json','current-admission-02.cjs','native-admission-current-02.ps1','native-launch-current-02.ps1','run-native-current-02.cjs'];
for(const name of names){let content=fs.readFileSync(path.join(old,name),'utf8');if(name==='native-launch-current-02.ps1'){
 const prior='docs/soterai-lite/evidence/20261106-editor-reliability-01/f28-current-01/';assert.equal(content.split(prior).length,2);content=content.replace(prior,'docs/soterai-lite/evidence/20261106-editor-reliability-01/f28-updater-successor-02/');
 const anchor='$taskBinding=Assert-F28Admission $BindingPath $ExpectedBindingSha256';assert.equal(content.split(anchor).length,2);
 content=content.replace(anchor,anchor+"\n$taskUpdaterGuard=Join-Path $PSScriptRoot 'updater-preflight.ps1'\nAssert-F28File $taskUpdaterGuard '"+guardFact.sha256+"' "+guardFact.bytes+"\n. $taskUpdaterGuard\nAssert-F28UpdaterIdle");
 const begin='function Assert-F28NativeInputs{';assert.equal(content.split(begin).length,2);content=content.replace(begin,begin+'\n Assert-F28UpdaterIdle');
}put(name,content);}
for(const key of ['guard','admission','candidate','driver','driverSource','caseFreeze'])b[key]=fact(path.join(out,path.basename(b[key].path)));
b.fixtureInputs=b.fixtureInputs.map(f=>fact(path.join(out,path.basename(f.path))));b.fixtureInputs.push(guardFact,fact(path.join(root,'docs/soterai-lite/evidence/20261106-v01-current-01/binding.json')));
const p=read(path.join(old,'driver-provenance-current-02.json'));p.driver=b.driver;p.source=b.driverSource;p.caseFreeze=b.caseFreeze;p.launcher=b.candidate;p.onlyLauncherDeltas.push('Read-only external updater mutex/process preflight before profile creation/Code launch and each primary/restart phase; no updater bypass or process signal');p.priorFailedBinding=fact(path.join(old,'native-binding-current-02.json'));put('driver-provenance-current-02.json',p);b.driverProvenance=fact(path.join(out,'driver-provenance-current-02.json'));
b.prelaunchEnvironmentRequirement='External vscode-updating mutex absent and no CodeSetup/Inno process; exact admittedCode1.145.1 hashes still required. If updater changes host, refresh complete common host admission before any launch.';
put('native-binding-current-02.json',b);
for(const name of names.filter(n=>n.endsWith('.cjs')))new vm.Script(fs.readFileSync(path.join(out,name),'utf8'),{filename:name});
const binding=fact(path.join(out,'native-binding-current-02.json'));require(path.join(out,'current-admission-02.cjs')).binding(binding.sha256);
const result={status:'PASS_FRESH_F28_ORIGINAL30_RETRY_PREPARATION_UPDATER_IDLE_REQUIRED_NOT_RUN',observedAt:new Date().toISOString(),vsix:b.vsix,sourceProof:b.sourceProof,codeVersion:'1.145.1',binding,runner:fact(path.join(out,'run-native-current-02.cjs')),preflight:guardFact,
 failure:{originalBinding:fact(path.join(old,'native-binding-current-02.json')),outer:fact(path.join(old,'native-current-01-owned-close.json')),actualPrimary:fact(path.join(failedRoot,'primary-results.json')),primaryCodeClose:fact(path.join(failedRoot,'primary-owned-editor-close.json')),peerStderr:fact(path.join(out,'retained-failed-peer-stderr.bin')),counts:{passed:20,failed:1,primaryNotRun:4,restartNotEntered:5},failedId:'F28-HP21',cause:'Installed Code refused concurrent peer while external vscode-updating mutex held',notAProductFix:true},
 diagnostics:{updater:fact(path.join(old,'updater-observation-01.json')),primarySettings:fact('D:/SoterAI-Lite-test-profiles/f28-reliability-native-20261106T145753Z-20410e2b/profile/User/settings.json'),peerSettings:fact('D:/SoterAI-Lite-test-profiles/f28-reliability-native-20261106T145753Z-20410e2b/peer-profile/User/settings.json'),actualPrimaryMainLog:fact('D:/SoterAI-Lite-test-profiles/f28-reliability-native-20261106T145753Z-20410e2b/profile/logs/20261106T202800/main.log'),updates:'Both profiles update.mode=none and launch args --disable-updates; main.log confirms updater disabled by environment. External updater origin not attributed without parent-process proof.'},
 assertionPreservation:{driverSha256:b.driver.sha256,originalThirtyCasesSha256:b.caseFreeze.sha256,unchanged:true},newNativeLaunches:0,productWrites:0,normalProfilesChanged:false,signalsRequested:0,readiness:'BLOCKED_BY_OBSERVED_EXTERNAL_UPDATER_UNTIL_NEW_IDLE_AND_EXACT_HOST_OBSERVATION'};put('preparation.json',result);console.log(JSON.stringify({status:result.status,binding,runner:result.runner,receipt:fact(path.join(out,'preparation.json'))}));
