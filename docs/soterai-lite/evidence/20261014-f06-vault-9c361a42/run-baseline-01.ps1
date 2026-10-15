$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
& (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1') -FilePath 'node' -ArgumentList @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/lite-vault-plan.test.ts') -OutputFile (Join-Path $PSScriptRoot 'plan-before-01.txt') -WorkingDirectory $taskRepo
