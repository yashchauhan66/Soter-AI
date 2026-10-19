$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath node -ArgumentList @('--import','tsx',(Join-Path $PSScriptRoot 'test-generated-hook-04.ts'),(Join-Path $PSScriptRoot 'generated-hook-final-01.json')) -OutputFile (Join-Path $PSScriptRoot 'generated-hook-final-01.txt') -WorkingDirectory $taskRepo
if((Get-Content -LiteralPath (Join-Path $PSScriptRoot 'generated-hook-final-01.txt.result.json') -Raw|ConvertFrom-Json).exitCode -ne 0){throw 'Final generated hook check failed'}
