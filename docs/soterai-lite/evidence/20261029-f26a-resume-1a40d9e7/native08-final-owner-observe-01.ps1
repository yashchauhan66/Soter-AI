$ErrorActionPreference='Stop'
$taskClose=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native08-chain-result-02.json') -Raw|ConvertFrom-Json
$taskWrapper=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native08-run-02-owned-close.json') -Raw|ConvertFrom-Json
if(-not $taskClose.actualClose -or -not $taskClose.stdoutEOF -or -not $taskClose.stderrEOF){throw 'Actual native08 wrapper close required'}
$taskTag='f26a-precommit-native-20261029T040357Z-82201cb4'
$taskKnown=@(4460,15408,18976,[int]$taskWrapper.pid)
$taskObservations=@()
foreach($taskPass in @(1,2)){
 $taskMatches=@();$taskReused=@()
 foreach($taskProcess in @(Get-CimInstance Win32_Process)){
  if($taskProcess.ProcessId -eq $PID){continue}
  if($taskProcess.CommandLine -and $taskProcess.CommandLine.Contains($taskTag)){$taskMatches+=($taskProcess|Select-Object ProcessId,ParentProcessId,Name,CreationDate);continue}
  if($taskKnown -contains [int]$taskProcess.ProcessId){
   if(-not $taskProcess.CreationDate){throw 'Prior owner timestamp unavailable'}
   if($taskProcess.CreationDate.ToUniversalTime() -le [DateTime]::Parse($taskClose.observedAt).ToUniversalTime()){$taskMatches+=($taskProcess|Select-Object ProcessId,ParentProcessId,Name,CreationDate)}else{$taskReused+=($taskProcess|Select-Object ProcessId,ParentProcessId,Name,CreationDate)}
  }
 }
 $taskObservations+=([ordered]@{pass=$taskPass;observedAt=[DateTime]::UtcNow.ToString('o');matchingProcesses=@($taskMatches);reusedAfterClose=@($taskReused)})
}
$taskResult=[ordered]@{status='READ_ONLY_NATIVE08_FINAL_OWNER_OBSERVATION';observedAt=[DateTime]::UtcNow.ToString('o');matchingProcesses=@($taskObservations|ForEach-Object{$_.matchingProcesses});observations=$taskObservations;signalsRequested=0}
$taskResult|ConvertTo-Json -Depth 8|Out-File -LiteralPath (Join-Path $PSScriptRoot 'native08-final-owner-observation-01.json') -Encoding utf8 -NoClobber
$taskResult|ConvertTo-Json -Depth 8
if(@($taskResult.matchingProcesses).Count){throw 'Possible native08 owners remain; no later native launch'}
