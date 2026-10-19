$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F20Check([string]$Name,[string[]]$Arguments){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo|Out-Null
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw|ConvertFrom-Json
 Write-Output ($Name+' exit='+$taskResult.exitCode)
 if($taskResult.exitCode -ne 0){throw ('F20A candidate gate failed: '+$Name)}
}
Invoke-F20Check 'typecheck-02' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F20Check 'generate-readiness-01' @('packages/vscode-extension/scripts/generate-readiness.mjs')
Invoke-F20Check 'focused-01' @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/codexCliAdapterPolicy.test.ts','packages/vscode-extension/src/__tests__/codexHttpBridge.test.ts','packages/vscode-extension/src/__tests__/codexHttpReadiness.review.test.ts','packages/vscode-extension/src/__tests__/codexCliAdapterLifecycle.test.ts','packages/vscode-extension/src/__tests__/codexCliAdapterRegistration.test.ts','packages/vscode-extension/src/__tests__/codexCliOwnerRecovery.review.test.ts','packages/vscode-extension/src/__tests__/codexNativeMetadata.review.test.ts','packages/vscode-extension/src/__tests__/codexStorageUri.review.test.ts','packages/vscode-extension/src/__tests__/codexDeleteOwnership.review.test.ts','packages/vscode-extension/src/__tests__/codexResponsesSchema.test.ts','packages/vscode-extension/src/__tests__/codexResponsesWire.test.ts','packages/vscode-extension/src/__tests__/codexResponsesOwner.test.ts','packages/vscode-extension/src/__tests__/codexResponsesManager.test.ts','packages/vscode-extension/src/__tests__/codexResponsesBridge.test.ts')
Invoke-F20Check 'readme-readiness-01' @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/readme-accuracy.test.ts','packages/vscode-extension/src/__tests__/readiness-doc.test.ts')
Invoke-F20Check 'package-01' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f20a-20261019-attempt04.vsix')
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f20a-20261019-attempt04.vsix'
& (Join-Path $PSScriptRoot 'inspect-vsix-01.ps1') -VsixPath $taskVsix -ExpectedVsixSha256 ((Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()) -ExpectedBundleSha256 ((Get-FileHash -LiteralPath (Join-Path $taskRepo 'packages/soterai-lite/dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()) -InspectionName '01'
