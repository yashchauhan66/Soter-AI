$ErrorActionPreference='Stop'
$taskRun=Join-Path $PSScriptRoot 'f26b-configured-push-20261101T081622Z-c6f6d008'
$taskOutput=Join-Path $PSScriptRoot 'configured-push-failure-owner-observation-01.json'
if(Test-Path -LiteralPath $taskOutput){throw 'Evidence overwrite refused.'}
$taskStart=Get-Content -LiteralPath (Join-Path $taskRun 'primary-owned-editor-start.json') -Raw|ConvertFrom-Json
$taskClose=Get-Content -LiteralPath (Join-Path $taskRun 'primary-owned-editor-close.json') -Raw|ConvertFrom-Json
$taskOuter=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'configured-push-01-owned-close.json') -Raw|ConvertFrom-Json
if(-not $taskClose.observedExit -or $taskClose.exitCode -ne 0 -or -not $taskClose.stdoutEOF -or -not $taskClose.stderrEOF -or -not $taskOuter.actualClose -or -not $taskOuter.stdoutEOF -or -not $taskOuter.stderrEOF){throw 'Actual process closure/EOF not established.'}
$taskPid=[int]$taskStart.pid
$taskTag='f26b-configured-push-20261101T081622Z-c6f6d008'
$taskFilter="ProcessId=$taskPid OR ((Name='Code.exe' OR Name='git.exe' OR Name='sh.exe' OR Name='node.exe' OR Name='powershell.exe') AND CommandLine LIKE '%$taskTag%')"
$taskRows=@();foreach($taskIndex in @(1,2)){
 $taskFound=@(Get-CimInstance -ClassName Win32_Process -Filter $taskFilter -Property ProcessId,ParentProcessId,Name,CreationDate)
 if($taskFound.Count){throw 'Known failed fixture PID/profile still present.'}
 $taskStreams=@('primary-stdout.txt','primary-stderr.txt')|ForEach-Object{[ordered]@{file=$_;bytes=(Get-Item -LiteralPath (Join-Path $taskRun $_)).Length;sha256=(Get-FileHash -LiteralPath (Join-Path $taskRun $_) -Algorithm SHA256).Hash.ToLowerInvariant()}}
 $taskRows+=@([ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');pidAbsent=$true;profileMatches=0;streams=$taskStreams});if($taskIndex -eq 1){Start-Sleep -Milliseconds 1200}
}
if(($taskRows[0].streams|ConvertTo-Json -Compress) -cne ($taskRows[1].streams|ConvertTo-Json -Compress)){throw 'Retained streams changed.'}
[ordered]@{status='PASS_POST_FAILURE_KNOWN_PID_AND_PROFILE_ABSENT_TWICE_STREAMS_STABLE_NOT_TEST_ACCEPTANCE';pid=$taskPid;outerPid=$taskOuter.pid;observations=$taskRows;actualCodeNaturalExit=0;outerExit=$taskOuter.exitCode;bothEOFEverywhere=$true;commandLineValuesRetrieved=$false;nestedChildEOF='NOT_INFERRED';signalsRequested=0}|ConvertTo-Json -Depth 9|Out-File -LiteralPath $taskOutput -Encoding utf8 -NoClobber
[ordered]@{status='PASS_FAILED_FIXTURE_ACTUAL_CLOSE_BOTH_EOF_AND_POST_FAILURE_ABSENCE';observations=2;signalsRequested=0}|ConvertTo-Json
