$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath node -ArgumentList @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit') -OutputFile (Join-Path $PSScriptRoot 'typecheck-01.txt') -WorkingDirectory $taskRepo
$taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'typecheck-01.txt.result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
exit $taskReceipt.exitCode
