$ErrorActionPreference='Stop'
$taskRepo=(Get-Location).Path
$taskDir=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7'
foreach($taskName in @('storage-serial-owner-09.json','storage-serial-stdout-09.txt','storage-serial-stderr-09.txt','storage-serial-start-09.json')){if(Test-Path -LiteralPath (Join-Path $taskDir $taskName)){throw 'Serial09 already exists; no automatic retry'}}
$taskScript=Join-Path $taskDir 'run-storage-fix-serial-09.cjs'
$taskProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('"'+$taskScript+'"') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskDir 'storage-serial-stdout-09.txt') -RedirectStandardError (Join-Path $taskDir 'storage-serial-stderr-09.txt') -PassThru
$taskReceipt=[ordered]@{status='CURRENT_STORAGE_FIX_SERIAL_STARTED_NOT_COMPLETED';pid=$taskProcess.Id;observedAt=[DateTime]::UtcNow.ToString('o');script=$taskScript;signalsRequested=0;automaticRetry=$false;native08='NOT_AUTHORIZED_NOT_RUN'}
$taskReceipt|ConvertTo-Json -Depth 5|Out-File -LiteralPath (Join-Path $taskDir 'storage-serial-owner-09.json') -Encoding utf8 -NoClobber
$taskReceipt|ConvertTo-Json -Compress
