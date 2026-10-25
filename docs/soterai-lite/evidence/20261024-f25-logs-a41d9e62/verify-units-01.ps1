$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
Set-Location -LiteralPath $taskRepo
& $taskRunner -FilePath 'node' -ArgumentList @('node_modules/typescript/bin/tsc','--noEmit','-p','packages/vscode-extension/tsconfig.json') -OutputFile (Join-Path $PSScriptRoot 'compiler-02.txt')
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
$taskNames=@('logContent','managedLogCollector','logAggregateFraming','logController','logCommands','logOwnedOutput','logVaultJob','logVaultRuntime','logProviderOutput','vaultAppJob','vaultAppJob.short','vaultAppJob.review','vaultRuntimeCoordinator','vaultRuntimeSurfaces','vaultRuntimeSurfaces.review','vaultRuntimeOwnership.review','vaultRuntimeLease','vaultRuntimePolicy.review','streamingOutputRedactor','streamingOutputRedactor.review','streamingOutputIntegration')
$taskFiles=@($taskNames | ForEach-Object { '../vscode-extension/src/__tests__/'+$_+'.test.ts' })
foreach($taskFile in $taskFiles){if(-not(Test-Path -LiteralPath (Join-Path (Join-Path $taskRepo 'packages/soterai-lite') $taskFile))){throw 'Required focused test absent.'}}
& $taskRunner -FilePath 'node' -ArgumentList (@('--import','tsx','--test')+$taskFiles) -WorkingDirectory (Join-Path $taskRepo 'packages/soterai-lite') -OutputFile (Join-Path $PSScriptRoot 'log-runtime-combined-02.txt')
exit $LASTEXITCODE
