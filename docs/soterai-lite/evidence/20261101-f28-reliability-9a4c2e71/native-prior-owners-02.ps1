$ErrorActionPreference='Stop'
$taskObservations=@()
foreach($taskIndex in @(1,2)){
 if($taskIndex -eq 2){Start-Sleep -Milliseconds 250}
 # Query only Code command lines already marked as isolated SoterAI fixture paths.
 $taskOwners=@(Get-CimInstance Win32_Process -Filter "Name='Code.exe' AND CommandLine LIKE '%SoterAI-Lite-test-profiles%'"|Where-Object{$_.CommandLine -like '*D:\SoterAI-Lite-test-profiles\*'})
 $taskObservations+=@{observedAt=[DateTime]::UtcNow.ToString('o');ownedCodeCount=$taskOwners.Count;ownedPids=@($taskOwners|ForEach-Object{$_.ProcessId})}
}
$taskResult=@{status=$(if(@($taskObservations|Where-Object{$_.ownedCodeCount -ne 0}).Count -eq 0){'PASS_NO_MARKED_ISOLATED_CODE_OWNERS_TWICE'}else{'INCOMPLETE_MARKED_CODE_OWNER_PRESENT_NO_LAUNCH'});observations=$taskObservations;signalsRequested=0;scope='Marked synthetic Code processes only; not historical unknown Node worker or all-descendant closure proof'}
$taskFile=Join-Path $PSScriptRoot 'native-prior-owner-observation-02.json';if(Test-Path -LiteralPath $taskFile){throw 'Observation overwrite refused.'};[IO.File]::WriteAllText($taskFile,($taskResult|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
if($taskResult.status -cne 'PASS_NO_MARKED_ISOLATED_CODE_OWNERS_TWICE'){throw 'Marked isolated Code owner remains; no native launch.'}
$taskResult|ConvertTo-Json -Depth 10
