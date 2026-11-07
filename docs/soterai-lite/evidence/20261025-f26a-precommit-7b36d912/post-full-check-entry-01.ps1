param([Parameter(Mandatory=$true)][ValidateSet('backend-typecheck','backend-tests','native-build','package')][string]$Check)
$ErrorActionPreference='Stop'
$taskRepo='C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard'
$taskEvidence=Join-Path $taskRepo 'docs\soterai-lite\evidence\20261025-f26a-precommit-7b36d912'
switch($Check){
 'backend-typecheck' {$taskArgs=@('node_modules/typescript/bin/tsc','--noEmit','-p','apps/local-ai-broker/tsconfig.json');$taskOutput='backend-typecheck-01.txt'}
 'backend-tests' {$taskArgs=@('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts');$taskOutput='backend-tests-01.txt'}
 'native-build' {$taskArgs=@('docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/build-native-hosts-02.cjs');$taskOutput='native-build-01.txt'}
 'package' {$taskArgs=@('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f26a-20261026-attempt01.vsix');$taskOutput='package-01.txt'}
}
Set-Location -LiteralPath $taskRepo
& (Join-Path $taskRepo 'docs\soterai-lite\evidence\20261013-l0-resume-88fb9432\run-check.ps1') -FilePath node -ArgumentList $taskArgs -OutputFile (Join-Path $taskEvidence $taskOutput) -WorkingDirectory $taskRepo
exit $LASTEXITCODE
