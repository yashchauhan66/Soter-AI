$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
function Invoke-F16([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $Directory
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F16 gate failed; retained '+$Name)}
}
$taskTests=@('gatewayPolicyBoundary','gatewayPolicyWire','gatewayPolicyManager','gatewayPrivateIpc','gatewayVaultRegistry','registeredSecretMatcher','registeredSecretMatcher.review','streamingOutputRedactor','streamingOutputRedactor.review','streamingOutputIntegration','managedOutputFilter','managedOutputFilterReview','gatewayBase64Decoder','gatewayBase64Wire','gatewayMultipartDecoder','gatewayMultipartWire','gatewayFramedDecoder','gatewayFramedWire','gatewayChunkedHeaders','gatewayChunkedWire','gatewayDeflateDecoder','gatewayDeflateWire','gatewayBrotliDecoder','gatewayBrotliWire','gatewayGzipDecoder','gatewayGzipWire','gatewayJsonDecoder','gatewayJsonWire','ownedBrokerLifecycle','ownedBrokerManager','ownedBrokerCli','brokerSessionBoundary','broker-autostart','mcp-canary-boundary','extension','automatic-ide-protection','readme-accuracy','brokerRoutingOwnership')|ForEach-Object{Join-Path $taskRepo ('packages/vscode-extension/src/__tests__/'+$_+'.test.ts')}
Invoke-F16 'typecheck-05' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F16 'focused-02' (@('--import','tsx','--test','--test-concurrency=1')+$taskTests)
Invoke-F16 'broker-typecheck-05' @('node_modules/typescript/bin/tsc','-p','apps/local-ai-broker/tsconfig.json','--noEmit')
Invoke-F16 'standalone-build-01' @('apps/local-ai-broker/scripts/build.cjs')
Invoke-F16 'standalone-cli-01' @('docs/soterai-lite/evidence/20261018-f16-gateway-policy-6e9a31d4/check-built-cli-01.cjs')
Invoke-F16 'full-tests-03' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F16 'readiness-01' @('packages/vscode-extension/scripts/generate-readiness.mjs','--check')
Invoke-F16 'package-01' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f16-20261018-attempt01.vsix')
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f16-20261018-attempt01.vsix'
$taskSha=(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()
$taskRuntime=(Get-FileHash -LiteralPath (Join-Path $taskRepo 'packages/soterai-lite/dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()
& (Join-Path $PSScriptRoot 'inspect-vsix-01.ps1') -VsixPath $taskVsix -ExpectedVsixSha256 $taskSha -ExpectedBundleSha256 $taskRuntime -InspectionName 01
Invoke-F16 'host-build-01' @('docs/soterai-lite/evidence/20261018-f16-gateway-policy-6e9a31d4/build-native-hosts-01.cjs','prebuilt-native-hosts-01')
Write-Output ('F16 exact artifact '+$taskSha+' runtime '+$taskRuntime)
