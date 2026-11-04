# INERT F32 fixture library. Dot-sourcing defines functions only.
# Read-only CIM/listener observations; no host launch, signal, PID adoption,
# task/debug request, normal profile access or configuration/OS mutation.
# Root must pin these bytes, vendor receipt and immutable phase bindings first.

function Get-F32ReadOnlyFact {
    param([Parameter(Mandatory=$true)][string]$LiteralPath,[long]$MaximumBytes=536870912)
    if(-not [IO.Path]::IsPathRooted($LiteralPath) -or $LiteralPath.StartsWith('\\') -or $LiteralPath.IndexOf([char]0) -ge 0){throw 'F32 fixed file unavailable.'}
    $taskFull=[IO.Path]::GetFullPath($LiteralPath)
    if($taskFull -cne $LiteralPath){throw 'F32 canonical fixed file required.'}
    $taskCursor=$taskFull
    while($true){
        $taskItem=Get-Item -LiteralPath $taskCursor -Force -ErrorAction Stop
        if(($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'F32 linked file or parent withheld.'}
        $taskParent=[IO.Path]::GetDirectoryName($taskCursor)
        if([string]::IsNullOrEmpty($taskParent) -or $taskParent -ceq $taskCursor){break}
        $taskCursor=$taskParent
    }
    $taskBefore=Get-Item -LiteralPath $taskFull -Force -ErrorAction Stop
    if($taskBefore.PSIsContainer -or $taskBefore.Length -lt 0 -or $taskBefore.Length -gt $MaximumBytes){throw 'F32 bounded regular file required.'}
    $taskBeforeLength=[long]$taskBefore.Length;$taskBeforeWrite=$taskBefore.LastWriteTimeUtc.Ticks
    $taskStream=[IO.File]::Open($taskFull,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    $taskHasher=[Security.Cryptography.SHA256]::Create();$taskBuffer=New-Object byte[] 65536;$taskTotal=0L
    try{
        while(($taskCount=$taskStream.Read($taskBuffer,0,$taskBuffer.Length)) -gt 0){
            $taskTotal+=$taskCount;if($taskTotal -gt $MaximumBytes -or $taskTotal -gt $taskBeforeLength){throw 'F32 fixed input changed or exceeded bound.'}
            [void]$taskHasher.TransformBlock($taskBuffer,0,$taskCount,$taskBuffer,0)
        }
        [void]$taskHasher.TransformFinalBlock((New-Object byte[] 0),0,0)
        $taskDigest=([BitConverter]::ToString($taskHasher.Hash)).Replace('-','').ToLowerInvariant()
    }finally{$taskHasher.Dispose();$taskStream.Dispose()}
    $taskAfter=Get-Item -LiteralPath $taskFull -Force -ErrorAction Stop
    if($taskTotal -ne $taskBeforeLength -or $taskAfter.Length -ne $taskBeforeLength -or $taskAfter.LastWriteTimeUtc.Ticks -ne $taskBeforeWrite){throw 'F32 fixed input changed while read.'}
    return [pscustomobject]@{path=$taskFull;bytes=$taskTotal;sha256=$taskDigest}
}

function Read-F32PinnedJson {
    param([Parameter(Mandatory=$true)]$Fact,[long]$MaximumBytes=2097152)
    if($null -eq $Fact -or $Fact.path -isnot [string] -or $Fact.sha256 -cnotmatch '^[0-9a-f]{64}$' -or $Fact.bytes -isnot [ValueType]){throw 'F32 pinned JSON fact required.'}
    $taskMeasured=Get-F32ReadOnlyFact -LiteralPath $Fact.path -MaximumBytes $MaximumBytes
    if($taskMeasured.bytes -ne $Fact.bytes -or $taskMeasured.sha256 -cne $Fact.sha256){throw 'F32 pinned JSON bytes differ.'}
    $taskRaw=[IO.File]::ReadAllBytes($Fact.path)
    if($taskRaw.Length -ne $Fact.bytes){throw 'F32 JSON changed after checked read.'}
    $taskSha=[Security.Cryptography.SHA256]::Create()
    try{$taskDigest=([BitConverter]::ToString($taskSha.ComputeHash($taskRaw))).Replace('-','').ToLowerInvariant()}finally{$taskSha.Dispose()}
    if($taskDigest -cne $Fact.sha256){throw 'F32 JSON changed after checked read.'}
    $taskText=[Text.UTF8Encoding]::new($false,$true).GetString($taskRaw)
    return ConvertFrom-Json -InputObject $taskText -ErrorAction Stop
}

function Test-F32ChildPath {
    param([Parameter(Mandatory=$true)][string]$Root,[Parameter(Mandatory=$true)][string]$Candidate)
    try{
        if($Root -notmatch '^[A-Za-z]:\\' -or $Candidate -notmatch '^[A-Za-z]:\\' -or $Candidate.IndexOf([char]0) -ge 0){return $false}
        if([IO.Path]::GetFullPath($Root) -cne $Root -or [IO.Path]::GetFullPath($Candidate) -cne $Candidate){return $false}
        return $Candidate.StartsWith($Root.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)
    }catch{return $false}
}

function Split-F32WindowsArguments {
    param([Parameter(Mandatory=$true)][string]$CommandLine)
    if($CommandLine.Length -gt 32768 -or $CommandLine.IndexOf([char]0) -ge 0){throw 'F32 bounded owned arguments required.'}
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
        if($taskQuoted){throw 'F32 unmatched owned argument quote.'}
        $taskTokens.Add($taskToken.ToString());if($taskTokens.Count -gt 256){throw 'F32 owned argument count exceeded.'}
    }
    return ,$taskTokens.ToArray()
}

function Test-F32ExactProfileArguments {
    param([Parameter(Mandatory=$true)][string[]]$Arguments,[Parameter(Mandatory=$true)][string]$Profile)
    $taskMatches=[Collections.Generic.List[string]]::new()
    for($taskIndex=0;$taskIndex -lt $Arguments.Length;$taskIndex++){
        $taskArgument=$Arguments[$taskIndex]
        if($taskArgument -ceq '--user-data-dir'){
            if($taskIndex+1 -ge $Arguments.Length){return $false}
            $taskIndex++;$taskMatches.Add($Arguments[$taskIndex])
        }elseif($taskArgument.StartsWith('--user-data-dir=',[StringComparison]::Ordinal)){$taskMatches.Add($taskArgument.Substring(16))}
    }
    if($taskMatches.Count -ne 1){return $false}
    try{return [IO.Path]::GetFullPath($taskMatches[0]) -ceq $taskMatches[0] -and $taskMatches[0].Equals($Profile,[StringComparison]::OrdinalIgnoreCase)}catch{return $false}
}

function Read-F32CustodyBinding {
    param([Parameter(Mandatory=$true)][string]$BindingPath)
    $taskBindingFact=Get-F32ReadOnlyFact -LiteralPath $BindingPath -MaximumBytes 2097152
    $taskBinding=Read-F32PinnedJson -Fact $taskBindingFact
    if($taskBinding.schemaVersion -ne 1 -or $taskBinding.feature -cne 'F32' -or $taskBinding.status -cne 'REVIEWED_ONE_NORMAL_ROUND'){throw 'F32 reviewed immutable phase binding required.'}
    if($taskBinding.runRoot -cnotmatch '^D:\\SoterAI-Lite-test-profiles\\f32-installed-[0-9TZ]+-[a-f0-9]{8}$'){throw 'F32 exact synthetic run root required.'}
    if(-not (Test-F32ChildPath -Root $taskBinding.runRoot -Candidate $taskBinding.profile) -or -not (Test-F32ChildPath -Root $taskBinding.runRoot -Candidate $taskBinding.gate)){throw 'F32 exact isolated profile and gate required.'}
    if($taskBinding.profile -match "[%_'\[\]]" -or -not (Test-F32ChildPath -Root $taskBinding.gate -Candidate $BindingPath)){throw 'F32 marked canonical profile and phase binding required.'}
    if($taskBinding.codePid -isnot [ValueType] -or $taskBinding.codePid -lt 1 -or $taskBinding.codePid -gt 2147483647 -or [int]$taskBinding.codePid -ne $taskBinding.codePid){throw 'F32 captured owned PID required.'}
    if($taskBinding.launchWallMs -isnot [ValueType] -or $taskBinding.launchWallMs -lt 1577836800000){throw 'F32 pre-spawn launch timestamp required.'}
    if(-not (Test-F32ChildPath -Root $taskBinding.gate -Candidate $taskBinding.ownerReceipt.path)){throw 'F32 owner-start receipt must be inside the exact gate.'}
    $taskOwner=Read-F32PinnedJson -Fact $taskBinding.ownerReceipt -MaximumBytes 65536
    if($taskOwner.status -cne 'STARTED_NOT_COMPLETED' -or $taskOwner.pid -ne $taskBinding.codePid -or $taskOwner.signalsRequested -ne 0 -or $taskOwner.profile -cne $taskBinding.profile -or $taskOwner.workspace -cne $taskBinding.workspace){throw 'F32 real owned-start receipt mismatch.'}
    if(-not (Test-F32ExactProfileArguments -Arguments $taskOwner.args -Profile $taskBinding.profile)){throw 'F32 owned-start exact profile argument missing.'}
    $taskVendor=Read-F32PinnedJson -Fact $taskBinding.vendorReceipt
    if($taskVendor.feature -cne 'F32' -or $taskVendor.twoStableObservations -ne $true -or $taskVendor.currentHost.version -cne '1.144.1'){throw 'F32 current public vendor observation required.'}
    $taskExe=$taskVendor.currentHost.executable
    $taskMeasured=Get-F32ReadOnlyFact -LiteralPath $taskExe.path
    if($taskMeasured.bytes -ne $taskExe.bytes -or $taskMeasured.sha256 -cne $taskExe.sha256){throw 'F32 admitted Code executable changed.'}
    $taskPowerShell=$taskVendor.systemPowerShell
    if($taskPowerShell.path -cne 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -or (Join-Path $PSHOME 'powershell.exe') -cne $taskPowerShell.path){throw 'F32 pinned system Windows PowerShell host required.'}
    $taskMeasuredPowerShell=Get-F32ReadOnlyFact -LiteralPath $taskPowerShell.path
    if($taskMeasuredPowerShell.bytes -ne $taskPowerShell.bytes -or $taskMeasuredPowerShell.sha256 -cne $taskPowerShell.sha256){throw 'F32 admitted system PowerShell changed.'}
    return [pscustomobject]@{binding=$taskBinding;bindingFact=$taskBindingFact;owner=$taskOwner;vendor=$taskVendor;codeExecutable=$taskExe}
}

function Get-F32CreationUtc {
    param([Parameter(Mandatory=$true)]$Process)
    if($null -eq $Process.CreationDate){throw 'F32 process creation metadata unavailable.'}
    return ([DateTime]$Process.CreationDate).ToUniversalTime()
}

function Get-F32OwnedCodeRecord {
    param([Parameter(Mandatory=$true)][int]$OwnedPid,[Parameter(Mandatory=$true)][DateTime]$ExpectedCreationUtc)
    # First query only fixed identity/time; do not read any reused PID command line.
    $taskIdentity=@(Get-CimInstance -Query ('SELECT ProcessId,ParentProcessId,CreationDate FROM Win32_Process WHERE ProcessId='+$OwnedPid) -ErrorAction Stop)
    if($taskIdentity.Count -ne 1 -or (Get-F32CreationUtc $taskIdentity[0]).Ticks -ne $ExpectedCreationUtc.Ticks){throw 'F32 known process absent or PID reused; no further owned read.'}
    $taskOwned=@(Get-CimInstance -Query ('SELECT ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine FROM Win32_Process WHERE ProcessId='+$OwnedPid) -ErrorAction Stop)
    if($taskOwned.Count -ne 1 -or (Get-F32CreationUtc $taskOwned[0]).Ticks -ne $ExpectedCreationUtc.Ticks){throw 'F32 owned identity changed during query.'}
    return $taskOwned[0]
}

function Write-F32ExclusiveMetadata {
    param([Parameter(Mandatory=$true)]$Prepared,[Parameter(Mandatory=$true)][string]$OutputPath,[Parameter(Mandatory=$true)]$Value)
    if(-not (Test-F32ChildPath -Root $Prepared.binding.gate -Candidate $OutputPath)){throw 'F32 output must be a fresh child of the exact gate.'}
    $taskParent=[IO.Path]::GetDirectoryName($OutputPath)
    while($true){
        $taskItem=Get-Item -LiteralPath $taskParent -Force -ErrorAction Stop
        if(-not $taskItem.PSIsContainer -or ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'F32 output parent unavailable.'}
        $taskNext=[IO.Path]::GetDirectoryName($taskParent);if([string]::IsNullOrEmpty($taskNext) -or $taskNext -ceq $taskParent){break};$taskParent=$taskNext
    }
    $taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 16)+[Environment]::NewLine)
    if($taskBytes.Length -gt 1048576){throw 'F32 bounded custody metadata required.'}
    $taskStream=[IO.File]::Open($OutputPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try{$taskStream.Write($taskBytes,0,$taskBytes.Length);$taskStream.Flush($true)}finally{$taskStream.Dispose()}
    return Get-F32ReadOnlyFact -LiteralPath $OutputPath -MaximumBytes 1048576
}

