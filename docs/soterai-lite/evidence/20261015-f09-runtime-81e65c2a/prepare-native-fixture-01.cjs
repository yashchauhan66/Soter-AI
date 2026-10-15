// Deferred test-only scaffolding. Root may execute this preparer after review;
// it writes new files exclusively, never builds, launches, installs or kills.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const previous=path.resolve(__dirname,'../20261015-f08-output-b7429e10');
const names=['run-native-01.ps1','build-host-01.cjs','run-host-checks-01.ps1'];
for(const name of names)assert.ok(!fs.existsSync(path.join(__dirname,name)),'Immutable output already exists: '+name);
let launcher=fs.readFileSync(path.join(previous,'run-native-01.ps1'),'utf8').replaceAll('F08','F09').replaceAll('f08','f09').replaceAll('matching-results.json','runtime-results.json');
launcher=launcher.replace("JSON.stringify({status:'FAIL',stage,errorName:error instanceof Error?error.name:'UnknownFailure'})", "JSON.stringify({status:'FAIL',stage,errorName:error instanceof Error?error.name:'UnknownFailure',setup:typeof driver.setupDiagnostic==='function'?driver.setupDiagnostic():undefined})");
launcher=launcher.replace("try { await actual.activate(context); }", "try { if (typeof driver.beforeActivate === 'function') await driver.beforeActivate(context); await actual.activate(context); }");
launcher=launcher.replace("'soterai.lite.outputRedactor'=$true}", "'soterai.lite.outputRedactor'=$true;'soterai.lite.secretMatching'=$true;'soterai.lite.vaultMode'=$true;'soterai.lite.vaultRuntime'=$true}");
launcher=launcher.replace("$taskInfo.EnvironmentVariables['SOTERAI_LITE_F09_BUNDLE_SHA256']=$taskHash;", "$taskInfo.EnvironmentVariables['SOTERAI_LITE_F09_AMBIENT']='synthetic-ambient-control-must-not-inherit';$taskInfo.EnvironmentVariables['SOTERAI_LITE_F09_BUNDLE_SHA256']=$taskHash;");
launcher=launcher.replace("if($taskObserved.failed -ne 0 -or", "if($taskObserved.passed -ne 12 -or @($taskObserved.observations).Count -ne 12 -or $taskObserved.failed -ne 0 -or");
launcher=launcher.replace('Synthetic in-process transports, LOW independence; no network/external-agent/streaming/gateway/clean-install claim.', 'Actual finite owned Node apps plus native CustomExecution and inline debug sessions; scripted native owner decisions LOW. No OS confinement, source debugger, shell/gateway/external-agent/clean-install claim.');
launcher=launcher.replace('Native matching completed:', 'Native owned runtime completed:');
assert.ok(launcher.includes('driver.beforeActivate(context)'));assert.ok(launcher.includes('soterai.lite.vaultRuntime'));assert.ok(launcher.includes('$taskObserved.passed -ne 12'));
fs.writeFileSync(path.join(__dirname,'run-native-01.ps1'),launcher,{flag:'wx'});
let builder=fs.readFileSync(path.join(previous,'build-host-01.cjs'),'utf8').replaceAll('liteStreamingOutput.host.ts','liteVaultRuntime.host.ts').replaceAll('lite-streaming-output-host.js','lite-vault-runtime-host.js');
fs.writeFileSync(path.join(__dirname,'build-host-01.cjs'),builder,{flag:'wx'});
const wrapper=String.raw`param([Parameter(Mandatory=$true)][string]$CodePath,[Parameter(Mandatory=$true)][string]$ExtensionRoot)
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskBuildLog=Join-Path $PSScriptRoot 'host-build-01.txt'
$taskBuildReceipt=$taskBuildLog+'.result.json'
if(-not(Test-Path -LiteralPath $taskBuildReceipt)){throw 'Root must build the reviewed native fixture first.'}
$taskBuilt=Get-Content -LiteralPath $taskBuildReceipt -Raw -Encoding UTF8|ConvertFrom-Json
if($taskBuilt.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskBuildLog).Hash -ne $taskBuilt.sha256){throw 'Host build receipt missing or changed.'}
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-native-01.ps1'),'-CodePath',$CodePath,'-HostTestsPath',(Join-Path $PSScriptRoot 'prebuilt-host-01/lite-vault-runtime-host.js'),'-ExtensionRoot',$ExtensionRoot) -OutputFile (Join-Path $PSScriptRoot 'native-host-launch-01.txt') -WorkingDirectory $taskRepo
$taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-host-launch-01.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskResult.exitCode -ne 0){throw 'Native runtime acceptance failed or incomplete; retain all evidence.'}
`;
fs.writeFileSync(path.join(__dirname,'run-host-checks-01.ps1'),wrapper,{flag:'wx'});
console.log('Prepared F09 unique isolated native task/debug launcher and test-only host build; no build or host executed.');
