$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskOld=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'final-gates-run-07.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskOld.exitCode -ne 1){throw 'Original failed pipeline receipt required.'}
if(@(Get-CimInstance Win32_Process -Filter 'ProcessId=20540').Count -ne 0){throw 'Prior durable runner still present; retry refused without signals.'}
foreach($taskName in @('current-affected-suite-run-04.txt','recovery-candidate03-run-01.txt','durable-affected-01.stdout.txt','durable-affected-01.stderr.txt','durable-affected-start-01.json','unchanged-affected-resource-01.json')){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $taskName)){throw 'Retry output already exists.'}}
$taskFixture=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-fixture-validation-run-05.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskFixture.exitCode -ne 0){throw 'Current fixture prerequisite failed.'}
$taskOs=Get-CimInstance Win32_OperatingSystem
$taskResource=@{status='OBSERVED_NOT_OOM_CAUSE_PROOF';checkedAt=[DateTime]::UtcNow.ToString('o');totalPhysicalKiB=[long]$taskOs.TotalVisibleMemorySize;freePhysicalKiB=[long]$taskOs.FreePhysicalMemory;totalVirtualKiB=[long]$taskOs.TotalVirtualMemorySize;freeVirtualKiB=[long]$taskOs.FreeVirtualMemory;previousRunnerAbsent=$true;signalsRequested=0;scope='Current aggregate resource snapshot only. Does not establish cause/resolution of earlier rendererOOM; no OS/process/user-profile change. One unchanged verification retry.'}
function Write-NewRetryJson([string]$Name,[object]$Value){$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 8)+[Environment]::NewLine);$taskHandle=[IO.File]::Open((Join-Path $PSScriptRoot $Name),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$taskHandle.Write($taskBytes,0,$taskBytes.Length)}finally{$taskHandle.Dispose()}}
Write-NewRetryJson 'unchanged-affected-resource-01.json' $taskResource
. (Join-Path $PSScriptRoot 'host-current-binding-01.ps1')
Assert-F22gEditorHost
$taskEntry=Join-Path $PSScriptRoot 'run-recovery-entry-01.ps1'
$taskStdout=Join-Path $PSScriptRoot 'durable-affected-01.stdout.txt';$taskStderr=Join-Path $PSScriptRoot 'durable-affected-01.stderr.txt'
$taskProcess=Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$taskEntry+'"')) -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr -PassThru
$taskReport=@{status='STARTED_NOT_VERIFIED';startedAt=[DateTime]::UtcNow.ToString('o');processId=$taskProcess.Id;entry=$taskEntry;entrySha256=(Get-FileHash -LiteralPath $taskEntry -Algorithm SHA256).Hash.ToLowerInvariant();stdout=$taskStdout;stderr=$taskStderr;completionReceipt='recovery-candidate03-run-01.txt.result.json';sourceInputs=25;signalsRequested=0;scope='ONE bounded unchanged candidate03/fixtures02 affected-suite retry after actual rendererOOM; no product/test/assertion/budget change, no fourth product improvement, no inferred PASS or wrapper exit.'}
Write-NewRetryJson 'durable-affected-start-01.json' $taskReport
$taskReport|ConvertTo-Json -Depth 8
