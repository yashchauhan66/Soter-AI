param(
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [string]$ExactProfile=''
)
# INERT until root invokes this exact reviewed script. Read-only WMI only.
# No process signal, normal-profile enumeration, environment/token read or CLI.
$ErrorActionPreference='Stop'
$taskPrefix='D:\SoterAI-Lite-test-profiles\'
if(-not [IO.Path]::IsPathRooted($OutputPath) -or [IO.Path]::GetFullPath($OutputPath) -cne $OutputPath -or [IO.Path]::GetDirectoryName($OutputPath) -cne $PSScriptRoot -or [IO.Path]::GetExtension($OutputPath) -cne '.json' -or (Test-Path -LiteralPath $OutputPath)){throw 'A fresh canonical JSON child of this exact evidence directory is required.'}
if($ExactProfile){
    if([IO.Path]::GetFullPath($ExactProfile) -cne $ExactProfile -or -not $ExactProfile.StartsWith($taskPrefix,[StringComparison]::OrdinalIgnoreCase) -or $ExactProfile.Length -le $taskPrefix.Length -or $ExactProfile -match "[%_'\[\]]" -or $ExactProfile.IndexOf([char]0) -ge 0){throw 'Only a canonical marked synthetic exact profile is admissible.'}
}
function Split-SoterAIMarkedWindowsArguments {
    param([Parameter(Mandatory=$true)][string]$CommandLine)
    if($CommandLine.Length -gt 32768 -or $CommandLine.IndexOf([char]0) -ge 0){throw 'Bounded synthetic arguments required.'}
    $taskTokens=[Collections.Generic.List[string]]::new();$taskIndex=0
    while($taskIndex -lt $CommandLine.Length){
        while($taskIndex -lt $CommandLine.Length -and [char]::IsWhiteSpace($CommandLine[$taskIndex])){$taskIndex++}
        if($taskIndex -ge $CommandLine.Length){break}
        $taskQuoted=$false;$taskToken=[Text.StringBuilder]::new()
        while($taskIndex -lt $CommandLine.Length){
            $taskCharacter=$CommandLine[$taskIndex]
            if(-not $taskQuoted -and [char]::IsWhiteSpace($taskCharacter)){break}
            if($taskCharacter -eq '\'){
                $taskSlashes=0
                while($taskIndex -lt $CommandLine.Length -and $CommandLine[$taskIndex] -eq '\'){$taskSlashes++;$taskIndex++}
                if($taskIndex -lt $CommandLine.Length -and $CommandLine[$taskIndex] -eq '"'){
                    [void]$taskToken.Append(('\'*[int][Math]::Floor($taskSlashes/2)))
                    if(($taskSlashes%2) -eq 0){$taskQuoted=-not $taskQuoted}else{[void]$taskToken.Append('"')}
                    $taskIndex++;continue
                }
                [void]$taskToken.Append(('\'*$taskSlashes));continue
            }
            if($taskCharacter -eq '"'){$taskQuoted=-not $taskQuoted;$taskIndex++;continue}
            [void]$taskToken.Append($taskCharacter);$taskIndex++
        }
        if($taskQuoted){throw 'Unmatched synthetic argument quoting; absence not inferred.'}
        $taskTokens.Add($taskToken.ToString());if($taskTokens.Count -gt 256){throw 'Synthetic argument count exceeded.'}
    }
    return ,$taskTokens.ToArray()
}
function Get-SoterAIMarkedProfile {
    param([Parameter(Mandatory=$true)][string[]]$Arguments)
    $taskProfiles=[Collections.Generic.List[string]]::new()
    for($taskIndex=0;$taskIndex -lt $Arguments.Length;$taskIndex++){
        if($Arguments[$taskIndex] -ceq '--user-data-dir'){
            if($taskIndex+1 -ge $Arguments.Length){throw 'Missing marked profile argument; no absence claim.'}
            $taskIndex++;$taskProfiles.Add($Arguments[$taskIndex])
        }elseif($Arguments[$taskIndex].StartsWith('--user-data-dir=',[StringComparison]::Ordinal)){$taskProfiles.Add($Arguments[$taskIndex].Substring(16))}
    }
    if($taskProfiles.Count -eq 0){return $null}
    if($taskProfiles.Count -ne 1){throw 'Ambiguous marked profile arguments; no absence claim.'}
    $taskProfile=$taskProfiles[0]
    if(-not $taskProfile.StartsWith($taskPrefix,[StringComparison]::OrdinalIgnoreCase)){return $null}
    if([IO.Path]::GetFullPath($taskProfile) -cne $taskProfile -or $taskProfile.Length -le $taskPrefix.Length -or $taskProfile.IndexOf([char]0) -ge 0){throw 'Noncanonical marked profile; no absence claim.'}
    if($ExactProfile -and -not $taskProfile.Equals($ExactProfile,[StringComparison]::OrdinalIgnoreCase)){return $null}
    return $taskProfile
}
$taskFilterPath=if($ExactProfile){$ExactProfile}else{$taskPrefix}
$taskFilterLiteral=$taskFilterPath.Replace('\','\\')
$taskQuery="SELECT ProcessId,CreationDate,CommandLine FROM Win32_Process WHERE Name='Code.exe' AND CommandLine LIKE '%"+$taskFilterLiteral+"%'"
$taskObservations=@()
foreach($taskObservationIndex in @(1,2)){
    try{$taskCandidates=@(Get-CimInstance -Query $taskQuery -OperationTimeoutSec 20 -ErrorAction Stop | Select-Object -First 129)}catch{throw 'Marked synthetic ownership query failed; no absence inferred.'}
    if($taskCandidates.Count -gt 128){throw 'Marked synthetic owner row budget exceeded; no absence inferred.'}
    $taskOwners=@()
    foreach($taskCandidate in $taskCandidates){
        if($taskCandidate.CommandLine -isnot [string]){throw 'Marked synthetic command metadata unavailable; no absence inferred.'}
        $taskProfile=Get-SoterAIMarkedProfile -Arguments (Split-SoterAIMarkedWindowsArguments -CommandLine $taskCandidate.CommandLine)
        if($null -ne $taskProfile){
            $taskOwners+=@{pid=[int]$taskCandidate.ProcessId;profile=$taskProfile;creationUtc=if($null -ne $taskCandidate.CreationDate){([DateTime]$taskCandidate.CreationDate).ToUniversalTime().ToString('o')}else{$null}}
        }
    }
    $taskObservations+=@{observedAt=[DateTime]::UtcNow.ToString('o');markedCount=$taskOwners.Count;owners=$taskOwners;filteredCandidateCount=$taskCandidates.Count}
    if($taskObservationIndex -eq 1){Start-Sleep -Milliseconds 1000}
}
$taskAbsent=@($taskObservations|Where-Object{$_.markedCount -ne 0}).Count -eq 0
$taskStatus=if(-not $taskAbsent){'MARKED_SYNTHETIC_CODE_STILL_PRESENT_NO_SIGNALS'}elseif($ExactProfile){'EXACT_SYNTHETIC_CODE_ABSENT_TWICE_NO_SIGNALS'}else{'MARKED_SYNTHETIC_CODE_ABSENT_TWICE_NO_SIGNALS'}
$taskValue=[ordered]@{schemaVersion=1;feature='V01';status=$taskStatus;observedAt=[DateTime]::UtcNow.ToString('o');observations=$taskObservations;signalsRequested=0;environmentReads=0;rawCommandLinesRetained=$false;scope=if($ExactProfile){'ONE_EXACT_SYNTHETIC_PROFILE_ONLY'}else{'MARKED_D_TEST_PROFILE_PREFIX_ONLY'};exactProfile=if($ExactProfile){$ExactProfile}else{$null};syntheticPrefix=$taskPrefix;queryMethod='SERVER_SIDE_NAME_AND_MARKED_PATH_FILTER_THEN_EXACT_ARGV_PROFILE_PARSE';queryRowLimit=128;queryTimeoutSeconds=20;closureLimit='Current marked Code absence only; does not establish historical or nested child close/stdoutEOF/stderrEOF.'}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskValue|ConvertTo-Json -Depth 10)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($OutputPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length);$taskStream.Flush($true)}finally{$taskStream.Dispose()}
Write-Output ($taskStatus+'; no signals; receipt '+$OutputPath)
if(-not $taskAbsent){exit 1}
