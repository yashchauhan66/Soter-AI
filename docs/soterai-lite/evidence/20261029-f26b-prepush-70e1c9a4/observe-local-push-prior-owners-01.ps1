$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'));$taskOutput=Join-Path $PSScriptRoot 'configured-push-prior-owner-observation-01.json'
if(Test-Path -LiteralPath $taskOutput){throw 'Evidence overwrite refused.'}
$taskAccepted=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'affected-native12-acceptance-01.json') -Raw -Encoding utf8|ConvertFrom-Json
$taskTags=New-Object 'System.Collections.Generic.HashSet[string]';$taskIdentities=@()
foreach($taskFamily in $taskAccepted.families){[void]$taskTags.Add($taskFamily.run)}
[void]$taskTags.Add('f26b-prepush-native-20261101T065751Z-1999e2f2')
foreach($taskFact in $taskAccepted.evidence){if($taskFact.path.EndsWith('-helper-pipe-ownership.json') -or $taskFact.path.EndsWith('/helper-pipe-ownership.json')){$taskClose=Get-Content -LiteralPath (Join-Path $taskRepo $taskFact.path) -Raw -Encoding utf8|ConvertFrom-Json;if($taskClose.pid -and $taskClose.time -and $taskFact.path -match '([0-9]{8}T[0-9]{6}Z)'){$taskFrom=[DateTime]::ParseExact($Matches[1],'yyyyMMddTHHmmssZ',[Globalization.CultureInfo]::InvariantCulture).ToUniversalTime().AddSeconds(-3);$taskUntil=[DateTime]::Parse($taskClose.time).ToUniversalTime().AddSeconds(2);$taskIdentities+=@([pscustomobject]@{pid=[int]$taskClose.pid;from=$taskFrom;until=$taskUntil})}}}
$taskContinuation=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'functional-security-source03-continuation-01.json') -Raw -Encoding utf8|ConvertFrom-Json
foreach($taskDirectory in $taskContinuation.result.directories){$taskRoot=Join-Path $PSScriptRoot $taskDirectory;foreach($taskFreeze in Get-ChildItem -LiteralPath $taskRoot -File -Recurse -Filter 'freeze.json'){$taskFreezeValue=Get-Content -LiteralPath $taskFreeze.FullName -Raw -Encoding utf8|ConvertFrom-Json;foreach($taskProperty in $taskFreezeValue.PSObject.Properties){if($taskProperty.Value -is [string] -and $taskProperty.Value -match '^D:[\\/]SoterAI-Lite-test-profiles[\\/]([^\\/]+)'){[void]$taskTags.Add($Matches[1])}}}}
$taskIds=@($taskIdentities|ForEach-Object{$_.pid}|Sort-Object -Unique);if($taskIds.Count -lt 37 -or $taskIds.Count -gt 256){throw 'Bounded prior Code identity inventory differs.'}
$taskPidFilter='('+(@($taskIds|ForEach-Object{'ProcessId='+$_}) -join ' OR ')+')'
$taskProfileClauses=@($taskTags|ForEach-Object{if($_ -cnotmatch '^[a-zA-Z0-9_-]+$'){throw 'Unsafe synthetic profile tag.'};"CommandLine LIKE '%"+$_+"%'"})
$taskProfileFilter="(Name='Code.exe' OR Name='git.exe' OR Name='sh.exe' OR Name='node.exe' OR Name='powershell.exe') AND ("+($taskProfileClauses -join ' OR ')+')'
$taskObservations=@();for($taskIndex=0;$taskIndex -lt 2;$taskIndex++){
 $taskPidRows=@(Get-CimInstance -ClassName Win32_Process -Filter $taskPidFilter -Property ProcessId,ParentProcessId,Name,CreationDate)
 $taskMatched=@($taskPidRows|Where-Object{$taskProcess=$_;@($taskIdentities|Where-Object{$_.pid -eq $taskProcess.ProcessId -and $taskProcess.CreationDate.ToUniversalTime() -ge $_.from -and $taskProcess.CreationDate.ToUniversalTime() -le $_.until}).Count -gt 0}|Select-Object ProcessId,ParentProcessId,Name,CreationDate)
 $taskProfiles=@(Get-CimInstance -ClassName Win32_Process -Filter $taskProfileFilter -Property ProcessId,ParentProcessId,Name,CreationDate|Select-Object ProcessId,ParentProcessId,Name,CreationDate)
 if($taskMatched.Count -or $taskProfiles.Count){throw 'Prior known Code identity or synthetic profile process still present; no local-push launch.'}
 $taskObservations+=@([ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');knownIdentityRows=$taskMatched;currentProfileRows=$taskProfiles});if($taskIndex -eq 0){Start-Sleep -Milliseconds 1200}
}
[ordered]@{status='PASS_TWO_CURRENT_PRIOR_ACCEPTED_CODE_IDENTITY_AND_PROFILE_ABSENCE_OBSERVATIONS';observations=$taskObservations;knownCodePids=$taskIds.Count;profileTags=$taskTags.Count;commandLineValuesRetrieved=$false;historicalNestedChildEOF='NOT_INFERRED';signalsRequested=0}|ConvertTo-Json -Depth 8|Out-File -LiteralPath $taskOutput -Encoding utf8 -NoClobber
[ordered]@{status='PASS_PRIOR_ACCEPTED_CODE_IDENTITIES_AND_PROFILE_MATCHES_ABSENT';observations=2;knownCodePids=$taskIds.Count;profileTags=$taskTags.Count;signalsRequested=0}|ConvertTo-Json
