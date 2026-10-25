$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
foreach($taskName in @('full-tests-03','backend-typecheck-01','backend-tests-01','package-01','full-gates-04')){
 $taskRaw=Join-Path $PSScriptRoot ($taskName+'.txt')
 $taskResult=Get-Content -LiteralPath ($taskRaw+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskRaw -Algorithm SHA256).Hash -ine $taskResult.sha256){throw 'Current serial gate failed/integrity mismatch; native build refused.'}
}
if(Get-Process -Id 944 -ErrorAction SilentlyContinue){throw 'Full serial wrapper still observed; heavyweight concurrency refused.'}
& node (Join-Path $PSScriptRoot 'check-full-inputs-04.cjs')
if($LASTEXITCODE -ne 0){throw 'Current source inputs changed.'}
$taskEntry=Join-Path $PSScriptRoot 'run-native-build-entry-01.ps1'
$taskReceipt=Join-Path $PSScriptRoot 'durable-native-build-start-01.json'
$taskStdout=Join-Path $PSScriptRoot 'durable-native-build-stdout-01.txt'
$taskStderr=Join-Path $PSScriptRoot 'durable-native-build-stderr-01.txt'
foreach($taskPath in @($taskReceipt,$taskStdout,$taskStderr)){if(Test-Path -LiteralPath $taskPath){throw 'Existing owned build evidence refused.'}}
$taskProcess=Start-Process -FilePath powershell -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$taskEntry+'"')) -WindowStyle Hidden -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr -PassThru
$taskValue=@{status='STARTED_NOT_COMPLETED';pid=$taskProcess.Id;startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o');entry=$taskEntry;entrySha256=(Get-FileHash -LiteralPath $taskEntry -Algorithm SHA256).Hash.ToLowerInvariant();stdout=$taskStdout;stderr=$taskStderr;signalsRequested=0;scope='Combined actual final934-input TypeScript compiler plus20native-driver build, no Code/native launch'}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskValue|ConvertTo-Json -Depth 6)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskReceipt,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Depth 6
