$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath node -ArgumentList @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit') -OutputFile (Join-Path $PSScriptRoot 'compiler-07.txt') -WorkingDirectory $taskRepo
$taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'compiler-07.txt.result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($taskReceipt.exitCode -ne 0){throw 'Current compiler failed; no combined execution.'}
$taskCases=@('preCommitOwnerClient.integration','preCommitClientDeadline.review','ownerHookProtocol','ownerHookEnvironment','checkedOwnerHookContext','ownerHookGitProcess','ownerHookDiscovery','encryptedBackupScope.review','brokerRoutingOwnership','preCommitProtocol','preCommitSizes','preCommitScan','preCommitGitProcess','preCommitFinalGuard.review','hookIndexSnapshot','checkedHookIndex','preCommitHookText','preCommitWire','stagedContent','stagedContentPublicContext.review','preCommitOwnerService','preCommitOwnerLifecycle.review','preCommitClient','hygieneAnalysis','sourceSecretPlan','containerSecretPlan','terraformSecretPlan','registrySecretPlan','serviceAccountSecretPlan','ciSecretPlan','editorSecretPlan','mcpSecretPlan')
$taskArgs=@('--import','tsx','--test','--test-concurrency=1')+@($taskCases|ForEach-Object {'../vscode-extension/src/__tests__/'+$_+'.test.ts'})
& $taskRunner -FilePath node -ArgumentList $taskArgs -OutputFile (Join-Path $PSScriptRoot 'components-combined-07.txt') -WorkingDirectory (Join-Path $taskRepo 'packages/soterai-lite')
$taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'components-combined-07.txt.result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($taskReceipt.exitCode -ne 0){throw 'Current combined failed; inspect retained output.'}
