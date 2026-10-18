$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
function Invoke-F15h([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $Directory
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F15h gate failed; retained '+$Name)}
}
$taskTests=@('gatewayBase64Decoder','gatewayBase64Wire','gatewayMultipartDecoder','gatewayMultipartWire','gatewayFramedDecoder','gatewayFramedWire','gatewayChunkedHeaders','gatewayChunkedWire','gatewayDeflateDecoder','gatewayDeflateWire','gatewayBrotliDecoder','gatewayBrotliWire','gatewayGzipDecoder','gatewayGzipWire','gatewayJsonDecoder','gatewayJsonWire','ownedBrokerLifecycle','ownedBrokerManager','ownedBrokerCli','brokerSessionBoundary','broker-autostart','mcp-canary-boundary','extension','automatic-ide-protection','readme-accuracy','brokerRoutingOwnership')|ForEach-Object{Join-Path $taskRepo ('packages/vscode-extension/src/__tests__/'+$_+'.test.ts')}
Invoke-F15h 'typecheck-01' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F15h 'focused-01' (@('--import','tsx','--test','--test-concurrency=1')+$taskTests)
Invoke-F15h 'broker-typecheck-01' @('node_modules/typescript/bin/tsc','-p','apps/local-ai-broker/tsconfig.json','--noEmit')
Invoke-F15h 'broker-tests-01' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/**/*.test.ts')
Invoke-F15h 'full-tests-01' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F15h 'readiness-01' @('packages/vscode-extension/scripts/generate-readiness.mjs','--check')
Invoke-F15h 'package-01' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f15h-20261018-attempt01.vsix')
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f15h-20261018-attempt01.vsix'
$taskSha=(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()
$taskRuntime=(Get-FileHash -LiteralPath (Join-Path $taskRepo 'packages/soterai-lite/dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()
& (Join-Path $PSScriptRoot 'inspect-vsix-01.ps1') -VsixPath $taskVsix -ExpectedVsixSha256 $taskSha -ExpectedBundleSha256 $taskRuntime -InspectionName 01
Invoke-F15h 'host-build-01' @('docs/soterai-lite/evidence/20261018-f15h-base64-8b7d260e/build-native-hosts-01.cjs','prebuilt-native-hosts-01')
Write-Output ('F15h exact artifact '+$taskSha+' runtime '+$taskRuntime)
