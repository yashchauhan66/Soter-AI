$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
function Invoke-F15f([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $Directory
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F15f gate failed; retained '+$Name)}
}
$taskTests=@('gatewayFramedDecoder','gatewayFramedWire','gatewayChunkedHeaders','gatewayChunkedWire','gatewayDeflateDecoder','gatewayDeflateWire','gatewayBrotliDecoder','gatewayBrotliWire','gatewayGzipDecoder','gatewayGzipWire','gatewayJsonDecoder','gatewayJsonWire','ownedBrokerLifecycle','ownedBrokerManager','ownedBrokerCli','brokerSessionBoundary','broker-autostart','mcp-canary-boundary','extension','automatic-ide-protection','readme-accuracy','brokerRoutingOwnership')|ForEach-Object{Join-Path $taskRepo ('packages/vscode-extension/src/__tests__/'+$_+'.test.ts')}
Invoke-F15f 'typecheck-01' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F15f 'focused-01' (@('--import','tsx','--test','--test-concurrency=1')+$taskTests)
Invoke-F15f 'broker-typecheck-01' @('node_modules/typescript/bin/tsc','-p','apps/local-ai-broker/tsconfig.json','--noEmit')
Invoke-F15f 'broker-tests-01' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/**/*.test.ts')
Invoke-F15f 'full-tests-01' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F15f 'readiness-01' @('packages/vscode-extension/scripts/generate-readiness.mjs','--check')
Invoke-F15f 'package-01' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f15f-20261018-attempt01.vsix')
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f15f-20261018-attempt01.vsix'
$taskSha=(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()
$taskRuntime=(Get-FileHash -LiteralPath (Join-Path $taskRepo 'packages/soterai-lite/dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()
& (Join-Path $PSScriptRoot 'inspect-vsix-01.ps1') -VsixPath $taskVsix -ExpectedVsixSha256 $taskSha -ExpectedBundleSha256 $taskRuntime -InspectionName 01
Invoke-F15f 'host-build-01' @('docs/soterai-lite/evidence/20261018-f15f-framed-73d9b102/build-native-hosts-01.cjs','prebuilt-native-hosts-01')
Write-Output ('F15f exact artifact '+$taskSha+' runtime '+$taskRuntime)
