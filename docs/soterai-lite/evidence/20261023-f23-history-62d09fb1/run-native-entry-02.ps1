$ErrorActionPreference='Stop'
$taskRunner=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'))
& $taskRunner -FilePath powershell -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'resume-native-gates-02.ps1')) -OutputFile (Join-Path $PSScriptRoot 'native-gates-02.txt')
exit $LASTEXITCODE
