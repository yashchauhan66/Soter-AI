$ErrorActionPreference='Stop'
$taskTag='f26a-precommit-native-20261029T030706Z-967393f7'
$taskNativeClose=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native07-chain-result-01.json') -Raw|ConvertFrom-Json
$taskSerialClose=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'storage-serial-result-09.json') -Raw|ConvertFrom-Json
$taskPostClose=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'storage-postfull-result-09.json') -Raw|ConvertFrom-Json
$taskSerialOwner=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'storage-serial-owner-09.json') -Raw|ConvertFrom-Json
$taskPostOwner=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'storage-postfull-owner-09.json') -Raw|ConvertFrom-Json
$taskKnown=@(@{id=17404;close=$taskNativeClose.observedAt},@{id=20244;close=$taskNativeClose.observedAt},@{id=$taskSerialOwner.pid;close=$taskSerialClose.observedAt},@{id=$taskPostOwner.pid;close=$taskPostClose.observedAt})
$taskPreflightClose=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native08-run-01-owned-close.json') -Raw|ConvertFrom-Json
$taskPreflightOwner=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native08-chain-owner-01.json') -Raw|ConvertFrom-Json
$taskKnown+=@(@{id=$taskPreflightClose.pid;close=$taskPreflightClose.observedAt},@{id=$taskPreflightOwner.pid;close=$taskPreflightClose.observedAt})
$taskObservations=@()
foreach($taskPass in @(1,2)){
 $taskMatches=@();$taskReused=@()
 foreach($taskProcess in @(Get-CimInstance Win32_Process)){
  if($taskProcess.ProcessId -eq $PID){continue}
  if($taskProcess.CommandLine -and $taskProcess.CommandLine.Contains($taskTag)){$taskMatches+=($taskProcess|Select-Object ProcessId,ParentProcessId,Name,CreationDate);continue}
  $taskPrior=@($taskKnown|Where-Object{$_.id -eq $taskProcess.ProcessId})
  if($taskPrior.Count){
   if(-not $taskProcess.CreationDate){throw 'Prior process timestamp unavailable'}
   $taskPossible=$false
   foreach($taskItem in $taskPrior){if($taskProcess.CreationDate.ToUniversalTime() -le [DateTime]::Parse($taskItem.close).ToUniversalTime()){$taskPossible=$true}}
   if($taskPossible){$taskMatches+=($taskProcess|Select-Object ProcessId,ParentProcessId,Name,CreationDate)}else{$taskReused+=($taskProcess|Select-Object ProcessId,ParentProcessId,Name,CreationDate)}
  }
 }
 $taskObservations+=([ordered]@{pass=$taskPass;observedAt=[DateTime]::UtcNow.ToString('o');matchingProcesses=@($taskMatches);reusedAfterPriorClose=@($taskReused)})
}
$taskResult=[ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');scope='TWO_READ_ONLY_PRIOR_NATIVE07_PROFILE_AND_NATIVE_SERIAL_POSTFULL_IDS_WITH_CREATION_TIME';matchingProcesses=@($taskObservations|ForEach-Object{$_.matchingProcesses});observations=$taskObservations;cAvailableBytes=[System.IO.DriveInfo]::new('C:\').AvailableFreeSpace;signalsRequested=0}
$taskResult|ConvertTo-Json -Depth 9|Out-File -LiteralPath (Join-Path $PSScriptRoot 'native08-prior-owner-observation-02.json') -Encoding utf8 -NoClobber
$taskResult|ConvertTo-Json -Depth 9
if(@($taskResult.matchingProcesses).Count){throw 'Possible prior owners retained; no advance'}
