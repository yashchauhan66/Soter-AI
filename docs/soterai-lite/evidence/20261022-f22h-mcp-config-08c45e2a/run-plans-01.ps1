param([Parameter(Mandatory=$true)][string]$EvidenceName)
$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
$taskArgs=@('--import','tsx','--test','--test-concurrency=1')
foreach($taskName in @('mcpSecretPlan','editorSecretPlan','editorSecretPlanReview','editorSecretPlanBundle')){$taskArgs+=('packages/vscode-extension/src/__tests__/'+$taskName+'.test.ts')}
& (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1') -FilePath 'node' -ArgumentList $taskArgs -OutputFile (Join-Path $PSScriptRoot $EvidenceName) -WorkingDirectory $taskRepo
exit $LASTEXITCODE
