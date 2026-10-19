$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$env:TEMP='D:/SoterAI-Lite-test-profiles/f03-unit-temp';$env:TMP=$env:TEMP
function Invoke-F18Candidate([string]$Name,[string[]]$Arguments){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo|Out-Null
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw|ConvertFrom-Json
 Write-Output ($Name+' exit='+$taskResult.exitCode)
 if($taskResult.exitCode -ne 0){throw ('F18 candidate gate failed: '+$Name)}
}
Invoke-F18Candidate 'typecheck-14' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
$taskTests=@('clineAdapterPolicy','clineAdapterPolicy.review','clineAdapterAtomicIO','clineAdapterLifecycle','sealedBridgeTicket','clineHookBridge','clineHookClient','clineEditorHook','clineProviderHeaders','clineGatewaySchemas','clineMatcherBudget','clineMcpToolName','clineNativePaths','lite-safe-consent-service','lite-safe-consent-commands','safeReadMcp','safeReadMcp.review','agent-tools','auto-secure-engine','integration-adapter','extension','readme-accuracy','gatewayPolicyBoundary','gatewayPolicyWire','gatewayPolicyManager','gatewayPrivateIpc','gatewayVaultRegistry')|ForEach-Object{Join-Path $taskRepo ('packages/vscode-extension/src/__tests__/'+$_+'.test.ts')}
Invoke-F18Candidate 'broker-typecheck-05' @('node_modules/typescript/bin/tsc','-p','apps/local-ai-broker/tsconfig.json','--noEmit')
Invoke-F18Candidate 'focused-10' (@('--import','tsx','--test','--test-concurrency=1')+$taskTests)
Invoke-F18Candidate 'package-08' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f18-20261019-attempt08.vsix')

$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f18-20261019-attempt08.vsix'
& (Join-Path $PSScriptRoot 'inspect-vsix-02.ps1') -VsixPath $taskVsix -ExpectedVsixSha256 ((Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()) -ExpectedBundleSha256 ((Get-FileHash -LiteralPath (Join-Path $taskRepo 'packages/soterai-lite/dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()) -InspectionName '08'





