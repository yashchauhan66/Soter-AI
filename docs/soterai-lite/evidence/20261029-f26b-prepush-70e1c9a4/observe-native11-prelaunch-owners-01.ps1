$ErrorActionPreference='Stop'
$taskOutput=Join-Path $PSScriptRoot 'native11-prelaunch-owner-observation-01.json'
if(Test-Path -LiteralPath $taskOutput){throw 'Evidence overwrite refused.'}
$taskPriorRun='f26b-prepush-native-20261030T041706Z-e226efe3'
$taskWindowStart=[DateTime]::Parse('2026-10-30T04:16:19Z').ToUniversalTime()
$taskWindowEnd=[DateTime]::Parse('2026-10-30T04:20:46Z').ToUniversalTime()
$taskObservations=@()
for($taskIndex=0;$taskIndex -lt 2;$taskIndex++){
 $taskProcesses=@(Get-CimInstance -ClassName Win32_Process -Filter "Name='Code.exe' OR Name='git.exe' OR Name='sh.exe' OR Name='node.exe' OR Name='powershell.exe'")
 $taskKnown=@($taskProcesses|Where-Object{ $_.ProcessId -in @(23848,28888,17888,21740) -and $_.CreationDate -and $_.CreationDate.ToUniversalTime() -ge $taskWindowStart -and $_.CreationDate.ToUniversalTime() -le $taskWindowEnd }|Select-Object ProcessId,ParentProcessId,Name,CreationDate)
 $taskAssociated=@($taskProcesses|Where-Object{ $_.CommandLine -and $_.CommandLine.IndexOf($taskPriorRun,[StringComparison]::OrdinalIgnoreCase) -ge 0 }|Select-Object ProcessId,ParentProcessId,Name,CreationDate)
 if($taskKnown.Count -or $taskAssociated.Count){throw 'Prior native10 known identity/profile process still present; no new native launch.'}
 $taskObservations+=@([ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');knownHistoricalIdentityRows=$taskKnown;currentlyAssociatedProcessRows=$taskAssociated})
 if($taskIndex -eq 0){Start-Sleep -Milliseconds 1200}
}
[ordered]@{status='PASS_TWO_CURRENT_NATIVE10_IDENTITY_PROFILE_ABSENCE_OBSERVATIONS_NOT_HISTORICAL_CHILD_CLOSURE';observations=$taskObservations;signalsRequested=0;historicalGitShDirectClientEOF='NOT_OBSERVED_NOT_INFERRED';doesNotRegradeNative10OrInferHookWithdrawal=$true}|ConvertTo-Json -Depth 8|Out-File -LiteralPath $taskOutput -Encoding utf8 -NoClobber
[ordered]@{status='PASS_PRIOR_KNOWN_NATIVE10_IDENTITIES_AND_CURRENT_PROFILE_MATCHES_ABSENT';observations=2;signalsRequested=0;historicalChildEOF='UNKNOWN'}|ConvertTo-Json
