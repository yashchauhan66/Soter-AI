$ErrorActionPreference='Stop'
$taskProfile=Join-Path $PSScriptRoot 'f26a-precommit-native-20261026T071934Z-80085688'
$taskClose=Get-Content -LiteralPath (Join-Path $taskProfile 'primary-owned-editor-close.json') -Raw|ConvertFrom-Json
if($taskClose.pid -ne 15000 -or -not $taskClose.observedExit -or $taskClose.exitCode -ne 0 -or -not $taskClose.stdoutEOF -or -not $taskClose.stderrEOF -or $taskClose.signalsRequested -ne 0){throw 'Actual closed owned Code/EOF required.'}
$taskObservations=@()
foreach($taskIteration in 1..2){
 $taskOwned=Get-Process -Id 15000 -ErrorAction SilentlyContinue
 if($taskOwned){throw 'Recorded owned PID currently present; do not signal it.'}
 $taskObservations+=@{time=[DateTime]::UtcNow.ToString('o');pid=15000;absent=$true;stdoutSha256=(Get-FileHash -LiteralPath (Join-Path $taskProfile 'primary-stdout.txt') -Algorithm SHA256).Hash.ToLowerInvariant();stderrSha256=(Get-FileHash -LiteralPath (Join-Path $taskProfile 'primary-stderr.txt') -Algorithm SHA256).Hash.ToLowerInvariant()}
 if($taskIteration -eq 1){Start-Sleep -Milliseconds 1500}
}
if($taskObservations[0].stdoutSha256 -cne $taskObservations[1].stdoutSha256 -or $taskObservations[0].stderrSha256 -cne $taskObservations[1].stderrSha256){throw 'Closed streams changed; preserve and investigate.'}
@{status='FAILED_NATIVE05_CODE_ABSENT_TWICE_STREAMS_STABLE';originalCodeClose='primary-owned-editor-close.json';observations=$taskObservations;signalsRequested=0;behavior='3PASS_1FAIL_26NOTRUN_RESTART_NOTRUN';cause='HP04_OWNER_CONTEXT_REFUSED_BEFORE_MODAL_NATIVE_ENVIRONMENT_PROTOTYPE_REPRODUCED_SEPARATELY'}|ConvertTo-Json -Depth 7|Out-File -LiteralPath (Join-Path $taskProfile 'primary-failed-owned-editor-absence-01.json') -Encoding utf8 -NoClobber
