$ErrorActionPreference='Stop'
$taskRecords=@()
$taskManifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'affected-native-template-manifest-04.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskFiles=@($taskManifest.records|ForEach-Object{Join-Path ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))) $_.target.path})
$taskFiles+=Join-Path $PSScriptRoot 'affected-native-binding-04.template.ps1'
foreach($taskName in @('inspect-vsix-02.ps1','artifact-binding-02.ps1','host-current-binding-03.ps1','precommit-launcher06-proposed.ps1.txt','post-full-check-entry-04.ps1')){$taskFiles+=Join-Path $PSScriptRoot $taskName}
foreach($taskFile in $taskFiles){
 $taskTokens=$null;$taskErrors=$null
 [void][Management.Automation.Language.Parser]::ParseFile($taskFile,[ref]$taskTokens,[ref]$taskErrors)
 if($taskErrors.Count -ne 0){throw ('Prepared helper PowerShell syntax failed: '+$taskFile+' '+($taskErrors|Out-String))}
 $taskRecords+=@{name=[IO.Path]::GetFileName($taskFile);bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant();parser='PowerShell Parser.ParseFile';errors=@();errorCount=0}
}
foreach($taskName in @('post-full04-contract.cjs','current-content-gate04.cjs','build-native-hosts-04.cjs','run-post-full-04.cjs','bind-post-full04-01.cjs','bind-content-host04-01.cjs','prepare-affected-current-04.cjs','prepare-affected-current-04b.cjs','prepare-precommit-launcher-06.cjs','precommit-startup-bootstrap-06.cjs','precommit-offline-owner-04.cjs')){
 $taskFile=Join-Path $PSScriptRoot $taskName
 & node --check $taskFile
 if($LASTEXITCODE -ne 0){throw ('Prepared helper CJS syntax failed: '+$taskName)}
 $taskRecords+=@{name=$taskName;bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant();parser='node --check';exitCode=0}
}
@{status='CURRENT04_HELPER_SYNTAX_PASS_NOT_NATIVE_EXECUTION';observedAt=[DateTime]::UtcNow.ToString('o');checks=$taskRecords;native06Authorized=$false;signalsRequested=0}|ConvertTo-Json -Depth 8|Out-File -LiteralPath (Join-Path $PSScriptRoot 'current04-helper-syntax-01.json') -Encoding utf8 -NoClobber
$taskCandidate=@($taskRecords|Where-Object{$_.name -ceq 'precommit-launcher06-proposed.ps1.txt'})[0]
@{status='SYNTAX_ONLY_PASS_PROPOSAL_NOT_AUTHORIZED_NOT_EXECUTED';observedAt=[DateTime]::UtcNow.ToString('o');candidate=@{path=('docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/'+$taskCandidate.name);bytes=$taskCandidate.bytes;sha256=$taskCandidate.sha256};parser='PowerShell Parser.ParseFile';errors=@();errorCount=0;nativeExecution='NOT_RUN'}|ConvertTo-Json -Depth 6|Out-File -LiteralPath (Join-Path $PSScriptRoot 'precommit-launcher06-syntax-01.json') -Encoding utf8 -NoClobber
Write-Output ('Actual syntax checks passed: '+$taskRecords.Count+'; native06 unauthorized/not run.')
