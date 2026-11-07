# Inert additions. Prewarm before Code, witness the exact ROOT listener first,
# then perform the original complete descendant custody in this same owner.
function Assert-F32EarlyRootListenerFacts {
    param($Binding,$Owner,$CodeExecutable,$Root,[DateTime]$RootCreationUtc,$Listeners)
    $taskEndpoint=[Uri]::new($Binding.endpoint)
    if($taskEndpoint.Scheme -cne 'http' -or $taskEndpoint.Host -cne '127.0.0.1' -or $taskEndpoint.Port -lt 1024 -or $taskEndpoint.Port -gt 65535 -or $taskEndpoint.AbsolutePath -cne '/' -or $taskEndpoint.Query -or $taskEndpoint.Fragment -or $taskEndpoint.UserInfo){throw 'F32 exact early numeric loopback required.'}
    if($Owner.status -cne 'STARTED_NOT_COMPLETED' -or $Owner.pid -ne $Binding.codePid -or $Owner.signalsRequested -ne 0 -or $Owner.profile -cne $Binding.profile -or $Owner.workspace -cne $Binding.workspace){throw 'F32 early owned receipt mismatch.'}
    if($Root.ProcessId -ne $Binding.codePid -or $RootCreationUtc.Ticks -ne (Get-F32CreationUtc $Root).Ticks){throw 'F32 early captured root identity mismatch.'}
    if($null -eq $Root.ExecutablePath -or -not $Root.ExecutablePath.Equals($CodeExecutable.path,[StringComparison]::OrdinalIgnoreCase)){throw 'F32 early root executable mismatch.'}
    $taskLaunchUtc=[DateTime]::new(1970,1,1,0,0,0,[DateTimeKind]::Utc).AddMilliseconds([double]$Binding.launchWallMs)
    $taskObserved=[DateTimeOffset]::Parse($Owner.observedAt,[Globalization.CultureInfo]::InvariantCulture).UtcDateTime
    if($RootCreationUtc -lt $taskLaunchUtc.AddSeconds(-2) -or $RootCreationUtc -gt $taskObserved.AddSeconds(2) -or $taskObserved -lt $taskLaunchUtc){throw 'F32 early PID creation not bound to owned spawn.'}
    $taskArguments=Split-F32WindowsArguments $Root.CommandLine
    if($taskArguments.Count -ne (@($Owner.args).Count+1) -or -not $taskArguments[0].Equals($CodeExecutable.path,[StringComparison]::OrdinalIgnoreCase)){throw 'F32 early root arguments differ from captured spawn.'}
    for($taskIndex=0;$taskIndex -lt @($Owner.args).Count;$taskIndex++){
        if($taskArguments[$taskIndex+1] -cne $Owner.args[$taskIndex]){throw 'F32 early exact captured arguments differ.'}
    }
    if(-not (Test-F32ExactProfileArguments -Arguments $taskArguments -Profile $Binding.profile)){throw 'F32 early exact profile missing.'}
    if(@($taskArguments|Where-Object {$_ -ceq '--remote-debugging-address=127.0.0.1'}).Count -ne 1 -or @($taskArguments|Where-Object {$_ -ceq ('--remote-debugging-port='+$taskEndpoint.Port)}).Count -ne 1){throw 'F32 early exact debug flags missing.'}
    $taskRows=@($Listeners)
    if($taskRows.Count -ne 1 -or $taskRows[0].LocalAddress -cne '127.0.0.1' -or $taskRows[0].LocalPort -ne $taskEndpoint.Port -or [int]$taskRows[0].OwningProcess -ne [int]$Binding.codePid){throw 'F32 early listener must belong to exact captured ROOT.'}
    return $RootCreationUtc
}

function Wait-F32EarlyBindingFile {
    param([string]$LiteralPath,[int]$Milliseconds=120000)
    $taskWatch=[Diagnostics.Stopwatch]::StartNew()
    while(-not [IO.File]::Exists($LiteralPath)){
        if($taskWatch.ElapsedMilliseconds -ge $Milliseconds){throw 'F32 reviewed phase binding did not arrive before deadline.'}
        Start-Sleep -Milliseconds 40
    }
}

