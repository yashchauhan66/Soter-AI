$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath node -ArgumentList @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/preCommitOwnerClient.integration.test.ts') -OutputFile (Join-Path $PSScriptRoot 'owner-client-integration-01.txt') -WorkingDirectory (Join-Path $taskRepo 'packages/soterai-lite')
