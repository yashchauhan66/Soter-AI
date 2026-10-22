$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath 'node' -ArgumentList @((Join-Path $PSScriptRoot 'build-native-hosts-01.cjs')) -OutputFile (Join-Path $PSScriptRoot 'build-native-hosts-run-01.txt') -WorkingDirectory $taskRepo
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& $taskRunner -FilePath 'powershell' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'validate-host-fixtures-02.ps1')) -OutputFile (Join-Path $PSScriptRoot 'host-fixture-validation-run-01.txt') -WorkingDirectory $taskRepo
exit $LASTEXITCODE