function Watch-F32EarlyListenerAndFullCustody {
    param([Parameter(Mandatory=$true)][string]$BindingPath,[Parameter(Mandatory=$true)][string]$OutputPath)
    $ErrorActionPreference='Stop'
    $taskInitial=Read-F32InitialBinding -BindingPath $BindingPath
    $taskInitialBinding=$taskInitial.binding
    foreach($taskPath in @($taskInitialBinding.earlyReadyPath,$taskInitialBinding.earlyListenerPath,$taskInitialBinding.listenerPhaseBindingPath,$OutputPath)){
        if(-not (Test-F32ChildPath -Root $taskInitialBinding.gate -Candidate $taskPath) -or [IO.File]::Exists($taskPath)){throw 'F32 fresh same-gate early custody paths required.'}
    }
    $taskLocks=[Collections.Generic.List[object]]::new()
    try{
        # Hash through read-only held handles before Code starts. FileShare.Read
        # prevents replacement/writes until early AND full custody have finished.
        foreach($taskFact in @($taskInitial.vendor.currentHost.executable,$taskInitial.vendor.systemPowerShell)){
            $taskHandle=[IO.File]::Open($taskFact.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
            $taskLocks.Add($taskHandle)
            $taskHasher=[Security.Cryptography.SHA256]::Create()
            try{$taskDigest=([BitConverter]::ToString($taskHasher.ComputeHash($taskHandle))).Replace('-','').ToLowerInvariant()}finally{$taskHasher.Dispose()}
            if($taskHandle.Length -ne $taskFact.bytes -or $taskDigest -cne $taskFact.sha256){throw 'F32 locked prelaunch executable bytes changed.'}
        }
        $taskEndpoint=[Uri]::new($taskInitialBinding.endpoint)
        if($taskEndpoint.Scheme -cne 'http' -or $taskEndpoint.Host -cne '127.0.0.1' -or $taskEndpoint.Port -lt 1024 -or $taskEndpoint.Port -gt 65535 -or $taskEndpoint.AbsolutePath -cne '/' -or $taskEndpoint.Query -or $taskEndpoint.Fragment -or $taskEndpoint.UserInfo){throw 'F32 prewarm exact endpoint required.'}
        # Load the actual TCP cmdlet and perform only the bound future-port
        # absence query. No normal-profile process information is requested.
        $taskBefore=@()
        try{$taskBefore=@(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $taskEndpoint.Port -State Listen -ErrorAction Stop)}
        catch{if($_.FullyQualifiedErrorId -notmatch '^CmdletizationQuery_NotFound'){throw 'F32 prewarm listener query failed.'}}
        if($taskBefore.Count -ne 0){throw 'F32 future endpoint already owned; no Code launch permitted.'}
        [void](Write-F32ExclusiveMetadata -Prepared $taskInitial -OutputPath $taskInitialBinding.earlyReadyPath -Value ([ordered]@{schemaVersion=1;feature='F32';status='PINNED_LOCKED_AND_TCP_PREWARMED_BEFORE_CODE';phase=$taskInitialBinding.phase;profile=$taskInitialBinding.profile;endpoint=$taskInitialBinding.endpoint;vendorReceipt=$taskInitialBinding.vendorReceipt;binding=$taskInitial.bindingFact;observedAt=[DateTime]::UtcNow.ToString('o');signalsRequested=0}))
        Wait-F32EarlyBindingFile -LiteralPath $taskInitialBinding.listenerPhaseBindingPath
        # This reader preserves all original binding/owner checks. Its only
        # difference is reuse of the still-open prelaunch executable hash locks.
        $taskPrepared=Read-F32EarlyCustodyBinding -BindingPath $taskInitialBinding.listenerPhaseBindingPath -LockedInitial $taskInitial -ExecutableLocks $taskLocks
        $taskBinding=$taskPrepared.binding
        foreach($taskKey in @('runRoot','profile','extensions','workspace','gate','observerRoot','phase','endpoint','earlyReadyPath','earlyListenerPath','listenerPhaseBindingPath')){
            if($taskBinding.$taskKey -cne $taskInitialBinding.$taskKey){throw 'F32 early phase changed its prewarmed identity.'}
        }
        $taskRootIdentity=@(Get-CimInstance -Query ('SELECT ProcessId,ParentProcessId,CreationDate FROM Win32_Process WHERE ProcessId='+[int]$taskBinding.codePid) -ErrorAction Stop)
        if($taskRootIdentity.Count -ne 1){throw 'F32 early owned root absent.'}
        $taskRootCreated=Get-F32CreationUtc $taskRootIdentity[0]
        $taskLaunchUtc=[DateTime]::new(1970,1,1,0,0,0,[DateTimeKind]::Utc).AddMilliseconds([double]$taskBinding.launchWallMs)
        $taskOwnerObserved=[DateTimeOffset]::Parse($taskPrepared.owner.observedAt,[Globalization.CultureInfo]::InvariantCulture).UtcDateTime
        if($taskRootCreated -lt $taskLaunchUtc.AddSeconds(-2) -or $taskRootCreated -gt $taskOwnerObserved.AddSeconds(2) -or $taskOwnerObserved -lt $taskLaunchUtc){throw 'F32 early captured creation not bound; no command-line read.'}
        $taskRoot=Get-F32OwnedCodeRecord -OwnedPid ([int]$taskBinding.codePid) -ExpectedCreationUtc $taskRootCreated
        $taskListeners=@(Wait-F32ExactLoopbackListener -Prepared $taskPrepared -LocalPort $taskEndpoint.Port -RootCreationUtc $taskRootCreated -WaitMilliseconds 30000)
        # Recheck PID creation and exact argument identity after listener query.
        $taskRoot=Get-F32OwnedCodeRecord -OwnedPid ([int]$taskBinding.codePid) -ExpectedCreationUtc $taskRootCreated
        [void](Assert-F32EarlyRootListenerFacts -Binding $taskBinding -Owner $taskPrepared.owner -CodeExecutable $taskPrepared.codeExecutable -Root $taskRoot -RootCreationUtc $taskRootCreated -Listeners $taskListeners)
        $taskEarly=[ordered]@{schemaVersion=1;feature='F32';status='CURRENT_OWNED_EXACT_ROOT_LOOPBACK_LISTENER';binding=$taskPrepared.bindingFact;ownerReceipt=$taskBinding.ownerReceipt;vendorReceipt=$taskBinding.vendorReceipt;prewarmedBinding=$taskInitial.bindingFact;rootCodePid=[int]$taskBinding.codePid;rootCreationUtc=$taskRootCreated.ToString('o');codeProcessTreePids=@([int]$taskBinding.codePid);profile=$taskBinding.profile;localAddress='127.0.0.1';localPort=$taskEndpoint.Port;owningProcess=[int]$taskBinding.codePid;observedAt=[DateTime]::UtcNow.ToString('o');exactCapturedArgumentsVerified=$true;executableHashesHeldReadOnly=$true;signals=0;fullDescendantCustody='PENDING_REQUIRED_BEFORE_SUCCESSFUL_CLOSE_OR_PHASE_ACCEPTANCE'}
        [void](Write-F32ExclusiveMetadata -Prepared $taskPrepared -OutputPath $taskBinding.earlyListenerPath -Value $taskEarly)
        # The original function is unchanged: full vendor re-pins, whole captured
        # same-profile tree, fresh listener, identities rechecked at the end.
        return Write-F32ListenerCustody -BindingPath $taskInitialBinding.listenerPhaseBindingPath -OutputPath $OutputPath
    }finally{foreach($taskHandle in $taskLocks){$taskHandle.Dispose()}}
}
