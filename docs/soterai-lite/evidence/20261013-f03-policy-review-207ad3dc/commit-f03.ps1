$ErrorActionPreference='Stop'
$taskRepoDir=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
Set-Location -LiteralPath $taskRepoDir
$taskLog=Join-Path $PSScriptRoot 'f03-commit-01.txt'
if(Test-Path -LiteralPath $taskLog){throw 'Evidence overwrite refused.'}
$taskBefore=@(& git diff --cached --name-only)
if($LASTEXITCODE -ne 0 -or $taskBefore.Count -ne 0){throw 'Existing staged changes prevent scoped commit.'}
$taskAllowlist=Join-Path $PSScriptRoot 'f03-commit-allowlist-01.txt'
$taskExpected=@(Get-Content -LiteralPath $taskAllowlist -Encoding UTF8|Where-Object {$_.Length -gt 0}|Sort-Object)
& git -c core.autocrlf=false add --pathspec-from-file=$taskAllowlist
if($LASTEXITCODE -ne 0){throw 'F03 allowlist staging failed.'}
$taskActual=@(& git diff --cached --name-only|Sort-Object)
if($LASTEXITCODE -ne 0 -or @(Compare-Object $taskExpected $taskActual).Count -ne 0){throw 'F03 staged paths differ from explicit allowlist.'}
$ErrorActionPreference='Continue'
$taskOutput=@(& git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m 'feat(lite): audit session policy reviews and revoke protection drift' 2>&1)
$taskCode=$LASTEXITCODE
$ErrorActionPreference='Stop'
$taskOutput|Out-File -LiteralPath $taskLog -Encoding UTF8 -NoClobber
if($taskCode -ne 0){throw "F03 commit failed exit $taskCode"}
& git rev-parse HEAD
if($LASTEXITCODE -ne 0){throw 'F03 revision check failed.'}
