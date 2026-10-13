$ErrorActionPreference = 'Stop'
$evidenceDir = $PSScriptRoot
$repoDir = (Resolve-Path -LiteralPath (Join-Path $evidenceDir '../../../..')).Path
Set-Location -LiteralPath $repoDir
$logPath = Join-Path $evidenceDir 'f01-commit-01.txt'
if (Test-Path -LiteralPath $logPath) { throw 'Commit log already exists.' }
$pending = @(& git diff --cached --name-only)
if ($LASTEXITCODE -ne 0 -or $pending.Count -ne 0) { throw 'Existing staged changes prevent scoped commit.' }
$allowlist = Join-Path $evidenceDir 'f01-commit-allowlist-01.txt'
$paths = @(Get-Content -LiteralPath $allowlist -Encoding UTF8 | Where-Object { $_.Length -gt 0 })
& git -c core.autocrlf=false add --pathspec-from-file=$allowlist
if ($LASTEXITCODE -ne 0) { throw 'Explicit F01 staging failed.' }
$staged = @(& git diff --cached --name-only)
if ($LASTEXITCODE -ne 0) { throw 'Staged path verification failed.' }
$difference = @(Compare-Object ($paths | Sort-Object) ($staged | Sort-Object))
if ($difference.Count -ne 0) { throw 'Staged paths differ from F01 allowlist.' }
$ErrorActionPreference = 'Continue'
$output = @(& git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m 'fix(lite): persist restrictions before saved acknowledgement' 2>&1)
$code = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
$output | Out-File -LiteralPath $logPath -Encoding UTF8 -NoClobber
if ($code -ne 0) { throw "F01 scoped commit failed with exit $code" }
& git rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'F01 revision check failed.' }
