# INERT F32 restart-only broker fixture library. Dot-source the exact reviewed
# installed-owner-custody-proposed-04.ps1 first. No top-level IO/query/launch.
# Exact current installed script/Code child ancestry only; no environment/token
# read, process signal, loader interception or product instrumentation.

function Test-F32ExactBrokerArguments {
    param([Parameter(Mandatory=$true)][string[]]$Arguments,[Parameter(Mandatory=$true)][string]$CodeExecutable,[Parameter(Mandatory=$true)][string]$ScriptPath)
    if($Arguments.Length -ne 2){return $false}
    try{
        return [IO.Path]::GetFullPath($Arguments[0]) -ceq $Arguments[0] -and [IO.Path]::GetFullPath($Arguments[1]) -ceq $Arguments[1] -and $Arguments[0].Equals($CodeExecutable,[StringComparison]::OrdinalIgnoreCase) -and $Arguments[1].Equals($ScriptPath,[StringComparison]::OrdinalIgnoreCase)
    }catch{return $false}
}

function Read-F32BrokerBinding {
    param([Parameter(Mandatory=$true)][string]$BindingPath)
    $taskPrepared=Read-F32CustodyBinding -BindingPath $BindingPath;$taskBinding=$taskPrepared.binding
    if($taskBinding.phase -cne 'restart' -or $taskBinding.product.id -cne 'soterai.soterai-ide-guard' -or $taskBinding.product.version -isnot [string]){throw 'F32 actual broker observation is restricted to reviewed restart stage.'}
    if(-not (Test-F32ChildPath -Root $taskBinding.runRoot -Candidate $taskBinding.extensions)){throw 'F32 exact installed extensions directory required.'}
    if(-not (Test-F32ChildPath -Root $taskBinding.extensions -Candidate $taskBinding.expectedBrokerScript.path)){throw 'F32 broker script must be under exact isolated extensions directory.'}
    $taskScriptPath=$taskBinding.expectedBrokerScript.path
    if([IO.Path]::GetFileName($taskScriptPath) -cne 'local-ai-broker.js' -or [IO.Path]::GetFileName([IO.Path]::GetDirectoryName($taskScriptPath)) -cne 'dist'){throw 'F32 only installed product broker runtime is admitted.'}
    $taskProductDirectory=[IO.Path]::GetDirectoryName([IO.Path]::GetDirectoryName($taskScriptPath))
    if([IO.Path]::GetDirectoryName($taskProductDirectory) -cne $taskBinding.extensions){throw 'F32 broker product must be a direct installed extension child.'}
    $taskProductName=[IO.Path]::GetFileName($taskProductDirectory)
    $taskExpectedProductPattern='^'+[regex]::Escape($taskBinding.product.id)+'-'+[regex]::Escape($taskBinding.product.version)+'(?:-win32-x64)?$'
    if($taskProductName -cnotmatch $taskExpectedProductPattern){throw 'F32 installed product identity/version directory mismatch.'}
    $taskScriptFact=Get-F32ReadOnlyFact -LiteralPath $taskScriptPath -MaximumBytes 67108864
    if($taskScriptFact.bytes -ne $taskBinding.expectedBrokerScript.bytes -or $taskScriptFact.sha256 -cne $taskBinding.expectedBrokerScript.sha256){throw 'F32 installed broker bytes differ from current VSIX runtime authority.'}
    foreach($taskFact in @($taskBinding.listenerCustody,$taskBinding.brokerStartReceipt)){
        if(-not (Test-F32ChildPath -Root $taskBinding.gate -Candidate $taskFact.path)){throw 'F32 exact gate custody/start receipt required.'}
    }
    $taskCodeCustody=Read-F32PinnedJson -Fact $taskBinding.listenerCustody
    if($taskCodeCustody.feature -cne 'F32' -or $taskCodeCustody.status -cne 'CURRENT_OWNED_EXACT_PROFILE_LOOPBACK_LISTENER' -or $taskCodeCustody.rootCodePid -ne $taskBinding.codePid -or $taskCodeCustody.profile -cne $taskBinding.profile -or $taskCodeCustody.signals -ne 0 -or $taskCodeCustody.ownerReceipt.sha256 -cne $taskBinding.ownerReceipt.sha256 -or $taskCodeCustody.vendorReceipt.sha256 -cne $taskBinding.vendorReceipt.sha256){throw 'F32 exact current Code custody required before broker observation.'}
    $taskBrokerStarted=Read-F32PinnedJson -Fact $taskBinding.brokerStartReceipt -MaximumBytes 65536
    if($taskBrokerStarted.schemaVersion -ne 1 -or $taskBrokerStarted.feature -cne 'F32' -or $taskBrokerStarted.phase -cne 'restart' -or $taskBrokerStarted.status -cne 'PUBLIC_HEALTHY_EXTERNAL_CUSTODY_PENDING' -or $taskBrokerStarted.signalsRequested -ne 0 -or $taskBrokerStarted.nonce -cnotmatch '^[0-9a-f]{32}$' -or $taskBrokerStarted.nonce -cne $taskBinding.brokerNonce -or $taskBrokerStarted.configuredPort -ne $taskBinding.configuredBrokerPort){throw 'F32 exact fresh broker start protocol required.'}
    if($taskBrokerStarted.observerPid -isnot [ValueType] -or $taskBrokerStarted.observerPid -lt 1 -or $taskBrokerStarted.observerPid -gt 2147483647 -or [int]$taskBrokerStarted.observerPid -ne $taskBrokerStarted.observerPid -or @($taskCodeCustody.processes|Where-Object{$_.pid -eq $taskBrokerStarted.observerPid}).Count -ne 1){throw 'F32 public observer must be within the admitted exact-profile Code tree.'}
    if($taskBrokerStarted.state -cne 'healthy' -or $taskBrokerStarted.running -ne $true -or $taskBrokerStarted.version -cne '0.2.0' -or $taskBrokerStarted.port -isnot [ValueType] -or $taskBrokerStarted.port -lt 1024 -or $taskBrokerStarted.port -gt 65535 -or [int]$taskBrokerStarted.port -ne $taskBrokerStarted.port){throw 'F32 actual public healthy broker observation required.'}
    if($taskBrokerStarted.script.path -cne $taskScriptFact.path -or $taskBrokerStarted.script.bytes -ne $taskScriptFact.bytes -or $taskBrokerStarted.script.sha256 -cne $taskScriptFact.sha256){throw 'F32 public broker start metadata does not match admitted installed runtime.'}
    if($taskBrokerStarted.startRequestedWallMs -isnot [ValueType] -or $taskBrokerStarted.startRequestedWallMs -lt $taskBinding.launchWallMs){throw 'F32 explicit before-start request timestamp required.'}
    $taskEpoch=[DateTime]::new(1970,1,1,0,0,0,[DateTimeKind]::Utc)
    $taskRequestUtc=$taskEpoch.AddMilliseconds([double]$taskBrokerStarted.startRequestedWallMs)
    $taskStartedObservedUtc=[DateTimeOffset]::Parse($taskBrokerStarted.observedAt,[Globalization.CultureInfo]::InvariantCulture).UtcDateTime
    if($taskStartedObservedUtc -lt $taskRequestUtc -or $taskStartedObservedUtc -gt [DateTime]::UtcNow.AddSeconds(2)){throw 'F32 broker start observation has invalid timing.'}
    return [pscustomobject]@{binding=$taskBinding;bindingFact=$taskPrepared.bindingFact;owner=$taskPrepared.owner;vendor=$taskPrepared.vendor;codeExecutable=$taskPrepared.codeExecutable;script=$taskScriptFact;codeCustody=$taskCodeCustody;brokerStarted=$taskBrokerStarted;requestUtc=$taskRequestUtc;startedObservedUtc=$taskStartedObservedUtc}
}

