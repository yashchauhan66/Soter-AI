$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
& (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1') -FilePath 'node' -ArgumentList @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/checkedPowerShellSessionOwnership.test.ts') -OutputFile (Join-Path $PSScriptRoot 'ownership-recheck-01.txt') -WorkingDirectory $taskRepo
exit $LASTEXITCODE
