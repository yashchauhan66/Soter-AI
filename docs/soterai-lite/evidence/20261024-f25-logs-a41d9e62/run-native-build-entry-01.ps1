$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
& (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1') -FilePath node -ArgumentList @((Join-Path $PSScriptRoot 'build-native-hosts-01.cjs'),'prebuilt-native-hosts-01') -OutputFile (Join-Path $PSScriptRoot 'build-native-hosts-run-01.txt') -WorkingDirectory $taskRepo
exit $LASTEXITCODE
