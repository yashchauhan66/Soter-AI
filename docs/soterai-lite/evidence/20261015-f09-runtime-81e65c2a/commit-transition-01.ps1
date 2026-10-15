$ErrorActionPreference='Stop'
Set-Location -LiteralPath ((Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path)
$taskLog=Join-Path $PSScriptRoot 'f09-transition-commit-01.txt'
if(Test-Path -LiteralPath $taskLog){throw 'Existing evidence refused.'}
$taskBefore=@(& git diff --cached --name-only)
if($LASTEXITCODE -ne 0 -or $taskBefore.Count){throw 'Existing staged changes refused.'}
$taskList=Join-Path $PSScriptRoot 'f09-transition-allowlist-01.txt'
$taskExpected=@(Get-Content -LiteralPath $taskList -Encoding UTF8|Where-Object {$_.Length}|Sort-Object)
& git -c core.autocrlf=false add --pathspec-from-file=$taskList
if($LASTEXITCODE -ne 0){throw 'F09 transition staging failed.'}
$taskActual=@(& git diff --cached --name-only|Sort-Object)
if($LASTEXITCODE -ne 0 -or @(Compare-Object $taskExpected $taskActual).Count){throw 'Staged paths differ from transition allowlist.'}
$ErrorActionPreference='Continue'
$taskOutput=@(& git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m 'docs(lite): advance byte-verified F09 to F10' 2>&1)
$taskExit=$LASTEXITCODE;$ErrorActionPreference='Stop'
$taskOutput|Out-File -LiteralPath $taskLog -Encoding utf8 -NoClobber
if($taskExit -ne 0){throw 'F09 transition commit failed.'}
& git rev-parse HEAD
