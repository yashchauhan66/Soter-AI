$ErrorActionPreference='Stop'
$taskRepo=(Get-Location).Path
$taskEvidence=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261028-f30-setup-verification-847d2f09'
$taskOwner=Join-Path $taskEvidence 'edge-chain-owner-01.json'
$taskOut=Join-Path $taskEvidence 'edge-chain-stdout-01.txt'
$taskErr=Join-Path $taskEvidence 'edge-chain-stderr-01.txt'
foreach($taskFile in @($taskOwner,$taskOut,$taskErr)){if(Test-Path -LiteralPath $taskFile){throw 'Existing Edge owner refuses duplicate launch'}}
$taskAffected=Get-Content -LiteralPath (Join-Path $taskEvidence 'affected-chain-result-01.json') -Raw | ConvertFrom-Json
if($taskAffected.status -cne 'F30_AFFECTED_WRAPPERS_CLOSED_PASS_ROOT_AGGREGATION_REQUIRED' -or @($taskAffected.results).Count -ne 5){throw 'Affected chain must pass and close before serial Edge audit'}
foreach($taskResult in $taskAffected.results){if(-not $taskResult.actualClose -or -not $taskResult.stdoutEOF -or -not $taskResult.stderrEOF -or $taskResult.wrapperExit -ne 0 -or $taskResult.innerExit -ne 0){throw 'Affected owner closure incomplete'}}
$taskScript=Join-Path $taskEvidence 'run-edge-chain-01.cjs'
$taskProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('"'+$taskScript+'"') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
$taskValue=[ordered]@{status='F30_EDGE_FIRST_RUN_STARTED_NOT_COMPLETED';pid=$taskProcess.Id;observedAt=[DateTime]::UtcNow.ToString('o');script=$taskScript;stdout=$taskOut;stderr=$taskErr;signalsRequested=0;native06='F26a_USER_DEFERRED_NOT_RUN'}
$taskStream=[IO.File]::Open($taskOwner,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
try{$taskBytes=[Text.Encoding]::UTF8.GetBytes(($taskValue|ConvertTo-Json -Depth 4));$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Compress
