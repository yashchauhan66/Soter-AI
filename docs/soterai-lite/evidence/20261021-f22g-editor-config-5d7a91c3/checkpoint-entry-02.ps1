$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
& (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1') -FilePath 'powershell' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'checkpoint-complete-02.ps1')) -OutputFile (Join-Path $PSScriptRoot 'checkpoint-complete-run-02.txt') -WorkingDirectory $taskRepo
exit $LASTEXITCODE
