$ErrorActionPreference='Stop'
$taskObservations=@()
foreach($taskIndex in @(1,2)){
    $taskOldRoot=@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction Stop | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('run-affected-05.cjs') });if($taskOldRoot.Count -ne 0){throw 'Prior owned root still present; no signals requested.'}
    $taskMarked=@(Get-CimInstance Win32_Process -Filter "Name='Code.exe'" -ErrorAction Stop | Where-Object {
        $_.CommandLine -and $_.CommandLine.IndexOf('D:\SoterAI-Lite-test-profiles\',[StringComparison]::OrdinalIgnoreCase) -ge 0
    } | Select-Object ProcessId,ParentProcessId,CreationDate)
    $taskObservations+=@{observedAt=[DateTime]::UtcNow.ToString('o');markedCount=$taskMarked.Count;owners=$taskMarked}
    if($taskMarked.Count -ne 0){throw 'A marked isolated Code owner is still present; no launch or signal requested.'}
    if($taskIndex -eq 1){Start-Sleep -Milliseconds 1000}
}
$taskCapacity=Get-CimInstance Win32_OperatingSystem -ErrorAction Stop | Select-Object FreePhysicalMemory,TotalVisibleMemorySize,FreeVirtualMemory,TotalVirtualMemorySize
$taskRecord=@{capacity=$taskCapacity;status='MARKED_SYNTHETIC_CODE_ABSENT_TWICE_NO_SIGNALS';observedAt=[DateTime]::UtcNow.ToString('o');observations=$taskObservations;signalsRequested=0;scope='Current marked synthetic Code owners only; no historical nested closure inference.'}
$taskTarget=Join-Path $PSScriptRoot 'prior-owner-absence-03.json'
$taskStream=[IO.File]::Open($taskTarget,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskRecord|ConvertTo-Json -Depth 10)+[Environment]::NewLine);$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
Write-Output 'PASS: marked isolated Code owners absent twice; no signals.'
