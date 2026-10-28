$ErrorActionPreference='Stop'
$taskRepo=(Get-Location).Path
$taskEvidence=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7'
$taskOwner=Join-Path $taskEvidence 'preparation-owner-01.json'
$taskOut=Join-Path $taskEvidence 'preparation-stdout-01.txt'
$taskErr=Join-Path $taskEvidence 'preparation-stderr-01.txt'
foreach($taskFile in @($taskOwner,$taskOut,$taskErr)){if(Test-Path -LiteralPath $taskFile){throw 'Existing preparation evidence refuses duplicate launch'}}
$taskScript=Join-Path $taskEvidence 'run-preparation-01.cjs'
$taskProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('"'+$taskScript+'"') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
$taskValue=[ordered]@{status='CURRENT_F26A_OFFLINE_PREPARATION_STARTED_NATIVE06_USER_DEFERRED';pid=$taskProcess.Id;observedAt=[DateTime]::UtcNow.ToString('o');script=$taskScript;stdout=$taskOut;stderr=$taskErr;signalsRequested=0;native06='USER_DEFERRED_NOT_RUN'}
$taskStream=[IO.File]::Open($taskOwner,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
try{$taskBytes=[Text.Encoding]::UTF8.GetBytes(($taskValue|ConvertTo-Json -Depth 4));$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Compress
