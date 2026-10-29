$ErrorActionPreference='Stop'
$taskOwnerTag='f26a-precommit-native-20261029T023319Z-238d6ff0'
$taskPriorClose=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native06-chain-result-01.json') -Raw|ConvertFrom-Json
$taskCloseUtc=[DateTime]::Parse($taskPriorClose.observedAt).ToUniversalTime()
$taskObservations=@()
foreach($taskPass in @(1,2)){
 $taskMatches=@();$taskReused=@()
 foreach($taskProcess in @(Get-CimInstance Win32_Process)){
  if($taskProcess.ProcessId -eq $PID){continue}
  $taskProfileMatch=$taskProcess.CommandLine -and $taskProcess.CommandLine.Contains($taskOwnerTag)
  if($taskProfileMatch){$taskMatches+=($taskProcess|Select-Object ProcessId,ParentProcessId,Name,CreationDate);continue}
  if($taskProcess.ProcessId -in @(9148,5376,5208)){
   if(-not $taskProcess.CreationDate){throw 'Process identity timestamp unavailable'}
   if($taskProcess.CreationDate.ToUniversalTime() -gt $taskCloseUtc){$taskReused+=($taskProcess|Select-Object ProcessId,ParentProcessId,Name,CreationDate)}
   else{$taskMatches+=($taskProcess|Select-Object ProcessId,ParentProcessId,Name,CreationDate)}
  }
 }
 $taskObservations+=([ordered]@{pass=$taskPass;observedAt=[DateTime]::UtcNow.ToString('o');matchingProcesses=@($taskMatches);reusedAfterPriorObservedClose=@($taskReused)})
}
$taskReceipt=[ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');scope='EXACT_PRIOR_PROFILE_PLUS_PID_AND_CREATION_TIME_TWO_READ_ONLY_OBSERVATIONS';priorActualClose=$taskPriorClose.observedAt;matchingProcesses=@($taskObservations|ForEach-Object{$_.matchingProcesses});observations=$taskObservations;cAvailableBytes=[System.IO.DriveInfo]::new('C:\').AvailableFreeSpace;signalsRequested=0;previous='01 stopped on reused PID5208 git.exe created03:04:59Z after native06 closed02:34:54Z. Approval and attempt were unconsumed; unrelated process untouched.'}
$taskReceipt|ConvertTo-Json -Depth 9|Out-File -LiteralPath (Join-Path $PSScriptRoot 'native07-prior-owner-observation-02.json') -Encoding utf8 -NoClobber
$taskReceipt|ConvertTo-Json -Depth 9
if(@($taskReceipt.matchingProcesses).Count){throw 'Possible prior native owner retained; no advance'}
