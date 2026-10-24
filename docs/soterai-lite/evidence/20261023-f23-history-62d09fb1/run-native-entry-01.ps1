$ErrorActionPreference='Stop'
$taskRunner=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'))
& $taskRunner -FilePath powershell -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'complete-candidate01-01.ps1')) -OutputFile (Join-Path $PSScriptRoot 'native-gates-01.txt')
exit $LASTEXITCODE
