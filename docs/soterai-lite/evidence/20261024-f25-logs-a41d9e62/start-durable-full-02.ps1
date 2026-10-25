$ErrorActionPreference='Stop'
$taskExisting=@(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='powershell.exe'" | Where-Object {
 $_.ProcessId -ne $PID -and $_.CommandLine -and ($_.CommandLine.Contains('run-full-gates-01.ps1') -or ($_.Name -eq 'node.exe' -and $_.CommandLine.Contains('--test-concurrency=1') -and $_.CommandLine.Contains('../vscode-extension/src/__tests__/**/*.test.ts')))
})
if($taskExisting.Count -ne 0){throw 'Prior full batch still observed; do not launch duplicate.'}
& node (Join-Path $PSScriptRoot 'check-full-inputs-01.cjs')
if($LASTEXITCODE -ne 0){throw 'Frozen full inputs drifted.'}
$taskReceipt=Join-Path $PSScriptRoot 'durable-full-start-02.json'
if(Test-Path -LiteralPath $taskReceipt){throw 'Existing start receipt refused.'}
$taskEntry=Join-Path $PSScriptRoot 'run-full-entry-02.ps1'
$taskStdout=Join-Path $PSScriptRoot 'durable-full-stdout-02.txt'
$taskStderr=Join-Path $PSScriptRoot 'durable-full-stderr-02.txt'
foreach($taskPath in @($taskStdout,$taskStderr)){if(Test-Path -LiteralPath $taskPath){throw 'Existing stream refused.'}}
$taskProcess=Start-Process -FilePath powershell -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$taskEntry+'"')) -WindowStyle Hidden -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr -PassThru
$taskValue=@{status='STARTED_NOT_COMPLETED';pid=$taskProcess.Id;startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o');entry=$taskEntry;entrySha256=(Get-FileHash -LiteralPath $taskEntry -Algorithm SHA256).Hash.ToLowerInvariant();stdout=$taskStdout;stderr=$taskStderr;signalsRequested=0}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskValue|ConvertTo-Json -Depth 6)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskReceipt,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Depth 6
