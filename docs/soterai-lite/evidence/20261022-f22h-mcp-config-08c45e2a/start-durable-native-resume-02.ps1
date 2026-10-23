$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
$taskOld=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-native-failed-exit-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskSerial=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-serial-exit-03.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskOld.innerExitCode -ne 1 -or $taskOld.runnerAbsent -ne $true -or $taskSerial.innerExitCode -ne 0 -or $taskSerial.runnerAbsent -ne $true){throw 'Current serial success and retained failed prelaunch runner closure required.'}
$taskGuard=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixture-fix-guard-run-01.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskGuard.exitCode -ne 0){throw 'Current stable manifest preflight must pass.'}
$taskOut=Join-Path $PSScriptRoot 'durable-native-03.stdout.txt'
$taskErr=Join-Path $PSScriptRoot 'durable-native-03.stderr.txt'
$taskReceipt=Join-Path $PSScriptRoot 'durable-native-03.json'
foreach($taskFile in @($taskOut,$taskErr,$taskReceipt)){if(Test-Path -LiteralPath $taskFile){throw 'Existing resume evidence overwrite refused.'}}
$taskProcess=Start-Process -FilePath 'powershell' -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $PSScriptRoot 'run-native-resume-entry-02.ps1')+'"')) -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
@{status='STARTED_NOT_COMPLETED';pid=$taskProcess.Id;startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o');stdout=$taskOut;stderr=$taskErr;entry=(Join-Path $PSScriptRoot 'run-native-resume-entry-02.ps1');sameVsixSha256='578a9ef8193d6572eee314ea6b274b4e344db28837560e1cc621f12693465e3a';scope='Bounded native fixture round1: correct cleanup command after primary21PASS; failedrun and owned exit0/bothEOF retained. Same exact built VSIX, driver/source/runtime/test data, vendor pins, timers/budgets and no-signals rule; stable manifest/current664inputs guarded. Wrapper exit code unobserved.'}|ConvertTo-Json|Out-File -LiteralPath $taskReceipt -Encoding utf8 -NoClobber
Get-Content -LiteralPath $taskReceipt