function Write-F32ListenerCustody {
    param([Parameter(Mandatory=$true)][string]$BindingPath,[Parameter(Mandatory=$true)][string]$OutputPath)
    $ErrorActionPreference='Stop';$taskPrepared=Read-F32CustodyBinding -BindingPath $BindingPath;$taskBinding=$taskPrepared.binding
    $taskEndpoint=[Uri]::new($taskBinding.endpoint)
    if($taskEndpoint.Scheme -cne 'http' -or $taskEndpoint.Host -cne '127.0.0.1' -or $taskEndpoint.Port -lt 1024 -or $taskEndpoint.Port -gt 65535 -or $taskEndpoint.AbsolutePath -cne '/' -or $taskEndpoint.Query -or $taskEndpoint.Fragment -or $taskEndpoint.UserInfo){throw 'F32 exact numeric loopback endpoint required.'}
    $taskRootIdentity=@(Get-CimInstance -Query ('SELECT ProcessId,ParentProcessId,CreationDate FROM Win32_Process WHERE ProcessId='+[int]$taskBinding.codePid) -ErrorAction Stop)
    if($taskRootIdentity.Count -ne 1){throw 'F32 owned Code root absent.'}
    $taskRootCreated=Get-F32CreationUtc $taskRootIdentity[0]
    $taskEpoch=[DateTime]::new(1970,1,1,0,0,0,[DateTimeKind]::Utc)
    $taskLaunchUtc=$taskEpoch.AddMilliseconds([double]$taskBinding.launchWallMs)
    $taskOwnerObserved=[DateTimeOffset]::Parse($taskPrepared.owner.observedAt,[Globalization.CultureInfo]::InvariantCulture).UtcDateTime
    if($taskRootCreated -lt $taskLaunchUtc.AddSeconds(-2) -or $taskRootCreated -gt $taskOwnerObserved.AddSeconds(2) -or $taskOwnerObserved -lt $taskLaunchUtc){throw 'F32 captured PID creation does not bind this owned spawn.'}
    $taskRoot=Get-F32OwnedCodeRecord -OwnedPid ([int]$taskBinding.codePid) -ExpectedCreationUtc $taskRootCreated
    if(-not $taskRoot.ExecutablePath.Equals($taskPrepared.codeExecutable.path,[StringComparison]::OrdinalIgnoreCase) -or -not (Test-F32ExactProfileArguments -Arguments (Split-F32WindowsArguments $taskRoot.CommandLine) -Profile $taskBinding.profile)){throw 'F32 root Code executable/profile mismatch.'}
    $taskSeen=[Collections.Generic.HashSet[int]]::new();[void]$taskSeen.Add([int]$taskBinding.codePid)
    $taskPending=[Collections.Generic.Queue[object]]::new();$taskPending.Enqueue([pscustomobject]@{pid=[int]$taskBinding.codePid;created=$taskRootCreated;depth=0})
    $taskRows=[Collections.Generic.List[object]]::new();$taskRows.Add([pscustomobject]@{pid=[int]$taskBinding.codePid;parentPid=[int]$taskRoot.ParentProcessId;creationUtc=$taskRootCreated.ToString('o');profileMatch=$true;executableMatch=$true})
    $taskUnadmitted=0;$taskObservedChildren=0
    while($taskPending.Count -gt 0){
        $taskParent=$taskPending.Dequeue();if($taskParent.depth -ge 16){throw 'F32 owned tree depth bound exceeded.'}
        # Parent timestamp is checked again before following descendants.
        [void](Get-F32OwnedCodeRecord -OwnedPid $taskParent.pid -ExpectedCreationUtc $taskParent.created)
        $taskChildren=@(Get-CimInstance -Query ('SELECT ProcessId,ParentProcessId,CreationDate,ExecutablePath FROM Win32_Process WHERE ParentProcessId='+[int]$taskParent.pid) -ErrorAction Stop)
        foreach($taskChild in $taskChildren){
            $taskObservedChildren++;if($taskObservedChildren -gt 128){throw 'F32 owned descendant count bound exceeded.'}
            if($null -eq $taskChild.ExecutablePath -or -not $taskChild.ExecutablePath.Equals($taskPrepared.codeExecutable.path,[StringComparison]::OrdinalIgnoreCase)){$taskUnadmitted++;continue}
            $taskCreated=Get-F32CreationUtc $taskChild
            if($taskCreated -lt $taskParent.created){throw 'F32 descendant PID is older than the captured parent.'}
            $taskOwnedChild=Get-F32OwnedCodeRecord -OwnedPid ([int]$taskChild.ProcessId) -ExpectedCreationUtc $taskCreated
            if($taskOwnedChild.ParentProcessId -ne $taskParent.pid -or -not $taskOwnedChild.ExecutablePath.Equals($taskPrepared.codeExecutable.path,[StringComparison]::OrdinalIgnoreCase)){throw 'F32 descendant ancestry changed.'}
            if(-not (Test-F32ExactProfileArguments -Arguments (Split-F32WindowsArguments $taskOwnedChild.CommandLine) -Profile $taskBinding.profile)){$taskUnadmitted++;continue}
            if(-not $taskSeen.Add([int]$taskOwnedChild.ProcessId)){throw 'F32 repeated process identity in owned tree.'}
            $taskRows.Add([pscustomobject]@{pid=[int]$taskOwnedChild.ProcessId;parentPid=[int]$taskOwnedChild.ParentProcessId;creationUtc=$taskCreated.ToString('o');profileMatch=$true;executableMatch=$true})
            $taskPending.Enqueue([pscustomobject]@{pid=[int]$taskOwnedChild.ProcessId;created=$taskCreated;depth=$taskParent.depth+1})
        }
    }
    $taskListeners=@(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $taskEndpoint.Port -State Listen -ErrorAction Stop)
    if($taskListeners.Count -ne 1 -or $taskListeners[0].LocalAddress -cne '127.0.0.1' -or $taskListeners[0].LocalPort -ne $taskEndpoint.Port){throw 'F32 exactly one numeric loopback listener required.'}
    $taskListenerOwner=[int]$taskListeners[0].OwningProcess
    if(-not $taskSeen.Contains($taskListenerOwner)){throw 'F32 listener outside captured exact-profile Code tree.'}
    foreach($taskRow in $taskRows){[void](Get-F32OwnedCodeRecord -OwnedPid $taskRow.pid -ExpectedCreationUtc ([DateTime]::Parse($taskRow.creationUtc,[Globalization.CultureInfo]::InvariantCulture).ToUniversalTime()))}
    $taskValue=[ordered]@{schemaVersion=1;feature='F32';status='CURRENT_OWNED_EXACT_PROFILE_LOOPBACK_LISTENER';binding=$taskPrepared.bindingFact;ownerReceipt=$taskBinding.ownerReceipt;vendorReceipt=$taskBinding.vendorReceipt;rootCodePid=[int]$taskBinding.codePid;rootCreationUtc=$taskRootCreated.ToString('o');codeProcessTreePids=@($taskSeen);processes=@($taskRows);profile=$taskBinding.profile;localAddress='127.0.0.1';localPort=$taskEndpoint.Port;owningProcess=$taskListenerOwner;observedAt=[DateTime]::UtcNow.ToString('o');signals=0;unadmittedDescendantCount=$taskUnadmitted;scope='Only timestamp-bound same-executable descendants with explicit exact synthetic profile are admitted. Other descendants are unverified, not adopted. No raw command line is retained; custody is not child close/EOF proof.'}
    return Write-F32ExclusiveMetadata -Prepared $taskPrepared -OutputPath $OutputPath -Value $taskValue
}

