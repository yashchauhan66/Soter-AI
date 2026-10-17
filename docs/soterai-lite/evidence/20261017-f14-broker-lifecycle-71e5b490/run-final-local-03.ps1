$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
function Invoke-F14([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $Directory
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F14 gate failed; retained '+$Name)}
}
$taskTests=@('ownedBrokerLifecycle','ownedBrokerManager','ownedBrokerCli','brokerSessionBoundary','broker-autostart','mcp-canary-boundary','extension','automatic-ide-protection','readme-accuracy','brokerRoutingOwnership')|ForEach-Object{Join-Path $taskRepo ('packages/vscode-extension/src/__tests__/'+$_+'.test.ts')}
Invoke-F14 'final-focused-03' (@('--import','tsx','--test','--test-concurrency=1')+$taskTests)
Invoke-F14 'typecheck-05' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F14 'full-tests-03' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F14 'readiness-02' @('packages/vscode-extension/scripts/generate-readiness.mjs','--check')
Invoke-F14 'package-02' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f14-20261017-attempt02.vsix')
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f14-20261017-attempt02.vsix'
$taskSha=(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()
$taskRuntime=(Get-FileHash -LiteralPath (Join-Path $taskRepo 'packages/soterai-lite/dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()
& (Join-Path $PSScriptRoot 'inspect-vsix-01.ps1') -VsixPath $taskVsix -ExpectedVsixSha256 $taskSha -ExpectedBundleSha256 $taskRuntime -InspectionName 02
Invoke-F14 'host-build-02' @('docs/soterai-lite/evidence/20261017-f14-broker-lifecycle-71e5b490/build-native-hosts-01.cjs','prebuilt-native-hosts-02')
Write-Output ('F14 exact artifact '+$taskSha+' runtime '+$taskRuntime)
