$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
Set-Location -LiteralPath $taskRepo
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskLog=Join-Path $PSScriptRoot 'transition-retry-preparation-02.txt'
& $taskRunner -FilePath node -ArgumentList @((Join-Path $PSScriptRoot 'retry-transition-02.cjs'),'prepare') -OutputFile $taskLog -WorkingDirectory $taskRepo
$taskReceipt=Get-Content -LiteralPath ($taskLog+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskReceipt.exitCode -ne 0){throw 'Recovery retry preparation failed; original staging retained.'}
$taskList=Join-Path $PSScriptRoot 'f15d-transition-allowlist-02.txt'
& git --literal-pathspecs -c core.autocrlf=false add --pathspec-from-file=$taskList
if($LASTEXITCODE -ne 0){throw 'Explicit retry staging failed; evidence retained.'}
& node (Join-Path $PSScriptRoot 'retry-transition-02.cjs') staged
if($LASTEXITCODE -ne 0){throw 'Retry staged bytes failed; no commit attempted.'}
$taskCommitLog=Join-Path $PSScriptRoot 'f15d-transition-commit-02.txt'
if(Test-Path -LiteralPath $taskCommitLog){throw 'Immutable retry commit output exists.'}
$taskArgs=@('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks','commit','-m','docs(lite): retain disk failure and complete deflate transition')
$ErrorActionPreference='Continue'
$taskOutput=@(& git @taskArgs 2>&1);$taskExit=$LASTEXITCODE;$ErrorActionPreference='Stop'
$taskOutput|Out-File -LiteralPath $taskCommitLog -Encoding utf8 -NoClobber
@{file='git';arguments=$taskArgs;exitCode=$taskExit;output=$taskCommitLog;sha256=(Get-FileHash -LiteralPath $taskCommitLog -Algorithm SHA256).Hash.ToLowerInvariant();observedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 5|Out-File -LiteralPath ($taskCommitLog+'.result.json') -Encoding utf8 -NoClobber
if($taskExit -ne 0){throw 'Retry transition commit failed; exact failed evidence retained.'}
$taskRevision=@(& git rev-parse HEAD)
if($LASTEXITCODE -ne 0 -or $taskRevision.Count -ne 1 -or $taskRevision[0] -cnotmatch '^[a-f0-9]{40}$'){throw 'Exact retry transition revision required.'}
& $taskRunner -FilePath node -ArgumentList @((Join-Path $PSScriptRoot 'retry-transition-02.cjs'),'committed',$taskRevision[0]) -OutputFile (Join-Path $PSScriptRoot 'transition-verification-02.txt') -WorkingDirectory $taskRepo
$taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'transition-verification-02.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskReceipt.exitCode -ne 0){throw 'Retry transition byte proof failed; next production withheld.'}