function Write-F32OwnerAbsence {
    param([Parameter(Mandatory=$true)][string]$BindingPath,[Parameter(Mandatory=$true)][string]$OutputPath)
    $ErrorActionPreference='Stop';$taskPrepared=Read-F32CustodyBinding -BindingPath $BindingPath;$taskBinding=$taskPrepared.binding
    if(-not (Test-F32ChildPath -Root $taskBinding.gate -Candidate $taskBinding.listenerCustody.path) -or -not (Test-F32ChildPath -Root $taskBinding.gate -Candidate $taskBinding.ownerClose.path)){throw 'F32 custody and close receipts must be inside this gate.'}
    $taskCustody=Read-F32PinnedJson -Fact $taskBinding.listenerCustody
    $taskClose=Read-F32PinnedJson -Fact $taskBinding.ownerClose -MaximumBytes 65536
    if($taskCustody.feature -cne 'F32' -or $taskCustody.rootCodePid -ne $taskBinding.codePid -or $taskCustody.profile -cne $taskBinding.profile -or $taskCustody.signals -ne 0){throw 'F32 pinned exact-profile custody mismatch.'}
    if($taskClose.pid -ne $taskBinding.codePid -or $taskClose.actualClose -ne $true -or $taskClose.stdoutEOF -ne $true -or $taskClose.stderrEOF -ne $true -or $taskClose.signalsRequested -ne 0 -or $null -ne $taskClose.signal){throw 'F32 actual owned close and both EOF are required before absence observations.'}
    $taskObservations=@();$taskProfileLiteral=$taskBinding.profile.Replace('\','\\')
    foreach($taskIndex in @(1,2)){
        foreach($taskPid in @($taskCustody.codeProcessTreePids)){
            # A reused PID is conservative refusal; never inspect its new command line.
            $taskPresent=@(Get-CimInstance -Query ('SELECT ProcessId,CreationDate FROM Win32_Process WHERE ProcessId='+[int]$taskPid) -ErrorAction Stop)
            if($taskPresent.Count -ne 0){throw 'F32 captured owned PID still present or reused; no absence claim.'}
        }
        # WMI itself filters to the one synthetic marked profile. Never collect
        # or print unfiltered normal Code process command lines.
        $taskQuery="SELECT ProcessId,ParentProcessId,CreationDate,CommandLine FROM Win32_Process WHERE Name='Code.exe' AND CommandLine LIKE '%"+$taskProfileLiteral+"%'"
        $taskMarkedCandidates=@(Get-CimInstance -Query $taskQuery -ErrorAction Stop)
        if($taskMarkedCandidates.Count -gt 128){throw 'F32 marked owner count bound exceeded.'}
        $taskExactCount=0
        foreach($taskCandidate in $taskMarkedCandidates){
            if(Test-F32ExactProfileArguments -Arguments (Split-F32WindowsArguments $taskCandidate.CommandLine) -Profile $taskBinding.profile){$taskExactCount++}
        }
        if($taskExactCount -ne 0){throw 'F32 exact synthetic profile still has a Code owner; no absence claim.'}
        $taskObservations+=@{observedAt=[DateTime]::UtcNow.ToString('o');capturedPidsAbsent=$true;exactSyntheticProfileOwnerCount=$taskExactCount}
        if($taskIndex -eq 1){Start-Sleep -Milliseconds 1000}
    }
    $taskValue=[ordered]@{schemaVersion=1;feature='F32';status='CAPTURED_CODE_PIDS_AND_EXACT_PROFILE_ABSENT_TWICE_AFTER_ACTUAL_CLOSE_AND_BOTH_EOF';binding=$taskPrepared.bindingFact;ownerReceipt=$taskBinding.ownerReceipt;ownerClose=$taskBinding.ownerClose;listenerCustody=$taskBinding.listenerCustody;rootCodePid=[int]$taskBinding.codePid;profile=$taskBinding.profile;observations=$taskObservations;signalsRequested=0;scope='Absence of declared captured exact-profile Code owners only. Earlier assertion/deadline failures remain failures. Unadmitted/nested/vendor child closure and both EOF are not inferred.'}
    return Write-F32ExclusiveMetadata -Prepared $taskPrepared -OutputPath $OutputPath -Value $taskValue
}
