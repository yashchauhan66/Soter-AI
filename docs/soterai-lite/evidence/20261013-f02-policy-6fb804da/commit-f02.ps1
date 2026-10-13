$ErrorActionPreference='Stop'
$repoDir=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
Set-Location -LiteralPath $repoDir
$logPath=Join-Path $PSScriptRoot 'f02-commit-01.txt'
if(Test-Path -LiteralPath $logPath){throw 'Evidence overwrite refused.'}
$stagedBefore=@(& git diff --cached --name-only)
if($LASTEXITCODE -ne 0 -or $stagedBefore.Count -ne 0){throw 'Existing staged changes prevent scoped commit.'}
$allowlist=Join-Path $PSScriptRoot 'f02-commit-allowlist-01.txt'
$expected=@(Get-Content -LiteralPath $allowlist -Encoding UTF8|Where-Object {$_.Length -gt 0}|Sort-Object)
& git -c core.autocrlf=false add --pathspec-from-file=$allowlist
if($LASTEXITCODE -ne 0){throw 'F02 allowlist staging failed.'}
$actual=@(& git diff --cached --name-only|Sort-Object)
if($LASTEXITCODE -ne 0 -or @(Compare-Object $expected $actual).Count -ne 0){throw 'F02 staged paths differ from explicit allowlist.'}
$ErrorActionPreference='Continue'
$output=@(& git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m 'feat(lite): retain versioned additive policy and credential defaults' 2>&1)
$code=$LASTEXITCODE
$ErrorActionPreference='Stop'
$output|Out-File -LiteralPath $logPath -Encoding UTF8 -NoClobber
if($code -ne 0){throw "F02 commit failed exit $code"}
& git rev-parse HEAD
if($LASTEXITCODE -ne 0){throw 'F02 revision check failed.'}
