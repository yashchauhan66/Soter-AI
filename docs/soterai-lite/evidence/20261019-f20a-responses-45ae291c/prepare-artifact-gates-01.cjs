'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const prior=path.resolve(__dirname,'../20261019-f20-codex-cli-17b8e403');
function write(n,v){fs.writeFileSync(path.join(__dirname,n),v,{flag:'wx'});}
let inspector=fs.readFileSync(path.join(prior,'inspect-vsix-01.ps1'),'utf8').replaceAll('65','66');
// Only machine-setting count/message changes; archive/path/runtime assertions retained.
assert(inspector.includes('machineSettings'));write('inspect-vsix-01.ps1',inspector);
let build=fs.readFileSync(path.join(prior,'build-candidate-04.ps1'),'utf8');
for(const[a,b]of[['typecheck-05','typecheck-02'],['generate-readiness-04','generate-readiness-01'],['readme-readiness-04','readme-readiness-01'],['focused-04','focused-01'],['package-03','package-01'],['attempt03.vsix','attempt04.vsix'],["-InspectionName '03'","-InspectionName '01'"]])build=build.replaceAll(a,b);
const anchor="'packages/vscode-extension/src/__tests__/codexDeleteOwnership.review.test.ts')";assert(build.includes(anchor));build=build.replace(anchor,"'packages/vscode-extension/src/__tests__/codexDeleteOwnership.review.test.ts','packages/vscode-extension/src/__tests__/codexResponsesSchema.test.ts','packages/vscode-extension/src/__tests__/codexResponsesWire.test.ts','packages/vscode-extension/src/__tests__/codexResponsesOwner.test.ts','packages/vscode-extension/src/__tests__/codexResponsesManager.test.ts','packages/vscode-extension/src/__tests__/codexResponsesBridge.test.ts')");write('build-candidate-01.ps1',build);
for(const file of['build-native-hosts-01.cjs','run-retained-native-01.ps1','run-affected-hosts-02.ps1','run-functional-02.ps1','run-security-02.ps1','artifact-binding-02.ps1']){
 if(!fs.existsSync(path.join(prior,file)))continue;write(file,fs.readFileSync(path.join(prior,file),'utf8'));
}
for(const file of['run-current-retained-01.ps1','run-current-affected-01.ps1']){
 let value=fs.readFileSync(path.join(prior,file),'utf8').replaceAll('vsix-inspection-03.json','vsix-inspection-01.json').replaceAll("-InspectionName','03'","-InspectionName','01'");write(file,value);
}
write('run-suites-01.ps1',`$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F20Suite([string]$Name,[string[]]$Arguments,[string]$Directory){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $Directory|Out-Null
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw|ConvertFrom-Json
 Write-Output ($Name+' exit='+$taskResult.exitCode)
 if($taskResult.exitCode -ne 0){throw ('F20A suite failed: '+$Name)}
}
Invoke-F20Suite 'broker-typecheck-01' @('node_modules/typescript/bin/tsc','-p','apps/local-ai-broker/tsconfig.json','--noEmit') $taskRepo
Invoke-F20Suite 'broker-tests-01' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts') $taskRepo
Invoke-F20Suite 'full-tests-01' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
`);
console.log(JSON.stringify({status:'PREPARED_NOT_RUN'}));
