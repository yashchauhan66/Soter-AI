$ErrorActionPreference='Stop'
$taskOutput=Join-Path $PSScriptRoot 'native-final-owner-observation-11.json'
if(Test-Path -LiteralPath $taskOutput){throw 'Evidence overwrite refused.'}
$taskRun='f26b-prepush-native-20261101T060429Z-575ce4ea'
$taskJournal=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskRun+'/primary.progress.jsonl')) | ForEach-Object {$_|ConvertFrom-Json}
$taskKnownPids=@(22876,2920)+@($taskJournal | ForEach-Object {$_.hostPid;if($_.pid){$_.pid}})|Sort-Object -Unique
$taskWindowStart=[DateTime]::Parse('2026-11-01T06:03:51Z').ToUniversalTime()
$taskWindowEnd=[DateTime]::Parse('2026-11-01T06:10:40Z').ToUniversalTime()
$taskObservations=@()
for($taskIndex=0;$taskIndex -lt 2;$taskIndex++){
 $taskProcesses=@(Get-CimInstance -ClassName Win32_Process -Filter "Name='Code.exe' OR Name='git.exe' OR Name='sh.exe' OR Name='node.exe' OR Name='powershell.exe'")
 $taskKnown=@($taskProcesses|Where-Object{ $_.ProcessId -in $taskKnownPids -and $_.CreationDate -and $_.CreationDate.ToUniversalTime() -ge $taskWindowStart -and $_.CreationDate.ToUniversalTime() -le $taskWindowEnd }|Select-Object ProcessId,ParentProcessId,Name,CreationDate)
 $taskAssociated=@($taskProcesses|Where-Object{ $_.CommandLine -and $_.CommandLine.IndexOf($taskRun,[StringComparison]::OrdinalIgnoreCase) -ge 0 }|Select-Object ProcessId,ParentProcessId,Name,CreationDate)
 if($taskKnown.Count -or $taskAssociated.Count){throw 'Native11 historical known identity/profile process still present; no new native launch.'}
 $taskObservations+=@([ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');knownHistoricalIdentityRows=$taskKnown;currentlyAssociatedProcessRows=$taskAssociated;outerStdoutSha256=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'native-component-11-stdout.bin') -Algorithm SHA256).Hash.ToLowerInvariant();outerStderrSha256=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'native-component-11-stderr.bin') -Algorithm SHA256).Hash.ToLowerInvariant();codeStdoutSha256=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot ($taskRun+'/primary-stdout.txt')) -Algorithm SHA256).Hash.ToLowerInvariant();codeStderrSha256=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot ($taskRun+'/primary-stderr.txt')) -Algorithm SHA256).Hash.ToLowerInvariant()})
 if($taskIndex -eq 0){Start-Sleep -Milliseconds 1200}
}
foreach($taskField in @('outerStdoutSha256','outerStderrSha256','codeStdoutSha256','codeStderrSha256')){if($taskObservations[0].$taskField -cne $taskObservations[1].$taskField){throw 'Closed native11 streams changed.'}}
[ordered]@{status='PASS_TWO_CURRENT_NATIVE11_KNOWN_IDENTITY_PROFILE_ABSENCE_AND_STABLE_STREAMS';observations=$taskObservations;knownPidCount=$taskKnownPids.Count;signalsRequested=0;primaryChecks=30;restart='NOT_RUN';hookRestore='NOT_RUN_RETAINED_ISOLATED_STATE';listenerCloseCallback='NOT_INFERRED'}|ConvertTo-Json -Depth 8|Out-File -LiteralPath $taskOutput -Encoding utf8 -NoClobber
[ordered]@{status='PASS_NATIVE11_KNOWN_IDENTITIES_PROFILE_ABSENT_STREAMS_STABLE';observations=2;knownPids=$taskKnownPids.Count;signalsRequested=0}|ConvertTo-Json
