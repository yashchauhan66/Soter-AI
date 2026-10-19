$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$env:TEMP=(Join-Path 'D:\SoterAI-Lite-test-profiles' ('f20a-unit-'+[Guid]::NewGuid().ToString('N')));$env:TMP=$env:TEMP;[void][IO.Directory]::CreateDirectory($env:TEMP)
function Invoke-F20ASuite([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $Directory|Out-Null
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw|ConvertFrom-Json
 Write-Output ($Name+' exit='+$taskResult.exitCode)
 if($taskResult.exitCode -ne 0){throw ('F20A suite failed: '+$Name)}
}
Invoke-F20ASuite 'broker-typecheck-01' @('node_modules/typescript/bin/tsc','-p','apps/local-ai-broker/tsconfig.json','--noEmit')
Invoke-F20ASuite 'broker-tests-01' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts')
Invoke-F20ASuite 'full-tests-01' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F20ASuite 'readiness-01' @('packages/vscode-extension/scripts/generate-readiness.mjs','--check')
