$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
Set-Location -LiteralPath $taskRepo
$taskLog=Join-Path $PSScriptRoot 'f03-transition-commit-01.txt'
if(Test-Path -LiteralPath $taskLog){throw 'Existing evidence refused.'}
$taskBefore=@(& git diff --cached --name-only)
if($LASTEXITCODE -ne 0 -or $taskBefore.Count){throw 'Existing staged changes refused.'}
$taskList=Join-Path $PSScriptRoot 'f03-transition-allowlist-01.txt'
$taskAllowed=@(Get-Content -LiteralPath $taskList -Encoding UTF8|Where-Object {$_.Length})
$taskExpected=@(& git -c core.quotepath=false diff HEAD --name-only -- $taskAllowed|Sort-Object)
if($LASTEXITCODE -ne 0){throw 'Transition path comparison failed.'}
& git -c core.autocrlf=false add --pathspec-from-file=$taskList
if($LASTEXITCODE -ne 0){throw 'Transition staging failed.'}
$taskActual=@(& git diff --cached --name-only|Sort-Object)
if($LASTEXITCODE -ne 0 -or @(Compare-Object $taskExpected $taskActual).Count){throw 'Transition staged paths differ.'}
$ErrorActionPreference='Continue'
$taskOutput=@(& git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m 'docs(lite): verify F03 commit and activate serial safe consent' 2>&1)
$taskExit=$LASTEXITCODE
$ErrorActionPreference='Stop'
$taskOutput|Out-File -LiteralPath $taskLog -Encoding UTF8 -NoClobber
if($taskExit -ne 0){throw 'Transition commit failed.'}
& git rev-parse HEAD
