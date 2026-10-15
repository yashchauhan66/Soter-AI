$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRevision=(& git rev-parse HEAD).Trim();if($LASTEXITCODE -ne 0){throw 'Source revision unavailable.'}
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath node -ArgumentList @('docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/verify-and-advance.cjs',$taskRevision,'04157b046e5c01e111e5ef5830a4998c06085a85c14566af9bce5c9704c20bba','f09-commit-01.txt') -OutputFile (Join-Path $PSScriptRoot 'f09-byte-verification-launch-01.txt') -WorkingDirectory $taskRepo
$taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f09-byte-verification-launch-01.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
exit $taskResult.exitCode
