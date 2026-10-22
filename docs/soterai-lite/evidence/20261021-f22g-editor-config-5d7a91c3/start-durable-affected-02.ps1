$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
foreach($taskName in @('current-affected-suite-run-05.txt','resumed-candidate03-run-01.txt','durable-affected-02.stdout.txt','durable-affected-02.stderr.txt','durable-affected-start-02.json','resume-resource-at-start-01.json')){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $taskName)){throw 'Resume evidence target already exists.'}}
$taskFixture=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-fixture-validation-run-06.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskFixture.exitCode -ne 0){throw 'Current prepared fixture validation missing.'}
$taskBasis=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'resume-basis-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskBasis.parent -cne 'a7292856b599e5243fdb8f74569823fe840e7fe7' -or $taskBasis.boundedNativeRetry -ne 1){throw 'Explicit unchanged resume basis required.'}
$taskOs=Get-CimInstance Win32_OperatingSystem
$taskOld=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'unchanged-affected-resource-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if([long]$taskOs.FreeVirtualMemory -le [long]$taskOld.freeVirtualKiB){throw 'Prior low availability recurred; unchanged resume withheld.'}
function Write-NewResumeJson([string]$Name,[object]$Value){$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 8)+[Environment]::NewLine);$taskHandle=[IO.File]::Open((Join-Path $PSScriptRoot $Name),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$taskHandle.Write($taskBytes,0,$taskBytes.Length)}finally{$taskHandle.Dispose()}}
Write-NewResumeJson 'resume-resource-at-start-01.json' @{status='OBSERVED_NOT_OOM_RESOLUTION_PROOF';checkedAt=[DateTime]::UtcNow.ToString('o');freePhysicalKiB=[long]$taskOs.FreePhysicalMemory;freeVirtualKiB=[long]$taskOs.FreeVirtualMemory;priorFreeVirtualKiB=[long]$taskOld.freeVirtualKiB;signalsRequested=0;osChanges=0}
. (Join-Path $PSScriptRoot 'host-current-binding-01.ps1')
Assert-F22gEditorHost
$taskEntry=Join-Path $PSScriptRoot 'run-resume-entry-01.ps1';$taskStdout=Join-Path $PSScriptRoot 'durable-affected-02.stdout.txt';$taskStderr=Join-Path $PSScriptRoot 'durable-affected-02.stderr.txt'
$taskProcess=Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$taskEntry+'"')) -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr -PassThru
$taskReport=@{status='STARTED_NOT_VERIFIED';startedAt=[DateTime]::UtcNow.ToString('o');processId=$taskProcess.Id;entry=$taskEntry;entrySha256=(Get-FileHash -LiteralPath $taskEntry -Algorithm SHA256).Hash.ToLowerInvariant();stdout=$taskStdout;stderr=$taskStderr;completionReceipt='resumed-candidate03-run-01.txt.result.json';parentCheckpoint=$taskBasis.parent;sourceInputs=25;signalsRequested=0;scope='One unchanged candidate03 affected-suite05 resume after measured external resource increase. Same source/tests/driver03/launchers02/assertions/flags/budgets; no fourth product improvement or earlier failure regrade.'}
Write-NewResumeJson 'durable-affected-start-02.json' $taskReport
$taskReport|ConvertTo-Json -Depth 8