function Get-F32ExactBrokerListeners {
    param([Parameter(Mandatory=$true)][int]$LocalPort)
    if($LocalPort -lt 1024 -or $LocalPort -gt 65535){throw 'F32 exact broker port bound required.'}
    try{
        return @(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $LocalPort -State Listen -ErrorAction Stop)
    }catch{
        if($_.FullyQualifiedErrorId -notmatch '^CmdletizationQuery_NotFound'){throw 'F32 broker listener query failed; no retry or external request.'}
        return @()
    }
}

function Write-F32BrokerCustody {
    param([Parameter(Mandatory=$true)][string]$BindingPath,[Parameter(Mandatory=$true)][string]$OutputPath)
    $ErrorActionPreference='Stop';$taskPrepared=Read-F32BrokerBinding -BindingPath $BindingPath;$taskBinding=$taskPrepared.binding
    $taskCandidates=[Collections.Generic.List[object]]::new();$taskSeen=[Collections.Generic.HashSet[int]]::new();$taskExamined=0
    $taskParents=@($taskPrepared.codeCustody.processes)
    if($taskParents.Count -lt 1 -or $taskParents.Count -gt 129){throw 'F32 bounded captured Code parent metadata required.'}
    foreach($taskParent in $taskParents){
        if($taskParent.profileMatch -ne $true -or $taskParent.executableMatch -ne $true -or $taskParent.pid -isnot [ValueType] -or $taskParent.pid -lt 1 -or $taskParent.pid -gt 2147483647 -or [int]$taskParent.pid -ne $taskParent.pid -or -not $taskSeen.Add([int]$taskParent.pid)){throw 'F32 exact profile Code parent metadata invalid.'}
        $taskParentCreation=[DateTimeOffset]::Parse($taskParent.creationUtc,[Globalization.CultureInfo]::InvariantCulture).UtcDateTime
        $taskCurrentParent=Get-F32OwnedCodeRecord -OwnedPid ([int]$taskParent.pid) -ExpectedCreationUtc $taskParentCreation
        if(-not $taskCurrentParent.ExecutablePath.Equals($taskPrepared.codeExecutable.path,[StringComparison]::OrdinalIgnoreCase)){throw 'F32 captured Code parent executable changed.'}
        $taskChildren=@(Get-CimInstance -Query ('SELECT ProcessId,ParentProcessId,CreationDate,ExecutablePath FROM Win32_Process WHERE ParentProcessId='+[int]$taskParent.pid) -ErrorAction Stop)
        foreach($taskChild in $taskChildren){
            $taskExamined++;if($taskExamined -gt 256){throw 'F32 bounded broker-child observation exceeded.'}
            if($null -eq $taskChild.ExecutablePath -or -not $taskChild.ExecutablePath.Equals($taskPrepared.codeExecutable.path,[StringComparison]::OrdinalIgnoreCase)){continue}
            $taskCreated=Get-F32CreationUtc $taskChild
            if($taskCreated -lt $taskParentCreation){throw 'F32 child creation predates its captured parent.'}
            if($taskCreated -lt $taskPrepared.requestUtc.AddSeconds(-2) -or $taskCreated -gt $taskPrepared.startedObservedUtc.AddSeconds(2)){continue}
            # Only a timestamp-bound same-Code-executable owned descendant has
            # its command line inspected. Never inspect environment variables.
            $taskOwnedChild=Get-F32OwnedCodeRecord -OwnedPid ([int]$taskChild.ProcessId) -ExpectedCreationUtc $taskCreated
            if($taskOwnedChild.ParentProcessId -ne $taskParent.pid -or -not $taskOwnedChild.ExecutablePath.Equals($taskPrepared.codeExecutable.path,[StringComparison]::OrdinalIgnoreCase)){throw 'F32 candidate broker ancestry changed.'}
            $taskArguments=Split-F32WindowsArguments $taskOwnedChild.CommandLine
            if(-not (Test-F32ExactBrokerArguments -Arguments $taskArguments -CodeExecutable $taskPrepared.codeExecutable.path -ScriptPath $taskPrepared.script.path)){continue}
            $taskCandidates.Add([pscustomobject]@{pid=[int]$taskOwnedChild.ProcessId;parentPid=[int]$taskOwnedChild.ParentProcessId;creationUtc=$taskCreated.ToString('o')})
        }
    }
    if($taskCandidates.Count -ne 1){throw 'F32 exactly one current installed broker child is required; unknown ancestry/argv is not adopted.'}
    $taskBroker=$taskCandidates[0]
    [void](Get-F32OwnedCodeRecord -OwnedPid $taskBroker.pid -ExpectedCreationUtc ([DateTimeOffset]::Parse($taskBroker.creationUtc,[Globalization.CultureInfo]::InvariantCulture).UtcDateTime))
    $taskListeners=@(Get-F32ExactBrokerListeners -LocalPort ([int]$taskPrepared.brokerStarted.port))
    if($taskListeners.Count -ne 1 -or $taskListeners[0].LocalAddress -cne '127.0.0.1' -or $taskListeners[0].LocalPort -ne $taskPrepared.brokerStarted.port -or $taskListeners[0].OwningProcess -ne $taskBroker.pid){throw 'F32 healthy public broker port must belong to that exact installed broker child.'}
    $taskValue=[ordered]@{schemaVersion=1;feature='F32';status='OWNED_EXACT_INSTALLED_BROKER_CHILD_AND_LOOPBACK_LISTENER';binding=$taskPrepared.bindingFact;ownerReceipt=$taskBinding.ownerReceipt;listenerCustody=$taskBinding.listenerCustody;vendorReceipt=$taskBinding.vendorReceipt;brokerStartReceipt=$taskBinding.brokerStartReceipt;rootCodePid=[int]$taskBinding.codePid;profile=$taskBinding.profile;brokerPid=$taskBroker.pid;parentPid=$taskBroker.parentPid;creationUtc=$taskBroker.creationUtc;script=$taskPrepared.script;codeExecutable=$taskPrepared.codeExecutable;localAddress='127.0.0.1';localPort=[int]$taskPrepared.brokerStarted.port;publicState='healthy';observedAt=[DateTime]::UtcNow.ToString('o');signalsRequested=0;environmentReads=0;scope='One exact current-VSIX installed broker script under an already admitted timestamp-bound Code parent. Script/executable/argv/time/listener ownership observed, no environment or token read and no independent child pipe EOF yet.'}
    return Write-F32ExclusiveMetadata -Prepared $taskPrepared -OutputPath $OutputPath -Value $taskValue
}

