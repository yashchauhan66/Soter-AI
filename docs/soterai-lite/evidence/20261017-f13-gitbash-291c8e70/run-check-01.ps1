param([Parameter(Mandatory=$true)][string]$Name,[string[]]$Tests,[switch]$Typecheck)
$ErrorActionPreference='Stop'
if($Name -notmatch '^[a-z0-9-]+$'){throw 'Simple exclusive evidence name required.'}
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
$taskArgs=if($Typecheck){@('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')}else{@('--import','tsx','--test','--test-concurrency=1')+@($Tests|ForEach-Object {if($_ -notmatch '^[A-Za-z0-9-]+\.test\.ts$'){throw 'Test basename required.'};'packages/vscode-extension/src/__tests__/'+$_})}
& (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1') -FilePath node -ArgumentList $taskArgs -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
$taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
if($taskReceipt.exitCode -ne 0){throw ('F13 check failed; retained '+$Name)}
