$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRevision=(& git rev-parse HEAD).Trim();if($LASTEXITCODE -ne 0){throw 'Transition revision unavailable.'}
$taskSource=(& git rev-parse HEAD^).Trim();if($LASTEXITCODE -ne 0){throw 'Source parent unavailable.'}
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath node -ArgumentList @('docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/verify-transition-01.cjs',$taskRevision,$taskSource,'04157b046e5c01e111e5ef5830a4998c06085a85c14566af9bce5c9704c20bba') -OutputFile (Join-Path $PSScriptRoot 'f09-transition-verification-launch-01.txt') -WorkingDirectory $taskRepo
$taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f09-transition-verification-launch-01.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
exit $taskResult.exitCode
