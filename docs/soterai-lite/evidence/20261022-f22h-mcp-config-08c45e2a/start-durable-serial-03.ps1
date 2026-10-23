$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
$taskOut=Join-Path $PSScriptRoot 'durable-serial-03.stdout.txt'
$taskErr=Join-Path $PSScriptRoot 'durable-serial-03.stderr.txt'
$taskReceipt=Join-Path $PSScriptRoot 'durable-serial-03.json'
foreach($taskName in @($taskOut,$taskErr,$taskReceipt)){if(Test-Path -LiteralPath $taskName){throw 'Existing durable evidence overwrite refused.'}}
$taskProcess=Start-Process -FilePath 'powershell' -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $PSScriptRoot 'run-serial-entry-03.ps1')+'"')) -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
@{status='STARTED_NOT_COMPLETED';pid=$taskProcess.Id;startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o');stdout=$taskOut;stderr=$taskErr;entry=(Join-Path $PSScriptRoot 'run-serial-entry-03.ps1');scope='One hidden owned serial runner; no process signals/OS changes. Wrapper exit code unobserved until actual receipt/closure checks.'}|ConvertTo-Json|Out-File -LiteralPath $taskReceipt -Encoding utf8 -NoClobber
Get-Content -LiteralPath $taskReceipt
