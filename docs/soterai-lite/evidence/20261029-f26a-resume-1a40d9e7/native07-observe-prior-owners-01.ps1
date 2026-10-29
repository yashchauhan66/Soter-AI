$ErrorActionPreference='Stop'
$taskOwnerTag='f26a-precommit-native-20261029T023319Z-238d6ff0'
$taskOwners=@(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and ($_.ProcessId -in @(9148,5376,5208) -or ($_.CommandLine -and $_.CommandLine.Contains($taskOwnerTag))) })
$taskReceipt=[ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');scope='EXACT_PRIOR_NATIVE06_IDS_AND_SYNTHETIC_PROFILE_QUERY_PROCESS_EXCLUDED';matchingProcesses=@($taskOwners|Select-Object ProcessId,ParentProcessId,Name,CreationDate);cAvailableBytes=[System.IO.DriveInfo]::new('C:\').AvailableFreeSpace;signalsRequested=0}
$taskReceipt|ConvertTo-Json -Depth 6|Out-File -LiteralPath (Join-Path $PSScriptRoot 'native07-prior-owner-observation-01.json') -Encoding utf8 -NoClobber
$taskReceipt|ConvertTo-Json -Depth 6
if($taskOwners.Count){throw 'Prior native owner absence not established; do not advance.'}
