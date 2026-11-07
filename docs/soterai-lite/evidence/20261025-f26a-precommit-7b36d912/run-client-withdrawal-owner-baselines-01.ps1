$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath node -ArgumentList @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/preCommitClient.test.ts','../vscode-extension/src/__tests__/preCommitOwnerClient.integration.test.ts','../vscode-extension/src/__tests__/preCommitClientDeadline.review.test.ts') -OutputFile (Join-Path $PSScriptRoot 'client-withdrawal-tests-01.txt') -WorkingDirectory (Join-Path $taskRepo 'packages/soterai-lite')
$taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'client-withdrawal-tests-01.txt.result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($taskReceipt.exitCode -ne 0){throw 'Client current tests failed; no owner helper baseline execution.'}
& $taskRunner -FilePath node -ArgumentList @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/ownerHookProtocol.test.ts','../vscode-extension/src/__tests__/ownerHookEnvironment.test.ts') -OutputFile (Join-Path $PSScriptRoot 'owner-hook-protocol-baseline-01.txt') -WorkingDirectory (Join-Path $taskRepo 'packages/soterai-lite')
