$ErrorActionPreference='Stop'
Set-Location -LiteralPath ((Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path)
$taskLog=Join-Path $PSScriptRoot 'f03-transition-commit-01.txt'
if(Test-Path -LiteralPath $taskLog){throw 'Existing evidence refused.'}
$taskExpected=@(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f03-transition-allowlist-01.txt') -Encoding UTF8|Where-Object { $_.Length -and $_ -ne 'docs/soterai-lite/evidence/20261013-f03-policy-review-207ad3dc/commit-f03.ps1' }|Sort-Object)
# The previous preflight included only tracked diff paths; new receipt files were
# already staged in the exact approved allowlist. Verify all seven paths now.
$taskActual=@(& git diff --cached --name-only|Sort-Object)
if($LASTEXITCODE -ne 0 -or $taskExpected.Count -ne 7 -or @(Compare-Object $taskExpected $taskActual).Count){throw 'Transition staged paths differ from the exact seven changed paths.'}
$ErrorActionPreference='Continue'
$taskOutput=@(& git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m 'docs(lite): verify F03 commit and activate serial safe consent' 2>&1)
$taskExit=$LASTEXITCODE
$ErrorActionPreference='Stop'
$taskOutput|Out-File -LiteralPath $taskLog -Encoding UTF8 -NoClobber
if($taskExit -ne 0){throw 'Transition commit failed.'}
& git rev-parse HEAD
