$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
. (Join-Path $PSScriptRoot 'host-current-binding-02.ps1')
Assert-F22hEditorHost
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath 'powershell' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'validate-host-fixtures-03.ps1')) -OutputFile (Join-Path $PSScriptRoot 'host-fixture-validation-run-03.txt') -WorkingDirectory $taskRepo
exit $LASTEXITCODE
