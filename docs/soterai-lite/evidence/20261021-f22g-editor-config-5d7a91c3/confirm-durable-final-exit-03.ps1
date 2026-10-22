$ErrorActionPreference='Stop'
$taskStart=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-affected-start-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskStart.status -cne 'STARTED_NOT_VERIFIED' -or [int]$taskStart.processId -le 0){throw 'Explicit resumed durable runner binding required.'}
function Get-LocalFact([string]$Name){
 $taskFile=Join-Path $PSScriptRoot $Name
 [PSCustomObject]@{path=$Name;bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant()}
}
function Assert-LocalFact($Fact){
 $taskCurrent=Get-LocalFact $Fact.path
 if($taskCurrent.bytes -ne $Fact.bytes -or $taskCurrent.sha256 -cne $Fact.sha256){throw ('Frozen local evidence changed: '+$Fact.path)}
}
function Get-ReceiptBinding([string]$Name,[int]$ExpectedExit){
 $taskRaw=Join-Path $PSScriptRoot ($Name+'.txt')
 $taskReceipt=Get-Content -LiteralPath ($taskRaw+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne $ExpectedExit){throw ('Unexpected retained/current command exit: '+$Name)}
 if([IO.Path]::GetFullPath($taskReceipt.output) -cne [IO.Path]::GetFullPath($taskRaw)){throw 'Receipt output path differs.'}
 if((Get-FileHash -LiteralPath $taskRaw -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskReceipt.sha256.ToLowerInvariant()){throw 'Receipt/raw bytes differ.'}
 [PSCustomObject]@{name=$Name;exitCode=$ExpectedExit;log=(Get-LocalFact ($Name+'.txt'));receipt=(Get-LocalFact ($Name+'.txt.result.json'))}
}
$taskCurrent=Get-ReceiptBinding 'resumed-candidate03-run-01' 0
$taskFailure=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'checkpoint-failure-stability-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskFailure.status -cne 'INCOMPLETE_CURRENT_NATIVE_FAILED_STABLE' -or @($taskFailure.streams).Count -ne 4){throw 'Historical checkpoint stream binding required.'}
$taskOldNames=@('durable-final-01.stdout.txt','durable-final-01.stderr.txt','durable-affected-01.stdout.txt','durable-affected-01.stderr.txt')
if((@($taskFailure.streams.path|Sort-Object)-join '|') -cne (@($taskOldNames|Sort-Object)-join '|')){throw 'Unexpected historical stream set.'}
foreach($taskFact in $taskFailure.streams){Assert-LocalFact $taskFact}
# Historical PID identities may have been reused: validate only their frozen streams.
$taskProcesses=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[string][int]$taskStart.processId))
if($taskProcesses.Count -ne 0){throw 'Resumed runner still present; stable-stream barrier withheld without signals.'}
$taskNewNames=@('durable-affected-02.stdout.txt','durable-affected-02.stderr.txt')
$taskFirst=@($taskNewNames|ForEach-Object {Get-LocalFact $_})
Start-Sleep -Milliseconds 500
$taskSecond=@($taskNewNames|ForEach-Object {Get-LocalFact $_})
for($taskIndex=0;$taskIndex -lt $taskNewNames.Count;$taskIndex++){
 if($taskFirst[$taskIndex].bytes -ne $taskSecond[$taskIndex].bytes -or $taskFirst[$taskIndex].sha256 -cne $taskSecond[$taskIndex].sha256){throw 'Resumed stream bytes changed; indexing withheld.'}
}
foreach($taskFact in $taskFailure.streams){Assert-LocalFact $taskFact}
$taskFailureNames=@('final-gates-run-07','candidate03-gates-run-02','affected-ci-run-03','affected-ci-run-04','current-affected-suite-run-04','recovery-candidate03-run-01')
$taskRetained=@($taskFailureNames|ForEach-Object {Get-ReceiptBinding $_ 1})
$taskReport=@{status='PASS_RESUMED_RECEIPT_NEW_RUNNER_ABSENT_SIX_STABLE_STREAMS';checkedAt=[DateTime]::UtcNow.ToString('o');runnerId=$taskStart.processId;newRunnerAbsent=$true;wrapperExitCodeObserved=$null;innerResumedExitCode=0;oldPidsNotRechecked=$true;oldStreamsFromCheckpoint=$true;historicalFailure=(Get-LocalFact 'checkpoint-failure-stability-01.json');start=(Get-LocalFact 'durable-affected-start-02.json');resumed=$taskCurrent;retainedFailures=$taskRetained;oldStreams=@($taskFailure.streams);newStreams=$taskSecond;streams=@($taskFailure.streams)+@($taskSecond);observations=2;observationGapMs=500;signalsRequested=0;scope='Actual resumed aggregate receipt0 and absent exact new durable runner plus two stable new output streams, while four old streams still match their frozen checkpoint, authorize indexing. Old PIDs are not queried because their identities may be reused. No wrapper exit code or old failure regrade is inferred; current native closures remain separately required.'}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskReport|ConvertTo-Json -Depth 12)+[Environment]::NewLine)
$taskHandle=[IO.File]::Open((Join-Path $PSScriptRoot 'durable-resumed-exit-01.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskHandle.Write($taskBytes,0,$taskBytes.Length)}finally{$taskHandle.Dispose()}
$taskReport|ConvertTo-Json -Depth 12