function Write-F32BrokerAbsence {
    param([Parameter(Mandatory=$true)][string]$BindingPath,[Parameter(Mandatory=$true)][string]$OutputPath)
    $ErrorActionPreference='Stop';$taskPrepared=Read-F32BrokerBinding -BindingPath $BindingPath;$taskBinding=$taskPrepared.binding
    foreach($taskFact in @($taskBinding.brokerCustody,$taskBinding.brokerStoppedReceipt)){
        if(-not (Test-F32ChildPath -Root $taskBinding.gate -Candidate $taskFact.path)){throw 'F32 broker custody/stopped receipt outside exact gate.'}
    }
    $taskCustody=Read-F32PinnedJson -Fact $taskBinding.brokerCustody -MaximumBytes 65536
    $taskStopped=Read-F32PinnedJson -Fact $taskBinding.brokerStoppedReceipt -MaximumBytes 65536
    if($taskStopped.schemaVersion -ne 1 -or $taskStopped.feature -cne 'F32' -or $taskStopped.phase -cne 'restart' -or $taskStopped.status -cne 'PUBLIC_STOPPED_EXTERNAL_ABSENCE_PENDING' -or $taskStopped.nonce -cne $taskBinding.brokerNonce -or $taskStopped.observerPid -ne $taskPrepared.brokerStarted.observerPid -or $taskStopped.previousPort -ne $taskPrepared.brokerStarted.port -or $taskStopped.scriptSha256 -cne $taskPrepared.script.sha256 -or $taskStopped.signalsRequested -ne 0){throw 'F32 exact stopped broker protocol does not match its witnessed start.'}
    if($taskCustody.feature -cne 'F32' -or $taskCustody.status -cne 'OWNED_EXACT_INSTALLED_BROKER_CHILD_AND_LOOPBACK_LISTENER' -or $taskCustody.rootCodePid -ne $taskBinding.codePid -or $taskCustody.profile -cne $taskBinding.profile -or $taskCustody.ownerReceipt.sha256 -cne $taskBinding.ownerReceipt.sha256 -or $taskCustody.brokerStartReceipt.sha256 -cne $taskBinding.brokerStartReceipt.sha256 -or $taskCustody.signalsRequested -ne 0 -or $taskCustody.brokerPid -isnot [ValueType] -or $taskCustody.brokerPid -lt 1 -or $taskCustody.brokerPid -gt 2147483647 -or [int]$taskCustody.brokerPid -ne $taskCustody.brokerPid){throw 'F32 exact previously observed broker custody required.'}
    if($taskCustody.script.sha256 -cne $taskPrepared.script.sha256 -or $taskCustody.script.path -cne $taskPrepared.script.path -or $taskCustody.localAddress -cne '127.0.0.1' -or $taskCustody.localPort -ne $taskPrepared.brokerStarted.port){throw 'F32 broker custody runtime/port mismatch.'}
    if($taskStopped.state -cne 'stopped' -or $taskStopped.running -ne $false -or $taskStopped.script.path -cne $taskPrepared.script.path -or $taskStopped.script.sha256 -cne $taskPrepared.script.sha256 -or $taskStopped.script.bytes -ne $taskPrepared.script.bytes){throw 'F32 actual public stopped result for the exact runtime required.'}
    $taskCustodyUtc=[DateTimeOffset]::Parse($taskCustody.observedAt,[Globalization.CultureInfo]::InvariantCulture).UtcDateTime
    $taskStoppedUtc=[DateTimeOffset]::Parse($taskStopped.observedAt,[Globalization.CultureInfo]::InvariantCulture).UtcDateTime
    if($taskStoppedUtc -lt $taskCustodyUtc -or $taskStoppedUtc -gt [DateTime]::UtcNow.AddSeconds(2)){throw 'F32 public stopped observation must follow actual broker custody.'}
    $taskObservations=@()
    foreach($taskIndex in @(1,2)){
        $taskPresent=@(Get-CimInstance -Query ('SELECT ProcessId,CreationDate FROM Win32_Process WHERE ProcessId='+[int]$taskCustody.brokerPid) -ErrorAction Stop)
        if($taskPresent.Count -ne 0){throw 'F32 observed broker PID still present or reused; no new command-line read or absence claim.'}
        $taskListeners=@(Get-F32ExactBrokerListeners -LocalPort ([int]$taskCustody.localPort))
        if($taskListeners.Count -ne 0){throw 'F32 observed broker port still listening; no stop completion inference.'}
        $taskObservations+=@{observedAt=[DateTime]::UtcNow.ToString('o');capturedBrokerPidAbsent=$true;exactBrokerPortListenerCount=0}
        if($taskIndex -eq 1){Start-Sleep -Milliseconds 1000}
    }
    $taskValue=[ordered]@{schemaVersion=1;feature='F32';status='PUBLIC_BROKER_STOPPED_WITH_CAPTURED_PID_AND_PORT_ABSENT_TWICE';binding=$taskPrepared.bindingFact;brokerCustody=$taskBinding.brokerCustody;brokerStoppedReceipt=$taskBinding.brokerStoppedReceipt;rootCodePid=[int]$taskBinding.codePid;brokerPid=[int]$taskCustody.brokerPid;profile=$taskBinding.profile;script=$taskPrepared.script;localAddress='127.0.0.1';localPort=[int]$taskCustody.localPort;observations=$taskObservations;signalsRequested=0;environmentReads=0;independentRawBrokerStdoutEOF='NOT_OBSERVED_BY_FIXTURE';independentRawBrokerStderrEOF='NOT_OBSERVED_BY_FIXTURE';scope='Corroborates actual public stopped state using the exact previously observed broker child and listener. Pinned OwnedBrokerLifecycle source controls public stopped only after child close and both pipe ends. Fixture does not patch product source or independently observe its private child pipes; no universal nested EOF claim.'}
    return Write-F32ExclusiveMetadata -Prepared $taskPrepared -OutputPath $OutputPath -Value $taskValue
}

