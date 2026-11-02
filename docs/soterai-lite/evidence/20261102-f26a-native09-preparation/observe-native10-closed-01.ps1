$ErrorActionPreference='Stop'
$taskRun=Join-Path $PSScriptRoot 'f26a-precommit-native-20261102T131326Z-691858c5'
$taskStreams=@((Join-Path $taskRun 'primary-stdout.txt'),(Join-Path $taskRun 'primary-stderr.txt'),(Join-Path $PSScriptRoot 'native10-run-01-stdout.bin'),(Join-Path $PSScriptRoot 'native10-run-01-stderr.bin'))
$taskObservations=@()
foreach($taskIndex in @(1,2)){
 if($taskIndex -eq 2){Start-Sleep -Milliseconds 250}
 $taskPids=@();foreach($taskKnownPid in @(18160,16528,18856)){$taskPresent=Get-Process -Id $taskKnownPid -ErrorAction SilentlyContinue;$taskPids+=@{pid=$taskKnownPid;absent=($null -eq $taskPresent)}}
 $taskFacts=@();foreach($taskFile in $taskStreams){$taskFacts+=@{path=$taskFile;bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant()}}
 $taskObservations+=@{observedAt=[DateTime]::UtcNow.ToString('o');pids=$taskPids;streams=$taskFacts}
}
if(@($taskObservations|ForEach-Object{$_.pids}|Where-Object{$_.absent -ne $true}).Count -ne 0){throw 'Known PID present; no absence proof.'}
if(($taskObservations[0].streams|ConvertTo-Json -Compress) -cne ($taskObservations[1].streams|ConvertTo-Json -Compress)){throw 'Retained streams changed.'}
$taskResult=@{status='PASS_KNOWN_CODE_WRAPPER_ROOT_ABSENT_TWICE_STABLE_RETAINED_STREAMS';observations=$taskObservations;signalsRequested=0;limitations='Actual separate Code0 and wrapper1 close/bothEOF receipts remain authoritative; no inferred nested-vendor closure. Synthetic installed hook/flag and encrypted recovery retained; offline/restart recovery not run.'}
$taskFile=Join-Path $PSScriptRoot 'native10-withdrawal-observation-01.json';if(Test-Path -LiteralPath $taskFile){throw 'Observation overwrite refused'}
[IO.File]::WriteAllText($taskFile,($taskResult|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
$taskResult|ConvertTo-Json -Depth 10
