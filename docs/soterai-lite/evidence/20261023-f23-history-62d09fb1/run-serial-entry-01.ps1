$ErrorActionPreference='Stop'
$taskRunner=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'))
& $taskRunner -FilePath powershell -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-serial-gates-01.ps1')) -OutputFile (Join-Path $PSScriptRoot 'serial-gates-01.txt')
exit $LASTEXITCODE
