$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
$taskSerial=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-serial-exit-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskSerial.status -cne 'PASS_INNER_RECEIPT_OWNED_RUNNER_ABSENT_STABLE_STREAMS' -or $taskSerial.innerExitCode -ne 0 -or $taskSerial.runnerAbsent -ne $true){throw 'Actual serial gates/closure required before starting native runner.'}
$taskOut=Join-Path $PSScriptRoot 'durable-native-01.stdout.txt'
$taskErr=Join-Path $PSScriptRoot 'durable-native-01.stderr.txt'
$taskReceipt=Join-Path $PSScriptRoot 'durable-native-01.json'
foreach($taskName in @($taskOut,$taskErr,$taskReceipt)){if(Test-Path -LiteralPath $taskName){throw 'Existing durable evidence overwrite refused.'}}
$taskProcess=Start-Process -FilePath 'powershell' -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $PSScriptRoot 'run-native-entry-01.ps1')+'"')) -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
@{status='STARTED_NOT_COMPLETED';pid=$taskProcess.Id;startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o');stdout=$taskOut;stderr=$taskErr;entry=(Join-Path $PSScriptRoot 'run-native-entry-01.ps1');scope='One hidden owned native runner after source suite closure. Exact isolated profiles and no signals/OS changes. Wrapper exit code unobserved.'}|ConvertTo-Json|Out-File -LiteralPath $taskReceipt -Encoding utf8 -NoClobber
Get-Content -LiteralPath $taskReceipt
