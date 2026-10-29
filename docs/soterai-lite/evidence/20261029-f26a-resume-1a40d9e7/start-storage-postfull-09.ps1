$ErrorActionPreference='Stop'
$taskRepo=(Get-Location).Path
$taskDir=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7'
foreach($taskName in @('storage-postfull-owner-09.json','storage-postfull-stdout-09.txt','storage-postfull-stderr-09.txt','storage-postfull-start-09.json')){if(Test-Path -LiteralPath (Join-Path $taskDir $taskName)){throw 'Existing postfull09 owner; no automatic retry'}}
$taskScript=Join-Path $taskDir 'run-storage-postfull-09.cjs'
$taskProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('"'+$taskScript+'"') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskDir 'storage-postfull-stdout-09.txt') -RedirectStandardError (Join-Path $taskDir 'storage-postfull-stderr-09.txt') -PassThru
$taskReceipt=[ordered]@{status='ONE_SHOT_POSTFULL08_WAITING_NOT_COMPLETED';pid=$taskProcess.Id;observedAt=[DateTime]::UtcNow.ToString('o');script=$taskScript;signalsRequested=0;native08='NOT_AUTHORIZED_NOT_RUN'}
$taskReceipt|ConvertTo-Json -Depth 4|Out-File -LiteralPath (Join-Path $taskDir 'storage-postfull-owner-09.json') -Encoding utf8 -NoClobber
$taskReceipt|ConvertTo-Json -Compress
