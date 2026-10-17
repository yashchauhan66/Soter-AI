param([Parameter(Mandatory=$true)][string]$Name,[string[]]$Tests,[switch]$Typecheck)
$ErrorActionPreference='Stop'
if ($Name -notmatch '^[a-z0-9-]+$') { throw 'Invalid receipt name' }
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp'
$env:TMP=$env:TEMP
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
if ($Typecheck) { $taskArgs=@('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit') }
else {
    if (!$Tests -or @($Tests | Where-Object { $_ -notmatch '^[A-Za-z0-9-]+\.test\.ts$' }).Count) { throw 'Invalid test filename' }
    $taskArgs=@('--import','tsx','--test','--test-concurrency=1')+@($Tests | ForEach-Object { 'packages/vscode-extension/src/__tests__/'+$_ })
}
& $taskRunner -FilePath node -ArgumentList $taskArgs -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
$taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
exit $taskResult.exitCode
