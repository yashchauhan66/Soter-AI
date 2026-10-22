$ErrorActionPreference='Stop'
$taskStart=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-final-start-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskStart.status -cne 'STARTED_NOT_VERIFIED' -or $taskStart.processId -ne 20540){throw 'Unexpected durable runner binding.'}
$taskFinal=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'final-gates-run-07.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskFinal.exitCode -ne 0){throw 'Actual final07 completion receipt must pass.'}
$taskFinalRaw=Join-Path $PSScriptRoot 'final-gates-run-07.txt'
if((Get-FileHash -LiteralPath $taskFinalRaw -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskFinal.sha256.ToLowerInvariant()){throw 'Final receipt/raw mismatch.'}
$taskProcesses=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+[string][int]$taskStart.processId))
if($taskProcesses.Count -ne 0){throw 'Runner PID still present; stable-stream barrier withheld without signals.'}
function Get-StreamFact([string]$Name){
 $taskFile=Join-Path $PSScriptRoot $Name
 [PSCustomObject]@{path=$Name;bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$taskNames=@('durable-final-01.stdout.txt','durable-final-01.stderr.txt')
$taskFirst=@($taskNames|ForEach-Object {Get-StreamFact $_})
Start-Sleep -Milliseconds 500
$taskSecond=@($taskNames|ForEach-Object {Get-StreamFact $_})
for($taskIndex=0;$taskIndex -lt $taskNames.Count;$taskIndex++){
 if($taskFirst[$taskIndex].bytes -ne $taskSecond[$taskIndex].bytes -or $taskFirst[$taskIndex].sha256 -cne $taskSecond[$taskIndex].sha256){throw 'Durable stream bytes changed; indexing withheld.'}
}
$taskReport=@{status='PASS_COMPLETION_RECEIPT_RUNNER_ABSENCE_AND_STABLE_STREAMS';checkedAt=[DateTime]::UtcNow.ToString('o');runnerId=$taskStart.processId;runnerAbsent=$true;wrapperExitCodeObserved=$null;innerFinalExitCode=$taskFinal.exitCode;finalRawSha256=$taskFinal.sha256.ToLowerInvariant();streams=$taskSecond;observations=2;observationGapMs=500;signalsRequested=0;scope='Actual final07 inner receipt0 and absent exact durable runner plus stable output bytes authorize byte indexing. Absence does not establish wrapper exit code or regrade full05. Each current native host closure remains separately required.'}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskReport|ConvertTo-Json -Depth 8)+[Environment]::NewLine)
$taskHandle=[IO.File]::Open((Join-Path $PSScriptRoot 'durable-final-exit-01.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskHandle.Write($taskBytes,0,$taskBytes.Length)}finally{$taskHandle.Dispose()}
$taskReport|ConvertTo-Json -Depth 8
