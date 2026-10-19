'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const prior=path.resolve(__dirname,'../20261019-f19-claude-89c1e602'),write=(n,s)=>fs.writeFileSync(path.join(__dirname,n),s,{flag:'wx'});
let inspect=fs.readFileSync(path.join(prior,'inspect-vsix-01.ps1'),'utf8').replaceAll('F19','F20A').replaceAll('f19','f20a')
 .replaceAll('soterai.lite.claudeAdapter','soterai.lite.codexCliAdapter').replaceAll('soterai.configurePinnedClaude','soterai.configurePinnedCodexCli')
 .replaceAll('soterai.restorePinnedClaude','soterai.restorePinnedCodexCli').replaceAll('soterai.claudeAdapterStatus','soterai.codexCliAdapterStatus')
 .replaceAll('Count -ne 64','Count -ne 65').replaceAll('requires 64 machine','requires 65 machine').replaceAll('machineSettings=64','machineSettings=65');
assert.ok(inspect.includes('f20a-'));write('inspect-vsix-01.ps1',inspect);
const tests=['codexCliAdapterPolicy.test.ts','codexHttpBridge.test.ts','codexHttpReadiness.review.test.ts','codexCliAdapterLifecycle.test.ts','codexCliAdapterRegistration.test.ts','codexCliOwnerRecovery.review.test.ts','codexNativeMetadata.review.test.ts'].map(n=>"'packages/vscode-extension/src/__tests__/"+n+"'").join(',');
write('build-candidate-01.ps1',[
 "$ErrorActionPreference='Stop'",
 "$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))",
 "$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'",
 "function Invoke-F20Check([string]$Name,[string[]]$Arguments){",
 " & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo|Out-Null",
 " $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw|ConvertFrom-Json",
 " Write-Output ($Name+' exit='+$taskResult.exitCode)",
 " if($taskResult.exitCode -ne 0){throw ('F20A candidate gate failed: '+$Name)}",
 "}",
 "Invoke-F20Check 'typecheck-02' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')",
 "Invoke-F20Check 'generate-readiness-01' @('packages/vscode-extension/scripts/generate-readiness.mjs')",
 "Invoke-F20Check 'focused-01' @('--import','tsx','--test','--test-concurrency=1',"+tests+")",
 "Invoke-F20Check 'readme-readiness-01' @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/readme-accuracy.test.ts','packages/vscode-extension/src/__tests__/readiness-doc.test.ts')",
 "Invoke-F20Check 'package-01' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f20a-20261019-attempt01.vsix')",
 "$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f20a-20261019-attempt01.vsix'",
 "& (Join-Path $PSScriptRoot 'inspect-vsix-01.ps1') -VsixPath $taskVsix -ExpectedVsixSha256 ((Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()) -ExpectedBundleSha256 ((Get-FileHash -LiteralPath (Join-Path $taskRepo 'packages/soterai-lite/dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()) -InspectionName '01'",
 ""].join('\n'));
let suites=fs.readFileSync(path.join(prior,'run-suites-02.ps1'),'utf8').replaceAll('F19','F20A')
 .replace("'D:\\SoterAI-Lite-test-profiles\\f03-unit-temp'","(Join-Path 'D:\\SoterAI-Lite-test-profiles' ('f20a-unit-'+[Guid]::NewGuid().ToString('N')))")
 .replace("$env:TMP=$env:TEMP","$env:TMP=$env:TEMP;[void][IO.Directory]::CreateDirectory($env:TEMP)")
 .replaceAll("'broker-typecheck-03'","'broker-typecheck-01'").replaceAll("'broker-tests-02'","'broker-tests-01'").replaceAll("'full-tests-02'","'full-tests-01'").replaceAll("'readiness-02'","'readiness-01'");
write('run-suites-01.ps1',suites);
console.log('PREPARED_CURRENT_COMPILERS_FOCUSED47_READINESS_EXACT_CANDIDATE01_AND_SUITES');
