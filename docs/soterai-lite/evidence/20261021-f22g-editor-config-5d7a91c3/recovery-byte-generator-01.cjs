'use strict';
// Prepare exclusive recovery metadata only; never run gates, hosts or Git.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const base=__dirname,sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),sources=[],outputs=[];
function load(name){const bytes=fs.readFileSync(path.join(base,name));sources.push({name,bytes:bytes.length,sha256:sha(bytes)});return bytes.toString('utf8');}
function change(text,from,to,count=1){assert.equal(text.split(from).length-1,count,'Unexpected seed occurrence count: '+from);return text.split(from).join(to);}
function line(text,prefix,next){const rows=text.split('\n'),found=rows.map((row,i)=>row.startsWith(prefix)?i:-1).filter(i=>i>=0);assert.equal(found.length,1,'Unique seed line required: '+prefix);rows[found[0]]=next;return rows.join('\n');}
function put(name,text){assert(/^[a-z0-9.-]+$/.test(name));assert(!fs.existsSync(path.join(base,name)),'Immutable output exists: '+name);outputs.push({name,text});}
for(const name of ['confirm-durable-final-exit-02.ps1','prepare-acceptance-09.cjs','complete-byte-barriers-09.ps1','run-byte-entry-09.ps1'])assert(!fs.existsSync(path.join(base,name)),'Immutable output exists: '+name);
const checker=String.raw`$ErrorActionPreference='Stop'
$taskOriginal=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-final-start-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskRecovery=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-affected-start-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskOriginal.status -cne 'STARTED_NOT_VERIFIED' -or $taskOriginal.processId -ne 20540){throw 'Unexpected original durable runner binding.'}
if($taskRecovery.status -cne 'STARTED_NOT_VERIFIED' -or [int]$taskRecovery.processId -le 0){throw 'Explicit recovery durable runner binding required.'}
function Get-LocalFact([string]$Name){
 $taskPath=Join-Path $PSScriptRoot $Name
 [PSCustomObject]@{path=$Name;bytes=(Get-Item -LiteralPath $taskPath).Length;sha256=(Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash.ToLowerInvariant()}
}
function Get-ReceiptBinding([string]$Name,[int]$ExpectedExit){
 $taskRaw=Join-Path $PSScriptRoot ($Name+'.txt')
 $taskReceipt=Get-Content -LiteralPath ($taskRaw+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne $ExpectedExit){throw ('Unexpected retained/current command exit: '+$Name)}
 if([IO.Path]::GetFullPath($taskReceipt.output) -cne [IO.Path]::GetFullPath($taskRaw)){throw 'Receipt output path differs.'}
 if((Get-FileHash -LiteralPath $taskRaw -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskReceipt.sha256.ToLowerInvariant()){throw 'Receipt/raw bytes differ.'}
 [PSCustomObject]@{name=$Name;exitCode=$ExpectedExit;log=(Get-LocalFact ($Name+'.txt'));receipt=(Get-LocalFact ($Name+'.txt.result.json'))}
}
$taskCurrent=Get-ReceiptBinding 'recovery-candidate03-run-01' 0
$taskFailureNames=@('final-gates-run-07','candidate03-gates-run-02','affected-ci-run-03')
$taskFailures=@($taskFailureNames|ForEach-Object {Get-ReceiptBinding $_ 1})
foreach($taskRunnerId in @([int]$taskOriginal.processId,[int]$taskRecovery.processId)){
 $taskProcesses=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[string]$taskRunnerId))
 if($taskProcesses.Count -ne 0){throw ('Durable runner still present; stable-stream barrier withheld without signals: '+$taskRunnerId)}
}
$taskNames=@('durable-final-01.stdout.txt','durable-final-01.stderr.txt','durable-affected-01.stdout.txt','durable-affected-01.stderr.txt')
$taskFirst=@($taskNames|ForEach-Object {Get-LocalFact $_})
Start-Sleep -Milliseconds 500
$taskSecond=@($taskNames|ForEach-Object {Get-LocalFact $_})
for($taskIndex=0;$taskIndex -lt $taskNames.Count;$taskIndex++){
 if($taskFirst[$taskIndex].bytes -ne $taskSecond[$taskIndex].bytes -or $taskFirst[$taskIndex].sha256 -cne $taskSecond[$taskIndex].sha256){throw 'Durable stream bytes changed; indexing withheld.'}
}
$taskReport=@{status='PASS_RECOVERY_RECEIPT_BOTH_RUNNERS_ABSENT_AND_FOUR_STABLE_STREAMS';checkedAt=[DateTime]::UtcNow.ToString('o');originalRunnerId=$taskOriginal.processId;recoveryRunnerId=$taskRecovery.processId;originalRunnerAbsent=$true;recoveryRunnerAbsent=$true;wrapperExitCodeObserved=$null;originalWrapperExitCodeObserved=$null;innerRecoveryExitCode=0;originalFinalExitCode=1;recovery=$taskCurrent;retainedFailures=$taskFailures;originalStart=(Get-LocalFact 'durable-final-start-01.json');recoveryStart=(Get-LocalFact 'durable-affected-start-01.json');streams=$taskSecond;observations=2;observationGapMs=500;signalsRequested=0;scope='Actual current recovery inner receipt0, original final07/candidate03 aggregate/affectedCI03 receipt1 and absent exact original/recovery durable runners plus four stable output streams authorize indexing. Original rendererOOM failure/profile and all prior failures remain retained; no wrapper exit code is inferred and no failure is regraded. Each current native host closure remains separately required.'}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskReport|ConvertTo-Json -Depth 12)+[Environment]::NewLine)
$taskHandle=[IO.File]::Open((Join-Path $PSScriptRoot 'durable-recovery-exit-01.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskHandle.Write($taskBytes,0,$taskBytes.Length)}finally{$taskHandle.Dispose()}
$taskReport|ConvertTo-Json -Depth 12
`;
put('confirm-durable-final-exit-02.ps1',checker);
let acceptance=load('prepare-acceptance-08.cjs');
const durableLine="const durable=read(own('durable-recovery-exit-01.json'));assert.equal(durable.status,'PASS_RECOVERY_RECEIPT_BOTH_RUNNERS_ABSENT_AND_FOUR_STABLE_STREAMS');assert.equal(durable.originalRunnerId,20540);assert(Number.isInteger(durable.recoveryRunnerId)&&durable.recoveryRunnerId>0);assert.equal(durable.originalRunnerAbsent,true);assert.equal(durable.recoveryRunnerAbsent,true);assert.equal(durable.innerRecoveryExitCode,0);assert.equal(durable.originalFinalExitCode,1);assert.equal(durable.wrapperExitCodeObserved,null);assert.equal(durable.originalWrapperExitCodeObserved,null);assert.equal(durable.signalsRequested,0);assert.equal(durable.observations,2);assert.equal(durable.observationGapMs,500);assert.deepEqual(durable.streams.map(row=>row.path).sort(),['durable-final-01.stdout.txt','durable-final-01.stderr.txt','durable-affected-01.stdout.txt','durable-affected-01.stderr.txt'].sort());for(const row of [...durable.streams,durable.originalStart,durable.recoveryStart,durable.recovery.log,durable.recovery.receipt]){assert.equal(hash(own(row.path)),row.sha256);assert.equal(fs.statSync(own(row.path)).size,row.bytes);}assert.equal(durable.recovery.name,'recovery-candidate03-run-01');assert.equal(durable.recovery.exitCode,0);assert.deepEqual(durable.retainedFailures.map(row=>row.name).sort(),['final-gates-run-07','candidate03-gates-run-02','affected-ci-run-03'].sort());for(const failure of durable.retainedFailures){assert.equal(failure.exitCode,1);for(const row of [failure.log,failure.receipt]){assert.equal(hash(own(row.path)),row.sha256);assert.equal(fs.statSync(own(row.path)).size,row.bytes);}const rawReceipt=read(own(failure.receipt.path));assert.equal(rawReceipt.exitCode,1);assert.equal(rawReceipt.sha256.toLowerCase(),failure.log.sha256);}";
acceptance=line(acceptance,'const durable=',durableLine);
acceptance=change(acceptance,"own('host-fixture-validation-04.json')","own('host-fixture-validation-05.json')");
const commands=['durable-recovery-exit-check-01','ownership-recheck-01','readme-accuracy-02','editor-plan-02','editor-review-after-01','editor-bundle-after-01','editor-combined-04','build-native-hosts-run-03','host-fixture-validation-run-05','full-tests-06','backend-typecheck-03','backend-tests-03','package-03','inspect-vsix-run-03','editor-native-run-04','affected-ci-run-04','affected-service-account-run-04','affected-registry-run-04','affected-terraform-run-04','affected-container-run-04','affected-source-run-04','affected-hygiene-run-04','affected-vault-run-04','retained-native-run-04','affected-hosts-run-04','current-affected-suite-run-04','recovery-candidate03-run-01','snapshot-execution-run-02'];
acceptance=line(acceptance,'const names=','const names='+JSON.stringify(commands)+";const commands=names.map(name=>({name,...receipt(name+'.txt')}));");
acceptance=change(acceptance,"durableRunner:fact(own('durable-final-exit-01.json'))","durableRunner:fact(own('durable-recovery-exit-01.json')),retainedFailedCommands:durable.retainedFailures");
acceptance=change(acceptance,'Current focus364/full06(3294tests3290PASS4SKIP)/backend03/candidate03/new editor04 and affected03 are all required before acceptance.','Current full06/backend03/package03/content03 and exact editor04 PASS retained. Original affectedCI03 rendererOOM failure made candidate03gates02/final07 exit1; original profiles and raw failures remain retained, no regrade. Same artifact/driver/inputs/host/assertions/flags are required for all affected04 routes and recovery-candidate03-run01 before acceptance. Both durable runners must be absent with four stable streams; wrapper exit codes remain unobserved.');
acceptance=change(acceptance,'All current owned phases exit0/EOF/no signals/source DocumentAPI0;','Original affectedCI03 rendererOOM/aggregatefinal07exit1/profile retained, not regraded; same-artifact current affected04 recovery aggregate PASS with both durable runners absent and four stable streams, wrapper exit codes unobserved. All current owned phases exit0/EOF/no signals/source DocumentAPI0;');
assert(acceptance.includes('../20261021-f22f-ci-46f38b2d/vsix-inspection-02.json'));assert(acceptance.includes("native=require('./native-evidence-validation-03.cjs')"));assert(!commands.includes('final-gates-run-07')&&!commands.includes('candidate03-gates-run-02')&&!commands.includes('affected-ci-run-03'));
put('prepare-acceptance-09.cjs',acceptance);
let bytes=load('complete-byte-barriers-08.ps1');
bytes=change(bytes,"'durable-final-exit-check-01'","'durable-recovery-exit-check-01'");
bytes=change(bytes,"'confirm-durable-final-exit-01.ps1'","'confirm-durable-final-exit-02.ps1'");
bytes=change(bytes,"'prepare-acceptance-08.cjs'","'prepare-acceptance-09.cjs'");
assert(bytes.indexOf("'confirm-durable-final-exit-02.ps1'")<bytes.indexOf("'snapshot-execution-03.cjs'"));
put('complete-byte-barriers-09.ps1',bytes);
let entry=load('run-byte-entry-08.ps1');entry=change(entry,"'complete-byte-barriers-08.ps1'","'complete-byte-barriers-09.ps1'");put('run-byte-entry-09.ps1',entry);
// Complete every source transformation and absence check before the first write.
for(const row of outputs){fs.writeFileSync(path.join(base,row.name),row.text,{flag:'wx'});row.bytes=Buffer.byteLength(row.text);row.sha256=sha(Buffer.from(row.text));delete row.text;}
console.log(JSON.stringify({status:'PREPARED_RECOVERY_METADATA_ONLY_NOT_EXECUTED',sources,outputs,scope:'Acceptance09/current affected04 on retained candidate03/editor04/full06/backend03/progress05. No product/test/build changes, gate execution, native launch, signals, staging or commits; original failed aggregates remain failures.'}));
