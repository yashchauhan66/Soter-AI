$ErrorActionPreference='Stop'
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
$taskCurrent=Get-ReceiptBinding 'recovery-candidate03-run-01' 1
$taskFailureNames=@('final-gates-run-07','candidate03-gates-run-02','affected-ci-run-03','current-affected-suite-run-04','affected-ci-run-04')
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
$taskReport=@{status='INCOMPLETE_CURRENT_NATIVE_FAILED_STABLE';checkedAt=[DateTime]::UtcNow.ToString('o');originalRunnerId=$taskOriginal.processId;recoveryRunnerId=$taskRecovery.processId;originalRunnerAbsent=$true;recoveryRunnerAbsent=$true;wrapperExitCodeObserved=$null;originalWrapperExitCodeObserved=$null;innerRecoveryExitCode=1;originalFinalExitCode=1;recovery=$taskCurrent;retainedFailures=$taskFailures;originalStart=(Get-LocalFact 'durable-final-start-01.json');recoveryStart=(Get-LocalFact 'durable-affected-start-01.json');streams=$taskSecond;observations=2;observationGapMs=500;signalsRequested=0;scope='Actual failed recovery inner receipt1, original final07/candidate03 aggregate/affectedCI03 receipt1 and absent exact original/recovery durable runners plus four stable output streams authorize ACTIVE checkpoint indexing only; feature acceptance remainsINCOMPLETE. Original rendererOOM failure/profile and all prior failures remain retained; no wrapper exit code is inferred and no failure is regraded. Each current native host closure remains separately required.'}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskReport|ConvertTo-Json -Depth 12)+[Environment]::NewLine)
$taskHandle=[IO.File]::Open((Join-Path $PSScriptRoot 'checkpoint-failure-stability-01.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskHandle.Write($taskBytes,0,$taskBytes.Length)}finally{$taskHandle.Dispose()}
$taskReport|ConvertTo-Json -Depth 12
