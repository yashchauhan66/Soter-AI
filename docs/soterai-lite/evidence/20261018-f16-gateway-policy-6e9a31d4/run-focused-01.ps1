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
Invoke-F16 'typecheck-03' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F16 'focused-01' (@('--import','tsx','--test','--test-concurrency=1')+$taskTests)
Invoke-F16 'broker-typecheck-01' @('node_modules/typescript/bin/tsc','-p','apps/local-ai-broker/tsconfig.json','--noEmit')
Invoke-F16 'broker-tests-02' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/**/*.test.ts')
