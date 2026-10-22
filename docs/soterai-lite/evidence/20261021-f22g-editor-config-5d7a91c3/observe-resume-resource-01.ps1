$ErrorActionPreference='Stop'
$taskOs=Get-CimInstance Win32_OperatingSystem
$taskReport=@{status='OBSERVED_NOT_OOM_RESOLUTION_PROOF';checkedAt=[DateTime]::UtcNow.ToString('o');totalPhysicalKiB=[long]$taskOs.TotalVisibleMemorySize;freePhysicalKiB=[long]$taskOs.FreePhysicalMemory;totalVirtualKiB=[long]$taskOs.TotalVirtualMemorySize;freeVirtualKiB=[long]$taskOs.FreeVirtualMemory;signalsRequested=0;osChanges=0;scope='Aggregate observation only, no cause/resolution or user-action inference.'}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskReport|ConvertTo-Json -Depth 8)+[Environment]::NewLine)
$taskHandle=[IO.File]::Open((Join-Path $PSScriptRoot 'resume-resource-observation-01.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskHandle.Write($taskBytes,0,$taskBytes.Length)}finally{$taskHandle.Dispose()}
$taskReport|ConvertTo-Json -Depth 8
