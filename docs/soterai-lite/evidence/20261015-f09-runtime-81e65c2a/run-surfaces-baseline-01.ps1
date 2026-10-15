$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath node -ArgumentList @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/vaultRuntimeSurfaces.test.ts') -OutputFile (Join-Path $PSScriptRoot 'surfaces-before-01.txt') -WorkingDirectory $taskRepo
$taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'surfaces-before-01.txt.result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
exit $taskReceipt.exitCode
