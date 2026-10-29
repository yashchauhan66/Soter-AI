$ErrorActionPreference='Stop'
$taskOwnerTag='f26a-precommit-native-20261029T023319Z-238d6ff0'
$taskOwners=@(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and ($_.ProcessId -in @(9148,5376,5208) -or ($_.CommandLine -and $_.CommandLine.Contains($taskOwnerTag))) })
$taskReceipt=[ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');scope='EXACT_PRIOR_OWNER_IDS_AND_SYNTHETIC_PROFILE_ONLY_QUERY_PROCESS_EXCLUDED';ownerIds=@(9148,5376,5208);matchingProcesses=@($taskOwners|Select-Object ProcessId,ParentProcessId,Name,CreationDate);cAvailableBytes=[System.IO.DriveInfo]::new('C:\').AvailableFreeSpace;signalsRequested=0;previousObservation='03 captured its own query process10868 because the profile literal appeared in its command line; not an old Code owner or product failure'}
$taskReceipt|ConvertTo-Json -Depth 6|Out-File -LiteralPath (Join-Path $PSScriptRoot 'native06-postclose-owner-observation-04.json') -Encoding utf8 -NoClobber
$taskReceipt|ConvertTo-Json -Depth 6