function Wait-F32BrokerProtocolFact {
    param([Parameter(Mandatory=$true)]$Prepared,[Parameter(Mandatory=$true)][string]$LiteralPath,[Parameter(Mandatory=$true)][Diagnostics.Stopwatch]$Lifetime)
    if(-not (Test-F32ChildPath -Root $Prepared.binding.gate -Candidate $LiteralPath)){throw 'F32 broker protocol must remain inside the exact gate.'}
    while($Lifetime.ElapsedMilliseconds -lt 180000){
        if(Test-Path -LiteralPath $LiteralPath){
            try{
                $taskFirst=Get-F32ReadOnlyFact -LiteralPath $LiteralPath -MaximumBytes 65536
                Start-Sleep -Milliseconds 100
                $taskSecond=Get-F32ReadOnlyFact -LiteralPath $LiteralPath -MaximumBytes 65536
                if($taskFirst.bytes -eq $taskSecond.bytes -and $taskFirst.sha256 -ceq $taskSecond.sha256){
                    if($taskSecond.bytes -eq 0){throw 'F32 empty broker protocol receipt is not authority.'}
                    return $taskSecond
                }
            }catch [IO.IOException]{
                # Only a still-open exclusive metadata writer may settle. Never
                # retry a malformed receipt, hash, ownership or custody failure.
                $taskWindowsError=$_.Exception.HResult -band 65535
                if($taskWindowsError -ne 32 -and $taskWindowsError -ne 33){throw 'F32 broker protocol read failed.'}
            }
        }
        Start-Sleep -Milliseconds 100
    }
    throw 'F32 broker lifetime receipt wait exceeded the one phase bound.'
}

