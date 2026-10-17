$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
Set-Location -LiteralPath $taskRepo
$taskLog=Join-Path $PSScriptRoot 'commit-01.txt'
if((Test-Path -LiteralPath $taskLog) -or (Test-Path -LiteralPath ($taskLog+'.result.json'))){throw 'Immutable commit evidence exists.'}
& node (Join-Path $PSScriptRoot 'verify-disposition-01.cjs') --prepared
if($LASTEXITCODE -ne 0){throw 'Prepared scope/byte proof failed; no staging attempted.'}
$taskList=Join-Path $PSScriptRoot 'commit-allowlist-01.txt'
& git --literal-pathspecs -c core.autocrlf=false add --pathspec-from-file=$taskList
if($LASTEXITCODE -ne 0){throw 'Explicit documentation staging failed.'}
& node (Join-Path $PSScriptRoot 'verify-disposition-01.cjs') --staged
if($LASTEXITCODE -ne 0){throw 'Staged bytes failed; no commit attempted.'}
$taskArgs=@('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks','commit','-m','docs(lite): retain unavailable PS7 and advance supported queue')
$ErrorActionPreference='Continue'
$taskRaw=@(& git @taskArgs 2>&1);$taskExit=$LASTEXITCODE
$ErrorActionPreference='Stop'
$taskRaw|Out-File -LiteralPath $taskLog -Encoding utf8 -NoClobber
@{file='git';arguments=$taskArgs;exitCode=$taskExit;output=$taskLog;sha256=(Get-FileHash -LiteralPath $taskLog -Algorithm SHA256).Hash.ToLowerInvariant();observedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 5|Out-File -LiteralPath ($taskLog+'.result.json') -Encoding utf8 -NoClobber
if($taskExit -ne 0){throw 'Scoped documentation commit failed; evidence retained.'}
& git rev-parse HEAD
