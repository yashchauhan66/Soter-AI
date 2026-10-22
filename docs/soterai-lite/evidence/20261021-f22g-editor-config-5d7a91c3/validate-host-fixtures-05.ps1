$ErrorActionPreference='Stop'
$taskInputFile=Join-Path $PSScriptRoot 'host-fixture-inputs-04.json'
$taskInputs=Get-Content -LiteralPath $taskInputFile -Raw -Encoding UTF8|ConvertFrom-Json
$taskRows=@()
foreach($taskRecord in $taskInputs.records){
 $taskFile=Join-Path $PSScriptRoot $taskRecord.path
 if((Get-Item -LiteralPath $taskFile).Length -ne $taskRecord.bytes -or (Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskRecord.sha256){throw 'Prepared fixture input changed.'}
 if([IO.Path]::GetExtension($taskFile) -ceq '.ps1'){
  $taskTokens=$null;$taskErrors=$null
  [void][Management.Automation.Language.Parser]::ParseFile($taskFile,[ref]$taskTokens,[ref]$taskErrors)
  if(@($taskErrors).Count -ne 0){throw 'Fixture PowerShell syntax refused.'}
  $taskText=[IO.File]::ReadAllText($taskFile)
  if($taskText -match '\bStop-Process\b|\btaskkill\b|\.Kill\s*\('){throw 'Process signal operation refused.'}
  $taskRows+=@{path=$taskRecord.path;sha256=$taskRecord.sha256;parseErrors=0;processSignalOperations=0}
 }
}
if($taskRows.Count -ne 19){throw 'Unexpected fixture helper count.'}
$taskCompiled=@()
foreach($taskName in @('lite-editor-host.js','lite-ci-host.js','lite-service-account-host.js','lite-registry-host.js','lite-terraform-host.js','lite-container-host.js','lite-source-host.js','lite-hygiene-host.js','lite-vault-host.js','lite-broker-host.js')){
 $taskFile=Join-Path $PSScriptRoot ('prebuilt-native-hosts-03/'+$taskName)
 $taskCompiled+=@{name=$taskName;bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$taskCompiler=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'build-native-hosts-run-03.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskCompiler.exitCode -ne 0){throw 'Current fixture compiler/build incomplete.'}
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$taskVersion=([Diagnostics.FileVersionInfo]::GetVersionInfo($taskCode)).ProductVersion
if($taskVersion -cne '1.143.0'){throw 'Installed editor version changed; review required.'}
$taskReport=@{status='PASS_PRELAUNCH_FIXTURE_VALIDATION';scripts=$taskRows;compiled=$taskCompiled;codeVersion=$taskVersion;codeSha256=(Get-FileHash -LiteralPath $taskCode -Algorithm SHA256).Hash.ToLowerInvariant();launchedHosts=0;signalsRequested=0}
$taskPath=Join-Path $PSScriptRoot 'host-fixture-validation-03.json'
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskReport|ConvertTo-Json -Depth 12)+[Environment]::NewLine)
$taskHandle=[IO.File]::Open($taskPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskHandle.Write($taskBytes,0,$taskBytes.Length)}finally{$taskHandle.Dispose()}
$taskReport|ConvertTo-Json -Depth 12
