'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
let source = fs.readFileSync(path.join(__dirname, 'installed-owner-custody-proposed-01.ps1'), 'utf8');
const listener = "$taskListeners=@(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $taskEndpoint.Port -State Listen -ErrorAction Stop)";
assert.equal(source.split(listener).length - 1, 1);
source = source.replace(listener, '$taskListeners=@(Wait-F32ExactLoopbackListener -Prepared $taskPrepared -LocalPort $taskEndpoint.Port -RootCreationUtc $taskRootCreated -WaitMilliseconds 30000)');
const beforeOutput = 'signals=0;unadmittedDescendantCount=$taskUnadmitted;';
assert.equal(source.split(beforeOutput).length - 1, 1);
source = source.replace(beforeOutput, 'signals=0;fixtureHelperElevation=(Get-F32HelperElevation);codeRootElevation="NOT_OBSERVED_BY_CIM";unadmittedDescendantCount=$taskUnadmitted;');
const closeCheck = "if($taskCustody.feature -cne 'F32' -or $taskCustody.rootCodePid -ne $taskBinding.codePid -or $taskCustody.profile -cne $taskBinding.profile -or $taskCustody.signals -ne 0){throw 'F32 pinned exact-profile custody mismatch.'}";
assert.equal(source.split(closeCheck).length - 1, 1);
source = source.replace(closeCheck, closeCheck + '\n    if($taskCustody.ownerReceipt.sha256 -cne $taskBinding.ownerReceipt.sha256 -or $taskCustody.vendorReceipt.sha256 -cne $taskBinding.vendorReceipt.sha256){throw "F32 custody belongs to a different owned start or vendor observation."}');
source += String.raw`

# Successor02: a bounded readiness wait is one observation inside the same
# owned phase, not a re-launch or a retry of any ownership/custody failure.
function Wait-F32ExactLoopbackListener {
    param([Parameter(Mandatory=$true)]$Prepared,[Parameter(Mandatory=$true)][int]$LocalPort,[Parameter(Mandatory=$true)][DateTime]$RootCreationUtc,[int]$WaitMilliseconds=30000)
    if($LocalPort -lt 1024 -or $LocalPort -gt 65535 -or $WaitMilliseconds -lt 0 -or $WaitMilliseconds -gt 30000){throw 'F32 bounded exact listener wait required.'}
    $taskStopwatch=[Diagnostics.Stopwatch]::StartNew()
    while($true){
        [void](Get-F32OwnedCodeRecord -OwnedPid ([int]$Prepared.binding.codePid) -ExpectedCreationUtc $RootCreationUtc)
        $taskBindingNow=Get-F32ReadOnlyFact -LiteralPath $Prepared.bindingFact.path -MaximumBytes 2097152
        if($taskBindingNow.sha256 -cne $Prepared.bindingFact.sha256 -or $taskBindingNow.bytes -ne $Prepared.bindingFact.bytes){throw 'F32 immutable listener binding changed.'}
        $taskResult=@()
        try{$taskResult=@(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $LocalPort -State Listen -ErrorAction Stop)}
        catch{
            if($_.FullyQualifiedErrorId -notmatch '^CmdletizationQuery_NotFound'){throw 'F32 listener query failed; no retry of access or other errors.'}
        }
        if($taskResult.Count -gt 1){throw 'F32 ambiguous loopback listeners; no retry.'}
        if($taskResult.Count -eq 1){return ,$taskResult[0]}
        if($taskStopwatch.ElapsedMilliseconds -ge $WaitMilliseconds){throw 'F32 exact owned listener readiness bound exceeded.'}
        Start-Sleep -Milliseconds 200
    }
}

function Get-F32HelperElevation {
    $taskIdentity=[Security.Principal.WindowsIdentity]::GetCurrent()
    try{
        $taskPrincipal=[Security.Principal.WindowsPrincipal]::new($taskIdentity)
        return [pscustomobject]@{observed=$true;fixtureHelperElevated=$taskPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator);scope='Only current read-only fixture helper token; Code/root/descendant token elevation and UAC prompts are not inferred.'}
    }finally{$taskIdentity.Dispose()}
}

function Read-F32InitialBinding {
    param([Parameter(Mandatory=$true)][string]$BindingPath)
    $taskBindingFact=Get-F32ReadOnlyFact -LiteralPath $BindingPath -MaximumBytes 2097152
    $taskBinding=Read-F32PinnedJson -Fact $taskBindingFact
    if($taskBinding.schemaVersion -ne 1 -or $taskBinding.feature -cne 'F32' -or $taskBinding.status -cne 'REVIEWED_ONE_NORMAL_ROUND'){throw 'F32 reviewed immutable initial binding required.'}
    if($taskBinding.runRoot -cnotmatch '^D:\SoterAI-Lite-test-profiles\f32-installed-[0-9TZ]+-[a-f0-9]{8}$'){throw 'F32 exact synthetic initial root required.'}
    if(-not (Test-F32ChildPath -Root $taskBinding.runRoot -Candidate $taskBinding.profile) -or -not (Test-F32ChildPath -Root $taskBinding.runRoot -Candidate $taskBinding.gate) -or -not (Test-F32ChildPath -Root $taskBinding.gate -Candidate $BindingPath)){throw 'F32 initial profile/gate binding outside exact root.'}
    if($taskBinding.profile -match "[%_'\[\]]"){throw 'F32 safe marked profile literal required.'}
    $taskVendor=Read-F32PinnedJson -Fact $taskBinding.vendorReceipt
    if($taskVendor.feature -cne 'F32' -or $taskVendor.twoStableObservations -ne $true -or $taskVendor.currentHost.version -cne '1.144.1'){throw 'F32 current public vendor observation required.'}
    foreach($taskFact in @($taskVendor.currentHost.executable,$taskVendor.systemPowerShell)){
        $taskMeasured=Get-F32ReadOnlyFact -LiteralPath $taskFact.path
        if($taskMeasured.bytes -ne $taskFact.bytes -or $taskMeasured.sha256 -cne $taskFact.sha256){throw 'F32 initial admitted public executable changed.'}
    }
    if($taskVendor.systemPowerShell.path -cne 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -or (Join-Path $PSHOME 'powershell.exe') -cne $taskVendor.systemPowerShell.path){throw 'F32 pinned system Windows PowerShell host required.'}
    return [pscustomobject]@{binding=$taskBinding;bindingFact=$taskBindingFact;vendor=$taskVendor;codeExecutable=$taskVendor.currentHost.executable}
}

function Write-F32InitialOwnerAbsence {
    param([Parameter(Mandatory=$true)][string]$BindingPath,[Parameter(Mandatory=$true)][string]$OutputPath)
    $ErrorActionPreference='Stop';$taskPrepared=Read-F32InitialBinding -BindingPath $BindingPath;$taskBinding=$taskPrepared.binding
    $taskObservations=@();$taskProfileLiteral=$taskBinding.profile.Replace('\','\\')
    foreach($taskIndex in @(1,2)){
        $taskQuery="SELECT ProcessId,ParentProcessId,CreationDate,CommandLine FROM Win32_Process WHERE Name='Code.exe' AND CommandLine LIKE '%"+$taskProfileLiteral+"%'"
        $taskCandidates=@(Get-CimInstance -Query $taskQuery -ErrorAction Stop)
        if($taskCandidates.Count -gt 128){throw 'F32 bounded initial marked owner query required.'}
        $taskExactCount=0
        foreach($taskCandidate in $taskCandidates){
            if(Test-F32ExactProfileArguments -Arguments (Split-F32WindowsArguments $taskCandidate.CommandLine) -Profile $taskBinding.profile){$taskExactCount++}
        }
        if($taskExactCount -ne 0){throw 'F32 exact marked profile is already owned; no launch allowed.'}
        $taskObservations+=@{observedAt=[DateTime]::UtcNow.ToString('o');exactSyntheticProfileOwnerCount=$taskExactCount}
        if($taskIndex -eq 1){Start-Sleep -Milliseconds 1000}
    }
    $taskValue=[ordered]@{schemaVersion=1;feature='F32';status='EXACT_SYNTHETIC_PROFILE_ABSENT_TWICE_BEFORE_LAUNCH';binding=$taskPrepared.bindingFact;vendorReceipt=$taskBinding.vendorReceipt;profile=$taskBinding.profile;observations=$taskObservations;fixtureHelperElevation=(Get-F32HelperElevation);codeRootElevation='NOT_OBSERVED_BEFORE_LAUNCH';signalsRequested=0;scope='Only this exact fresh synthetic profile. Other historical profiles/normal windows are not enumerated. This is no claim of global marked-owner absence or future process EOF.'}
    return Write-F32ExclusiveMetadata -Prepared $taskPrepared -OutputPath $OutputPath -Value $taskValue
}
`;
fs.writeFileSync(path.join(__dirname, 'installed-owner-custody-proposed-02.ps1'), source, { flag: 'wx' });
