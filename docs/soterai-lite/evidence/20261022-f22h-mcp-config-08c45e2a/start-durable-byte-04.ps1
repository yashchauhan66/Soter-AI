$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
$taskFailed=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-byte-failed-exit-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskFailed.status -cne 'PASS_FAILED_BYTE_RUNNER_ABSENT_STABLE_STREAMS' -or $taskFailed.runnerAbsent -ne $true -or $taskFailed.innerExitCode -ne 1){throw 'Retained failed byte runner closure required.'}
$taskNativeFile=Join-Path $PSScriptRoot 'native-resume-run-02.txt'
$taskNative=Get-Content -LiteralPath ($taskNativeFile+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskNative.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskNativeFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskNative.sha256.ToLowerInvariant()){throw 'Actual current native success and exact raw receipt required.'}
$taskNativeStart=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-native-03.json') -Raw -Encoding UTF8|ConvertFrom-Json
if(Get-Process -Id $taskNativeStart.pid -ErrorAction SilentlyContinue){throw 'Recorded native runner still present; no signals or inferred closure.'}
$taskHead=(& git -C $taskRepo rev-parse HEAD).Trim()
$taskBranch=(& git -C $taskRepo branch --show-current).Trim()
if($taskHead -cne 'bcb65d52ae2f63e74a0a5f77edfc583632ddcb57' -or $taskBranch -cne 'soterai-lite-f22h-resume-20261023'){throw 'Reconciled current-parent continuation branch required.'}
$taskOut=Join-Path $PSScriptRoot 'durable-byte-03.stdout.txt'
$taskErr=Join-Path $PSScriptRoot 'durable-byte-03.stderr.txt'
$taskReceipt=Join-Path $PSScriptRoot 'durable-byte-03.json'
foreach($taskFile in @($taskOut,$taskErr,$taskReceipt)){if(Test-Path -LiteralPath $taskFile){throw 'Existing byte-runner evidence overwrite refused.'}}
$taskProcess=Start-Process -FilePath 'powershell' -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $PSScriptRoot 'run-byte-entry-07.ps1')+'"')) -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
@{status='STARTED_NOT_COMPLETED';pid=$taskProcess.Id;startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o');stdout=$taskOut;stderr=$taskErr;entry=(Join-Path $PSScriptRoot 'run-byte-entry-07.ps1');parent=$taskHead;branch=$taskBranch;scope='All actual native gates must already PASS. Closure, snapshots, acceptance, scoped explicit stage, exhaustive staged bytes/whitespace, local source commit/proof, separate transition commit/proof; no push/tag/publish. Wrapper exit code unobserved.'}|ConvertTo-Json|Out-File -LiteralPath $taskReceipt -Encoding utf8 -NoClobber
Get-Content -LiteralPath $taskReceipt
