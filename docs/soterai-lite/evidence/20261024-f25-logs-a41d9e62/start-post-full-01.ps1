$ErrorActionPreference='Stop'
$taskEntry=Join-Path $PSScriptRoot 'run-post-full-entry-01.ps1'
$taskStdout=Join-Path $PSScriptRoot 'durable-post-full-stdout-01.txt'
$taskStderr=Join-Path $PSScriptRoot 'durable-post-full-stderr-01.txt'
$taskStart=Join-Path $PSScriptRoot 'durable-post-full-start-01.json'
foreach($taskFile in @($taskStdout,$taskStderr,$taskStart)){if(Test-Path -LiteralPath $taskFile){throw 'Immutable post-full output already exists.'}}
$taskProcess=Start-Process -FilePath powershell -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$taskEntry+'"')) -WindowStyle Hidden -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr -PassThru
$taskValue=@{status='STARTED_WAITING_FOR_ACTUAL_CURRENT_FULL_GATE';pid=$taskProcess.Id;startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o');entry=$taskEntry;entrySha256=(Get-FileHash -LiteralPath $taskEntry -Algorithm SHA256).Hash.ToLowerInvariant();stdout=$taskStdout;stderr=$taskStderr;signalsRequested=0}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskValue|ConvertTo-Json -Depth 6)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskStart,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Depth 6
