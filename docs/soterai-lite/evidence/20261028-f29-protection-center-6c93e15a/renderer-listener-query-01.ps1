# Read-only custody query for exactly the fresh owned Code process tree/listener.
$ErrorActionPreference='Stop'
$rootId=ROOT_ID
$seen=[System.Collections.Generic.HashSet[int]]::new()
[void]$seen.Add($rootId)
$pending=[System.Collections.Generic.Queue[int]]::new()
$pending.Enqueue($rootId)
$rootProcess=Get-CimInstance Win32_Process -Filter ('ProcessId='+$rootId)
if($null -eq $rootProcess){throw 'Owned root process absent'}
while($pending.Count -gt 0){
    $parentId=$pending.Dequeue()
    foreach($childRecord in @(Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$parentId))){
        $childId=[int]$childRecord.ProcessId
        if($seen.Add($childId)){$pending.Enqueue($childId)}
    }
}
$listener=@(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort PORT_ID -State Listen)
if($listener.Count -ne 1){throw 'One exact numeric loopback listener required'}
$listenerOwner=[int]$listener[0].OwningProcess
if(-not $seen.Contains($listenerOwner)){throw 'Listener outside owned Code tree'}
$value=[ordered]@{schemaVersion=1;feature='F29';localAddress='127.0.0.1';localPort=PORT_ID;profile=PROFILE_PATH;rootCodePid=$rootId;codeProcessTreePids=@($seen);owningProcess=$listenerOwner;observedAt=[DateTime]::UtcNow.ToString('o');signals=0}
$bytes=[Text.Encoding]::UTF8.GetBytes(($value|ConvertTo-Json -Depth 6))
$stream=[IO.File]::Open(OUTPUT_PATH,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
