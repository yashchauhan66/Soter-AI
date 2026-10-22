$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
. (Join-Path $PSScriptRoot 'host-current-binding-01.ps1')
Assert-F22gEditorHost
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath 'node' -ArgumentList @((Join-Path $PSScriptRoot 'build-native-hosts-02.cjs'),'prebuilt-native-hosts-03') -OutputFile (Join-Path $PSScriptRoot 'build-native-hosts-run-03.txt') -WorkingDirectory $taskRepo
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& $taskRunner -FilePath 'powershell' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'validate-host-fixtures-05.ps1')) -OutputFile (Join-Path $PSScriptRoot 'host-fixture-validation-run-03.txt') -WorkingDirectory $taskRepo
exit $LASTEXITCODE
