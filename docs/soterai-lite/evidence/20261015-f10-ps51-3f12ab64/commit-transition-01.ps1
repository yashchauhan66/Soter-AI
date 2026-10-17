# DEFERRED: root runs only after prepare-transition-01.cjs and its source-byte
# prerequisites succeed. Exact explicit transition paths, no unrelated staging.
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
Set-Location -LiteralPath $taskRepo
$taskLog=Join-Path $PSScriptRoot 'f10-transition-commit-01.txt'
if((Test-Path -LiteralPath $taskLog) -or (Test-Path -LiteralPath ($taskLog+'.result.json'))){throw 'Immutable transition commit evidence exists.'}
$taskBefore=@(& git diff --cached --name-only)
if($LASTEXITCODE -ne 0 -or $taskBefore.Count){throw 'Pre-existing staged changes refused.'}
$taskIndex=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f10-transition-index-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskIndex.status -cne 'PREPARED_TRANSITION_NOT_BYTE_VERIFIED' -or $taskIndex.feature -cne 'F10' -or $taskIndex.nextFeature -cne 'F11'){throw 'Prepared explicit F10 transition index required.'}
$taskHead=@(& git rev-parse HEAD)
if($LASTEXITCODE -ne 0 -or $taskHead.Count -ne 1 -or $taskHead[0] -cne $taskIndex.sourceRevision){throw 'Verified source parent changed.'}
$taskList=Join-Path $PSScriptRoot 'f10-transition-allowlist-01.txt'
$taskExpected=@(Get-Content -LiteralPath $taskList -Encoding UTF8|Where-Object{$_.Length}|Sort-Object)
if(@(Compare-Object $taskExpected @($taskIndex.expectedCommitPaths|Sort-Object)).Count -or @($taskExpected|Select-Object -Unique).Count -ne $taskExpected.Count){throw 'Allowlist differs from the frozen transition index.'}
foreach($taskName in $taskExpected){
 if($taskName -match '[\x00-\x1f\x7f]' -or [IO.Path]::IsPathRooted($taskName) -or $taskName -match '(^|[\\/])\.\.([\\/]|$)'){throw 'Unsafe transition path refused.'}
}
& node (Join-Path $PSScriptRoot 'verify-transition-01.cjs') --prepared
if($LASTEXITCODE -ne 0){throw 'Prepared transition proof/path verification failed; no staging attempted.'}
& git --literal-pathspecs -c core.autocrlf=false add --pathspec-from-file=$taskList
if($LASTEXITCODE -ne 0){throw 'Scoped transition staging failed; staged bytes retained.'}
& node (Join-Path $PSScriptRoot 'verify-transition-01.cjs') --staged
if($LASTEXITCODE -ne 0){throw 'Staged transition byte verification failed; no commit attempted.'}
$ErrorActionPreference='Continue'
$taskCommand=@('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks','commit','-m','docs(lite): advance byte-verified F10 to F11')
$taskOutput=@(& git @taskCommand 2>&1)
$taskExit=$LASTEXITCODE;$ErrorActionPreference='Stop'
$taskOutput|Out-File -LiteralPath $taskLog -Encoding utf8 -NoClobber
@{file='git';arguments=$taskCommand;exitCode=$taskExit;output=$taskLog;sha256=(Get-FileHash -LiteralPath $taskLog -Algorithm SHA256).Hash.ToLowerInvariant();observedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 5|Out-File -LiteralPath ($taskLog+'.result.json') -Encoding utf8 -NoClobber
if($taskExit -ne 0){throw 'F10 transition commit failed; raw evidence and staged state retained.'}
& git rev-parse HEAD
if($LASTEXITCODE -ne 0){throw 'Transition commit identity unavailable; do not start F11 production.'}
