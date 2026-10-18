$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath node -ArgumentList @((Join-Path $PSScriptRoot 'build-native-hosts-01.cjs'),'prebuilt-native-hosts-02') -OutputFile (Join-Path $PSScriptRoot 'host-build-02.txt') -WorkingDirectory $taskRepo
$taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-build-02.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskResult.exitCode -ne 0){throw 'Current fixture compiler/native probe build failed.'}
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run-hosts-02.ps1')
if($LASTEXITCODE -ne 0){throw 'Native/affected checks incomplete; closure withheld.'}
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'close-card-01.ps1')
if($LASTEXITCODE -ne 0){throw 'Serial byte barriers incomplete; next production withheld.'}
