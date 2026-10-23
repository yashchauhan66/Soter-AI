param([Parameter(Mandatory=$true)][string]$EvidenceName)
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskTests=@('mcpSecretPlanReview','mcpSecretPlan','mcpScanner','mcpScannerCommands','ciSecretPlan','ciScanner','ciScannerCommands','serviceAccountSecretPlan','serviceAccountScanner','serviceAccountScannerCommands','registrySecretPlan','registryScanner','registryScannerCommands','terraformSecretPlan','terraformScanner','terraformScannerCommands','containerSecretPlan','containerScanner','containerScannerCommands','sourceSecretPlan','sourceScanner','sourceScannerCommands','hygieneAnalysis','hygieneController','hygieneCommands','hygieneExposureLedger','hygieneVaultSnapshot','lite-vault-plan','lite-vault-manager','editorSecretPlan','editorScanner','editorScannerCommands','editorSecretPlanReview','editorSecretPlanBundle')
$taskArgs=@('--import','tsx','--test','--test-concurrency=1')
foreach($taskName in $taskTests){$taskPath='packages/vscode-extension/src/__tests__/'+$taskName+'.test.ts';if(-not(Test-Path -LiteralPath (Join-Path $taskRepo $taskPath))){throw ('Explicit focused input missing: '+$taskPath)};$taskArgs+=$taskPath}
& (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1') -FilePath 'node' -ArgumentList $taskArgs -OutputFile (Join-Path $PSScriptRoot $EvidenceName) -WorkingDirectory $taskRepo
exit $LASTEXITCODE