function Copy-F32BrokerBinding {
    param([Parameter(Mandatory=$true)]$Binding)
    $taskCopy=[ordered]@{}
    if($Binding -is [Collections.IDictionary]){
        foreach($taskKey in $Binding.Keys){$taskCopy[$taskKey]=$Binding[$taskKey]}
    }else{
        foreach($taskProperty in $Binding.PSObject.Properties){$taskCopy[$taskProperty.Name]=$taskProperty.Value}
    }
    return $taskCopy
}

function Watch-F32OwnedBrokerLifetime {
    param([Parameter(Mandatory=$true)][string]$BindingPath,[Parameter(Mandatory=$true)][string]$OutputPath)
    $ErrorActionPreference='Stop';$taskLifetime=[Diagnostics.Stopwatch]::StartNew()
    $taskPrepared=Read-F32CustodyBinding -BindingPath $BindingPath;$taskBinding=$taskPrepared.binding
    if($taskBinding.phase -cne 'restart' -or $taskBinding.configuredBrokerPort -isnot [ValueType] -or $taskBinding.configuredBrokerPort -lt 0 -or $taskBinding.configuredBrokerPort -gt 65535 -or [int]$taskBinding.configuredBrokerPort -ne $taskBinding.configuredBrokerPort){throw 'F32 one reviewed restart broker lifetime phase required.'}
    $taskStartedPath=Join-Path $taskBinding.gate 'restart-owned-broker-started.json'
    $taskStoppedPath=Join-Path $taskBinding.gate 'restart-owned-broker-stopped.json'
    $taskStartedFact=Wait-F32BrokerProtocolFact -Prepared $taskPrepared -LiteralPath $taskStartedPath -Lifetime $taskLifetime
    $taskCustodyWatch=[Diagnostics.Stopwatch]::StartNew()
    $taskStarted=Read-F32PinnedJson -Fact $taskStartedFact -MaximumBytes 65536
    if($taskStarted.nonce -cnotmatch '^[0-9a-f]{32}$'){throw 'F32 new broker protocol nonce required.'}
    $taskCustodyBinding=Copy-F32BrokerBinding $taskBinding
    $taskCustodyBinding['brokerNonce']=$taskStarted.nonce;$taskCustodyBinding['brokerStartReceipt']=$taskStartedFact
    $taskCustodyBindingFact=Write-F32ExclusiveMetadata -Prepared $taskPrepared -OutputPath (Join-Path $taskBinding.gate 'restart-owned-broker-custody-binding.json') -Value $taskCustodyBinding
    $taskCustodyFact=Write-F32BrokerCustody -BindingPath $taskCustodyBindingFact.path -OutputPath (Join-Path $taskBinding.gate 'restart-owned-broker-custody.json')
    $taskCustody=Read-F32PinnedJson -Fact $taskCustodyFact -MaximumBytes 65536
    if($taskCustodyWatch.ElapsedMilliseconds -gt 45000 -or $taskLifetime.ElapsedMilliseconds -gt 180000){throw 'F32 broker custody handshake deadline exceeded; no late acknowledgement.'}
    $taskCustodyAck=[ordered]@{status='OWNED_BROKER_DESCENDANT_CUSTODY_VERIFIED';nonce=$taskStarted.nonce;port=$taskStarted.port;observerPid=$taskStarted.observerPid;scriptSha256=$taskCustody.script.sha256;brokerPid=$taskCustody.brokerPid;signalsRequested=0;receipt=$taskCustodyFact}
    $taskCustodyAckFact=Write-F32ExclusiveMetadata -Prepared $taskPrepared -OutputPath ($taskStartedPath+'.custody-done.json') -Value $taskCustodyAck

    $taskStoppedFact=Wait-F32BrokerProtocolFact -Prepared $taskPrepared -LiteralPath $taskStoppedPath -Lifetime $taskLifetime
    $taskAbsenceWatch=[Diagnostics.Stopwatch]::StartNew()
    $taskAbsenceBinding=Copy-F32BrokerBinding $taskCustodyBinding
    $taskAbsenceBinding['brokerCustody']=$taskCustodyFact;$taskAbsenceBinding['brokerStoppedReceipt']=$taskStoppedFact
    $taskAbsenceBindingFact=Write-F32ExclusiveMetadata -Prepared $taskPrepared -OutputPath (Join-Path $taskBinding.gate 'restart-owned-broker-absence-binding.json') -Value $taskAbsenceBinding
    $taskAbsenceFact=Write-F32BrokerAbsence -BindingPath $taskAbsenceBindingFact.path -OutputPath (Join-Path $taskBinding.gate 'restart-owned-broker-absence.json')
    $taskAbsence=Read-F32PinnedJson -Fact $taskAbsenceFact -MaximumBytes 65536
    if($taskAbsenceWatch.ElapsedMilliseconds -gt 45000 -or $taskLifetime.ElapsedMilliseconds -gt 180000){throw 'F32 broker absence handshake deadline exceeded; no late acknowledgement.'}
    $taskStopped=Read-F32PinnedJson -Fact $taskStoppedFact -MaximumBytes 65536
    $taskAbsenceAck=[ordered]@{status='OWNED_BROKER_ABSENCE_VERIFIED';nonce=$taskStarted.nonce;previousPort=$taskStopped.previousPort;scriptSha256=$taskAbsence.script.sha256;signalsRequested=0;receipt=$taskAbsenceFact}
    $taskAbsenceAckFact=Write-F32ExclusiveMetadata -Prepared $taskPrepared -OutputPath ($taskStoppedPath+'.absence-done.json') -Value $taskAbsenceAck
    $taskValue=[ordered]@{schemaVersion=1;feature='F32';status='BROKER_LIFETIME_CUSTODY_AND_ABSENCE_OBSERVED';binding=$taskPrepared.bindingFact;brokerStarted=$taskStartedFact;brokerCustody=$taskCustodyFact;brokerCustodyAcknowledgement=$taskCustodyAckFact;brokerStopped=$taskStoppedFact;brokerAbsence=$taskAbsenceFact;brokerAbsenceAcknowledgement=$taskAbsenceAckFact;rootCodePid=[int]$taskBinding.codePid;brokerPid=[int]$taskCustody.brokerPid;profile=$taskBinding.profile;script=$taskCustody.script;elapsedMs=$taskLifetime.ElapsedMilliseconds;signalsRequested=0;environmentReads=0;independentRawBrokerStdoutEOF='NOT_OBSERVED_BY_FIXTURE';independentRawBrokerStderrEOF='NOT_OBSERVED_BY_FIXTURE';scope='One current exact installed broker child witnessed under captured owned Code ancestry, public healthy/stopped observations and twice PID/port absence. Product source controls private pipe completion; fixture does not independently observe its private broker pipes or signal any process.'}
    return Write-F32ExclusiveMetadata -Prepared $taskPrepared -OutputPath $OutputPath -Value $taskValue
}
