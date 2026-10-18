$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
Set-Location -LiteralPath $taskRepo
$taskLog=Join-Path $PSScriptRoot 'f15h-commit-01.txt'
if((Test-Path -LiteralPath $taskLog) -or (Test-Path -LiteralPath ($taskLog+'.result.json'))){throw 'Immutable commit evidence exists.'}
$taskBefore=@(& git diff --cached --name-only)
if($LASTEXITCODE -ne 0 -or $taskBefore.Count){throw 'Pre-existing staged changes refused.'}
$taskIndex=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f15h-evidence-index-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskHead=@(& git rev-parse HEAD)
if($LASTEXITCODE -ne 0 -or $taskHead.Count -ne 1 -or $taskHead[0] -cne $taskIndex.parent){throw 'Source parent changed.'}
$taskList=Join-Path $PSScriptRoot 'f15h-commit-allowlist-01.txt'
$taskExpected=@(Get-Content -LiteralPath $taskList -Encoding UTF8|Where-Object{$_.Length}|Sort-Object)
if(@(Compare-Object $taskExpected @($taskIndex.expectedCommitPaths|Sort-Object)).Count){throw 'Allowlist differs from the frozen evidence index.'}
& git -c core.autocrlf=false add --pathspec-from-file=$taskList
if($LASTEXITCODE -ne 0){throw 'Scoped F15h staging failed; staged data retained for inspection.'}
& node (Join-Path $PSScriptRoot 'check-staged-01.cjs')
if($LASTEXITCODE -ne 0){throw 'Staged byte verification failed; no commit attempted.'}
$ErrorActionPreference='Continue'
$taskCommand=@('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks','commit','-m','feat(lite): bound declared base64 chat blobs before gateway inspection')
$taskOutput=@(& git @taskCommand 2>&1)
$taskExit=$LASTEXITCODE;$ErrorActionPreference='Stop'
$taskOutput|Out-File -LiteralPath $taskLog -Encoding utf8 -NoClobber
@{file='git';arguments=$taskCommand;exitCode=$taskExit;output=$taskLog;sha256=(Get-FileHash -LiteralPath $taskLog -Algorithm SHA256).Hash.ToLowerInvariant();observedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 5|Out-File -LiteralPath ($taskLog+'.result.json') -Encoding utf8 -NoClobber
if($taskExit -ne 0){throw 'F15h scoped source commit failed; raw evidence retained.'}
& git rev-parse HEAD
