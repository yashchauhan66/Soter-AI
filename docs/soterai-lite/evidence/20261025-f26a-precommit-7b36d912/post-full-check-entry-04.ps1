param([Parameter(Mandatory=$true)][ValidateSet('backend-typecheck','backend-tests','native-build','package')][string]$Check)
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskEvidence=$PSScriptRoot
& node (Join-Path $PSScriptRoot 'post-full04-contract.cjs') | Out-Null
if($LASTEXITCODE -ne 0){throw 'Current full03/compiler15/source04 gates unavailable.'}
switch($Check){
 'backend-typecheck' {$taskArgs=@('node_modules/typescript/bin/tsc','--noEmit','-p','apps/local-ai-broker/tsconfig.json');$taskOutput='backend-typecheck-04.txt'}
 'backend-tests' {$taskArgs=@('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts');$taskOutput='backend-tests-04.txt'}
 'native-build' {$taskArgs=@('docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/build-native-hosts-04.cjs');$taskOutput='native-build-04.txt'}
 'package' {$taskArgs=@('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f26a-20261026-attempt02.vsix');$taskOutput='package-04.txt'}
}
if(Test-Path -LiteralPath (Join-Path $taskEvidence $taskOutput)){throw 'Immutable gate output already exists.'}
if(Test-Path -LiteralPath (Join-Path $taskEvidence ($taskOutput+'.result.json'))){throw 'Immutable gate receipt already exists.'}
if($Check -ceq 'package' -and (Test-Path -LiteralPath (Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt02.vsix'))){throw 'New attempt02 artifact already exists.'}
Set-Location -LiteralPath $taskRepo
& (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1') -FilePath node -ArgumentList $taskArgs -OutputFile (Join-Path $taskEvidence $taskOutput) -WorkingDirectory $taskRepo
exit $LASTEXITCODE
