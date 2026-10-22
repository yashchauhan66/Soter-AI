$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskEntry=Join-Path $PSScriptRoot 'run-final-entry-06.ps1'
$taskStdout=Join-Path $PSScriptRoot 'durable-final-01.stdout.txt'
$taskStderr=Join-Path $PSScriptRoot 'durable-final-01.stderr.txt'
$taskReportPath=Join-Path $PSScriptRoot 'durable-final-start-01.json'
foreach($taskName in @('full-tests-06.txt','full-tests-06.txt.result.json','backend-tests-03.txt','package-03.txt','final-gates-run-07.txt')){
 if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $taskName)){throw 'New serial run output already exists.'}
}
foreach($taskPath in @($taskStdout,$taskStderr,$taskReportPath)){if(Test-Path -LiteralPath $taskPath){throw 'Durable evidence target already exists.'}}
$taskFixture=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-fixture-validation-run-04.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskFixture.exitCode -ne 0){throw 'Current fixture prerequisite failed.'}
$taskProgress=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f22g-progress-05.json') -Raw -Encoding UTF8|ConvertFrom-Json
if(@($taskProgress.records).Count -ne 25){throw 'Frozen authored input count changed.'}
foreach($taskInput in $taskProgress.records){$taskFile=Join-Path $taskRepo $taskInput.path
 if((Get-Item -LiteralPath $taskFile).Length -ne $taskInput.bytes -or (Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInput.sha256){throw 'Frozen source changed.'}
}
. (Join-Path $PSScriptRoot 'host-current-binding-01.ps1')
Assert-F22gEditorHost
$taskProcess=Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$taskEntry+'"')) -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr -PassThru
$taskReport=@{status='STARTED_NOT_VERIFIED';startedAt=[DateTime]::UtcNow.ToString('o');processId=$taskProcess.Id;entry=$taskEntry;entrySha256=(Get-FileHash -LiteralPath $taskEntry -Algorithm SHA256).Hash.ToLowerInvariant();stdout=$taskStdout;stderr=$taskStderr;completionReceipt='final-gates-run-07.txt.result.json';sourceInputs=25;signalsRequested=0;scope='One unchanged-product serial full06/backend03/candidate03/editor04+affected03 pipeline. Hidden runner preserves receipts independently of chat. Actual completion and owned native closure are verified separately; no exit or result inferred from startup.'}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskReport|ConvertTo-Json -Depth 8)+[Environment]::NewLine)
$taskHandle=[IO.File]::Open($taskReportPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskHandle.Write($taskBytes,0,$taskBytes.Length)}finally{$taskHandle.Dispose()}
$taskReport|ConvertTo-Json -Depth 8
