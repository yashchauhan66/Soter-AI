$ErrorActionPreference='Stop'
$taskRepo=(Get-Location).Path
$taskEvidence=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261028-f30-setup-verification-847d2f09'
$taskOwner=Join-Path $taskEvidence 'edge-chain-owner-02.json'
$taskOut=Join-Path $taskEvidence 'edge-chain-stdout-02.txt'
$taskErr=Join-Path $taskEvidence 'edge-chain-stderr-02.txt'
foreach($taskFile in @($taskOwner,$taskOut,$taskErr)){if(Test-Path -LiteralPath $taskFile){throw 'Existing Edge owner refuses duplicate launch'}}
$taskAffected=Get-Content -LiteralPath (Join-Path $taskEvidence 'affected-chain-result-01.json') -Raw | ConvertFrom-Json
if($taskAffected.status -cne 'F30_AFFECTED_WRAPPERS_CLOSED_PASS_ROOT_AGGREGATION_REQUIRED' -or @($taskAffected.results).Count -ne 5){throw 'Affected chain must pass and close before serial Edge audit'}
foreach($taskResult in $taskAffected.results){if(-not $taskResult.actualClose -or -not $taskResult.stdoutEOF -or -not $taskResult.stderrEOF -or $taskResult.wrapperExit -ne 0 -or $taskResult.innerExit -ne 0){throw 'Affected owner closure incomplete'}}
$taskFailedProfile='D:\SoterAI-Lite-test-profiles\f30-setup-verification-native-20261028T181459Z-47267fb7\f30-edge-axe-1793211936190-88de5866\edge-profile'
$taskOldOwners=@(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.ProcessId -eq 24252 -or $_.ParentProcessId -eq 24252 -or ($_.CommandLine -and $_.CommandLine.Contains($taskFailedProfile)) } | Select-Object ProcessId,ParentProcessId)
$taskOldListeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -in @(61442,61427) } | Select-Object LocalAddress,LocalPort,OwningProcess)
if($taskOldOwners.Count -or $taskOldListeners.Count){throw 'Failed Edge owner/listener still present; refuse new launch'}
$taskAbsence=[ordered]@{status='READONLY_PRIOR_OWNER_AND_LISTENER_ABSENT_FAILED_RUN_NOT_REGRADED';observedAt=[DateTime]::UtcNow.ToString('o');processes=$taskOldOwners;listeners=$taskOldListeners;originalPipeEOF='NOT_OBSERVED_PARENT_CRASHED';signalsRequested=0}
$taskAbsenceFile=Join-Path $taskEvidence 'failed-edge-owner-query-02.json'
if(Test-Path -LiteralPath $taskAbsenceFile){throw 'Existing absence receipt refuses duplicate launch'}
[IO.File]::WriteAllText($taskAbsenceFile,($taskAbsence|ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($false))
$taskScript=Join-Path $taskEvidence 'run-edge-chain-02.cjs'
$taskProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('"'+$taskScript+'"') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
$taskValue=[ordered]@{status='F30_SECOND_NORMAL_IMPROVEMENT_EDGE_STARTED_NOT_COMPLETED';pid=$taskProcess.Id;observedAt=[DateTime]::UtcNow.ToString('o');script=$taskScript;stdout=$taskOut;stderr=$taskErr;signalsRequested=0;native06='F26a_USER_DEFERRED_NOT_RUN'}
$taskStream=[IO.File]::Open($taskOwner,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
try{$taskBytes=[Text.Encoding]::UTF8.GetBytes(($taskValue|ConvertTo-Json -Depth 4));$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Compress
