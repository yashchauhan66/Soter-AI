$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
function Invoke-F17([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $Directory
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F17 gate failed; retained '+$Name)}
}
$taskTests=@('safeReadMcp','safeReadMcp.review','lite-safe-consent-service','lite-safe-consent-commands','safe-view-composition','agent-tools','mcp-canary-boundary','extension','readme-accuracy','gatewayPolicyBoundary','gatewayPolicyWire','gatewayPolicyManager','gatewayPrivateIpc','gatewayVaultRegistry')|ForEach-Object{Join-Path $taskRepo ('packages/vscode-extension/src/__tests__/'+$_+'.test.ts')}
Invoke-F17 'typecheck-02' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F17 'focused-01' (@('--import','tsx','--test','--test-concurrency=1')+$taskTests)
Invoke-F17 'broker-typecheck-01' @('node_modules/typescript/bin/tsc','-p','apps/local-ai-broker/tsconfig.json','--noEmit')
Invoke-F17 'broker-tests-01' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts')
Invoke-F17 'full-tests-01' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F17 'readiness-01' @('packages/vscode-extension/scripts/generate-readiness.mjs','--check')
Invoke-F17 'package-01' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f17-20261018-attempt01.vsix')
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f17-20261018-attempt01.vsix'
$taskSha=(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()
$taskRuntime=(Get-FileHash -LiteralPath (Join-Path $taskRepo 'packages/soterai-lite/dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()
& (Join-Path $PSScriptRoot 'inspect-vsix-01.ps1') -VsixPath $taskVsix -ExpectedVsixSha256 $taskSha -ExpectedBundleSha256 $taskRuntime -InspectionName 01
Invoke-F17 'host-build-01' @('docs/soterai-lite/evidence/20261018-f17-safe-read-73bc91a2/build-native-hosts-01.cjs','prebuilt-native-hosts-01')
Write-Output ('F17 exact artifact '+$taskSha+' runtime '+$taskRuntime)
