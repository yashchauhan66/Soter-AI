$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
function Invoke-F12([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $Directory
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F12 gate failed; retained '+$Name)}
}
$taskTests=@(Get-ChildItem -LiteralPath (Join-Path $taskRepo 'packages/vscode-extension/src/__tests__') -File|Where-Object {$_.Name -match '^(cmd|checkedCmd|checkedPowerShell|powerShell51|checkedGitMetadata|managedOutputFilter).*\.test\.ts$'}|Sort-Object Name|ForEach-Object {$_.FullName})
Invoke-F12 'final-focused-01' (@('--import','tsx','--test','--test-concurrency=1')+$taskTests+@((Join-Path $taskRepo 'packages/vscode-extension/src/__tests__/extension.test.ts')))
Invoke-F12 'typecheck-03' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F12 'full-tests-01' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F12 'readiness-01' @('packages/vscode-extension/scripts/generate-readiness.mjs','--check')
Invoke-F12 'package-01' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f12-20261017-attempt01.vsix')
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f12-20261017-attempt01.vsix'
$taskSha=(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()
$taskRuntime=(Get-FileHash -LiteralPath (Join-Path $taskRepo 'packages/soterai-lite/dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()
& (Join-Path $PSScriptRoot 'inspect-vsix-01.ps1') -VsixPath $taskVsix -ExpectedVsixSha256 $taskSha -ExpectedBundleSha256 $taskRuntime -InspectionName 01
Invoke-F12 'host-build-01' @('docs/soterai-lite/evidence/20261017-f12-cmd-74b6d291/build-native-host-01.cjs','prebuilt-native-host-01')
Write-Output ('F12 exact artifact '+$taskSha+' runtime '+$taskRuntime)
