$ErrorActionPreference='Stop'
$taskRows=@()
$taskStart=[DateTime]::Parse('2026-11-02T15:32:00Z').ToUniversalTime()
foreach($taskObservation in @(1,2)){
 if($taskObservation -eq 2){Start-Sleep -Milliseconds 250}
 $taskProcesses=@(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name,CreationDate)
 $taskIds=New-Object 'Collections.Generic.HashSet[uint32]'
 [void]$taskIds.Add(19816);[void]$taskIds.Add(7148)
 for($taskDepth=0;$taskDepth -lt 32;$taskDepth++){
  $taskAdded=$false
  foreach($taskProcess in $taskProcesses){if($taskProcess.CreationDate -and $taskProcess.CreationDate.ToUniversalTime() -ge $taskStart -and $taskIds.Contains([uint32]$taskProcess.ParentProcessId) -and -not $taskIds.Contains([uint32]$taskProcess.ProcessId)){[void]$taskIds.Add([uint32]$taskProcess.ProcessId);$taskAdded=$true}}
  if(-not $taskAdded){break}
 }
 $taskOwned=@($taskProcesses|Where-Object{$taskIds.Contains([uint32]$_.ProcessId) -and $_.CreationDate -and $_.CreationDate.ToUniversalTime() -ge $taskStart}|ForEach-Object{@{pid=$_.ProcessId;parent=$_.ParentProcessId;name=$_.Name;created=$_.CreationDate.ToUniversalTime().ToString('o')}})
 $taskStreams=@('full-tests-01-stdout.bin','full-tests-01-stderr.bin')|ForEach-Object{$taskFile=Join-Path $PSScriptRoot $_;@{name=$_;bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant()}}
 $taskRows+=@{observedAt=[DateTime]::UtcNow.ToString('o');owned=$taskOwned;streams=$taskStreams}
}
$taskAbsent=@($taskRows|Where-Object{$_.owned.Count -ne 0}).Count -eq 0
$taskStable=($taskRows[0].streams|ConvertTo-Json -Compress) -ceq ($taskRows[1].streams|ConvertTo-Json -Compress)
$taskResult=@{status=$(if($taskAbsent -and $taskStable){'NO_KNOWN_SURVIVING_OWNED_SUBTREE_TWICE_STREAMS_STABLE_CLOSE_EOF_UNCONFIRMED'}else{'INCOMPLETE_OWNER_OR_STREAM_UNCONFIRMED_NO_NEW_RUN'});observations=$taskRows;originalClose='UNCONFIRMED';originalStdoutEOF='UNCONFIRMED';originalStderrEOF='UNCONFIRMED';originalFullTests='UNVERIFIED_NO_TAP_RESULT';signalsRequested=0}
$taskTarget=Join-Path $PSScriptRoot 'interrupted-full-owner-observation-01.json'
if(Test-Path -LiteralPath $taskTarget){throw 'Evidence overwrite refused.'}
[IO.File]::WriteAllText($taskTarget,($taskResult|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
if(-not $taskAbsent -or -not $taskStable){throw 'Prior owned processes/streams still unconfirmed; no new run.'}
$taskResult|ConvertTo-Json -Depth 20
