$ErrorActionPreference='Stop'
$taskReceipt=Join-Path $PSScriptRoot 'durable-native-start-01.json'
if(Test-Path -LiteralPath $taskReceipt){throw 'Existing start receipt refused.'}
$taskEntry=Join-Path $PSScriptRoot 'run-native-entry-01.ps1'
$taskStdout=Join-Path $PSScriptRoot 'durable-native-stdout-01.txt'
$taskStderr=Join-Path $PSScriptRoot 'durable-native-stderr-01.txt'
foreach($taskPath in @($taskStdout,$taskStderr)){if(Test-Path -LiteralPath $taskPath){throw 'Existing stream refused.'}}
$taskProcess=Start-Process -FilePath powershell -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$taskEntry+'"')) -WindowStyle Hidden -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr -PassThru
$taskValue=@{status='STARTED_NOT_COMPLETED';pid=$taskProcess.Id;startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o');entry=$taskEntry;entrySha256=(Get-FileHash -LiteralPath $taskEntry -Algorithm SHA256).Hash.ToLowerInvariant();stdout=$taskStdout;stderr=$taskStderr;signalsRequested=0}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskValue|ConvertTo-Json -Depth 6)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskReceipt,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Depth 6
