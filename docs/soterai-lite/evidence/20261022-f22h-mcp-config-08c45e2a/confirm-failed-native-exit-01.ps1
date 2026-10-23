$ErrorActionPreference='Stop'
$taskStart=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-native-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskInner=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-gates-run-01.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskInner.exitCode -ne 1){throw 'Expected retained failed native-pipeline receipt.'}
$taskFirst=@()
foreach($taskFile in @($taskStart.stdout,$taskStart.stderr)){$taskFirst+=@{path=[IO.Path]::GetFileName($taskFile);bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant()}}
Start-Sleep -Milliseconds 500
$taskSecond=@()
foreach($taskFile in @($taskStart.stdout,$taskStart.stderr)){$taskSecond+=@{path=[IO.Path]::GetFileName($taskFile);bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant()}}
if(($taskFirst|ConvertTo-Json -Compress) -cne ($taskSecond|ConvertTo-Json -Compress)){throw 'Failed pipeline streams still changing.'}
if(Get-Process -Id $taskStart.pid -ErrorAction SilentlyContinue){throw 'Recorded failed runner PID still present; no signals.'}
@{status='PASS_FAILED_NATIVE_RUNNER_ABSENT_STABLE_STREAMS';innerExitCode=1;runnerId=$taskStart.pid;runnerAbsent=$true;wrapperExitCodeObserved=$null;streams=$taskSecond;observations=2;observationGapMs=500;signalsRequested=0;nativePipelineStatus='FAIL_RETAINED_NOT_REGRADED'}|ConvertTo-Json -Depth 8|Out-File -LiteralPath (Join-Path $PSScriptRoot 'durable-native-failed-exit-01.json') -Encoding utf8 -NoClobber
@{status='PASS_FAILED_RUNNER_OBSERVATION_ONLY';nativePipelineStatus='FAIL_RETAINED_NOT_REGRADED';runnerId=$taskStart.pid;signalsRequested=0}|ConvertTo-Json
