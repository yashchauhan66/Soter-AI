$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath node -ArgumentList @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/vaultAppDescriptor.test.ts','packages/vscode-extension/src/__tests__/vaultAppJob.test.ts','packages/vscode-extension/src/__tests__/vaultAppJob.review.test.ts','packages/vscode-extension/src/__tests__/vaultRuntimeLease.test.ts','packages/vscode-extension/src/__tests__/vaultRuntimeCoordinator.test.ts','packages/vscode-extension/src/__tests__/vaultRuntimeSurfaces.test.ts','packages/vscode-extension/src/__tests__/vaultRuntimeOwnership.review.test.ts','packages/vscode-extension/src/__tests__/vaultRuntimePolicy.review.test.ts') -OutputFile (Join-Path $PSScriptRoot 'focused-after-03.txt') -WorkingDirectory $taskRepo
$taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'focused-after-03.txt.result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
exit $taskReceipt.exitCode
