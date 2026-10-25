$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
foreach($taskName in @('full-gates-04','build-native-hosts-run-01','vsix-inspection-run-01','materialize-native-run-01')){
 $taskRaw=Join-Path $PSScriptRoot ($taskName+'.txt');$taskResult=Get-Content -LiteralPath ($taskRaw+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskRaw -Algorithm SHA256).Hash -ine $taskResult.sha256){throw 'Native prerequisite gate/integrity refused.'}
}
if(Get-Process -Id 16924 -ErrorAction SilentlyContinue){throw 'Build wrapper still observed; concurrent heavy execution refused.'}
$taskMaterialized=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-materialization-01.json') -Raw|ConvertFrom-Json
foreach($taskFile in $taskMaterialized.files){
 $taskPath=Join-Path $PSScriptRoot $taskFile.path
 if((Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash -ine $taskFile.sha256){throw 'Materialized native fixture bytes changed.'}
 $taskTokens=$null;$taskErrors=$null;[void][Management.Automation.Language.Parser]::ParseFile($taskPath,[ref]$taskTokens,[ref]$taskErrors)
 if($taskErrors.Count){throw 'Bound native PowerShell syntax refused.'}
}
& node (Join-Path $PSScriptRoot 'snapshot-native-inputs-01.cjs')
if($LASTEXITCODE -ne 0){throw 'Pre-native snapshot/input verification failed.'}
$taskEntry=Join-Path $PSScriptRoot 'run-native-entry-01.ps1'
$taskReceipt=Join-Path $PSScriptRoot 'durable-native-start-01.json'
$taskStdout=Join-Path $PSScriptRoot 'durable-native-stdout-01.txt'
$taskStderr=Join-Path $PSScriptRoot 'durable-native-stderr-01.txt'
foreach($taskPath in @($taskReceipt,$taskStdout,$taskStderr)){if(Test-Path -LiteralPath $taskPath){throw 'Existing owned native evidence refused.'}}
$taskProcess=Start-Process -FilePath powershell -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$taskEntry+'"')) -WindowStyle Hidden -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr -PassThru
$taskValue=@{status='STARTED_NOT_COMPLETED';pid=$taskProcess.Id;startedAt=$taskProcess.StartTime.ToUniversalTime().ToString('o');entry=$taskEntry;entrySha256=(Get-FileHash -LiteralPath $taskEntry -Algorithm SHA256).Hash.ToLowerInvariant();stdout=$taskStdout;stderr=$taskStderr;signalsRequested=0;scope='New exact F25VSIX isolated savedlogs/ownedoutputs/all20affected native families, thenfunctional/security; no success claim until actual results and closure'}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskValue|ConvertTo-Json -Depth 6)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskReceipt,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Depth 6
