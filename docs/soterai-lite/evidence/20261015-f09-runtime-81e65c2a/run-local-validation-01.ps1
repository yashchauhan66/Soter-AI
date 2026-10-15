$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-LocalCheck([string]$Name,[string[]]$Arguments){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot $Name) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.result.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Local validation failed; retain results: '+$Name)}
}
Invoke-LocalCheck 'generate-readiness-01.txt' @('packages/vscode-extension/scripts/generate-readiness.mjs')
Invoke-LocalCheck 'typecheck-02.txt' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-LocalCheck 'prepare-native-fixture-01.txt' @('docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/prepare-native-fixture-01.cjs')
