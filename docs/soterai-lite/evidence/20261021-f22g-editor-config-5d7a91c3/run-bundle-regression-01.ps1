param([Parameter(Mandatory=$true)][string]$EvidenceName)
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
& (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1') -FilePath 'node' -ArgumentList @('--import','tsx','--test','packages/vscode-extension/src/__tests__/editorSecretPlanBundle.test.ts') -OutputFile (Join-Path $PSScriptRoot $EvidenceName) -WorkingDirectory $taskRepo
exit $LASTEXITCODE
