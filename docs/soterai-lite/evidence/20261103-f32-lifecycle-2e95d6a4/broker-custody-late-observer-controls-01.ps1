param(
    [ValidateSet('installed-broker-custody-proposed-01.ps1','installed-broker-custody-proposed-02.ps1')][string]$Library,
    [ValidatePattern('^broker-custody-late-observer-(before|after)-01\.json$')][string]$OutputName
)
# Pure protocol ordering model. Every filesystem/process/listener method used by
# the actual watcher is replaced below; no host/CIM/listener/network is queried.
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'installed-owner-custody-proposed-04.ps1')
. (Join-Path $PSScriptRoot $Library)
$script:taskForbidden=0
function Get-CimInstance {$script:taskForbidden++;throw 'Forbidden live CIM.'}
function Get-NetTCPConnection {$script:taskForbidden++;throw 'Forbidden live listener query.'}
$script:taskRoot='D:\SoterAI-Lite-test-profiles\f32-installed-20261104T010000Z-a1b2c3d4'
$script:taskGate=$script:taskRoot+'\Primary\F32Gate\restart'
$script:taskProfile=$script:taskRoot+'\Primary'
$script:taskScript=$script:taskRoot+'\Extensions\soterai.soterai-ide-guard-0.7.0-win32-x64\dist\local-ai-broker.js'
$script:taskHash='a'*64
function New-F32ModelFact([string]$Name) {return [pscustomobject]@{path=($script:taskGate+'\'+$Name);bytes=1;sha256=$script:taskHash}}
$script:taskRows=@{}
$script:taskBase=[pscustomobject]@{
    phase='restart';product=[pscustomobject]@{id='soterai.soterai-ide-guard';version='0.7.0'}
    runRoot=$script:taskRoot;extensions=($script:taskRoot+'\Extensions');gate=$script:taskGate;profile=$script:taskProfile
    codePid=100;launchWallMs=([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-5000)
    expectedBrokerScript=[pscustomobject]@{path=$script:taskScript;bytes=32;sha256=$script:taskHash}
    listenerCustody=(New-F32ModelFact 'initial-listener.json');ownerReceipt=(New-F32ModelFact 'owner.json')
    vendorReceipt=(New-F32ModelFact 'vendor.json');configuredBrokerPort=49000
}
$script:taskPrepared=[pscustomobject]@{binding=$script:taskBase;bindingFact=(New-F32ModelFact 'binding.json');owner=@{};vendor=@{};codeExecutable=@{path='C:\Fixture\Code.exe';bytes=10;sha256=$script:taskHash}}
function New-F32ModelListener([bool]$ObserverPresent) {
    $taskProcesses=@([pscustomobject]@{pid=100})
    if($ObserverPresent){$taskProcesses+=@([pscustomobject]@{pid=101})}
    return [pscustomobject]@{feature='F32';status='CURRENT_OWNED_EXACT_PROFILE_LOOPBACK_LISTENER';rootCodePid=100;profile=$script:taskProfile;signals=0;ownerReceipt=$script:taskBase.ownerReceipt;vendorReceipt=$script:taskBase.vendorReceipt;processes=$taskProcesses}
}
function Read-F32CustodyBinding([string]$BindingPath) {
    $taskCopy=[pscustomobject]@{binding=$script:taskBase;bindingFact=(New-F32ModelFact 'binding.json');owner=@{};vendor=@{};codeExecutable=$script:taskPrepared.codeExecutable}
    if($script:taskRows.ContainsKey($BindingPath)){$taskCopy.binding=$script:taskRows[$BindingPath]}
    return $taskCopy
}
function Read-F32PinnedJson($Fact,[long]$MaximumBytes=2097152) {
    if(-not $script:taskRows.ContainsKey($Fact.path)){throw 'Model receipt unavailable.'}
    return $script:taskRows[$Fact.path]
}
function Get-F32ReadOnlyFact([string]$LiteralPath,[long]$MaximumBytes=536870912) {
    if($LiteralPath -cne $script:taskScript){throw 'Model unexpected read.'}
    return $script:taskBase.expectedBrokerScript
}
function Write-F32ExclusiveMetadata($Prepared,[string]$OutputPath,$Value) {
    if(-not (Test-F32ChildPath -Root $script:taskGate -Candidate $OutputPath)){throw 'Model metadata escaped gate.'}
    $script:taskRows[$OutputPath]=$Value
    return [pscustomobject]@{path=$OutputPath;bytes=1;sha256=$script:taskHash}
}
function Wait-F32BrokerProtocolFact($Prepared,[string]$LiteralPath,$Lifetime) {return [pscustomobject]@{path=$LiteralPath;bytes=1;sha256=$script:taskHash}}
function Write-F32ListenerCustody([string]$BindingPath,[string]$OutputPath) {
    $script:taskEvents.Add('fresh-tree')
    $taskValue=New-F32ModelListener ($script:taskScenario -ne 'observer-never-present')
    if($script:taskScenario -eq 'wrong-root'){$taskValue.rootCodePid=999}
    return Write-F32ExclusiveMetadata -Prepared $script:taskPrepared -OutputPath $OutputPath -Value $taskValue
}
function Write-F32BrokerCustody([string]$BindingPath,[string]$OutputPath) {
    # Execute the actual authority reader: the stale initial tree lacks PID101.
    $taskActual=Read-F32BrokerBinding -BindingPath $BindingPath
    $script:taskEvents.Add('broker-admitted')
    return Write-F32ExclusiveMetadata -Prepared $script:taskPrepared -OutputPath $OutputPath -Value @{script=$taskActual.script;brokerPid=102}
}
function Write-F32BrokerAbsence([string]$BindingPath,[string]$OutputPath) {
    $script:taskEvents.Add('absence-model')
    return Write-F32ExclusiveMetadata -Prepared $script:taskPrepared -OutputPath $OutputPath -Value @{script=$script:taskBase.expectedBrokerScript}
}
$taskControls=[Collections.Generic.List[object]]::new()
foreach($taskCase in @('late-valid-observer','observer-never-present','wrong-root')){
    $script:taskScenario=$taskCase;$script:taskEvents=[Collections.Generic.List[string]]::new()
    $script:taskRows=@{}
    $script:taskRows[$script:taskBase.listenerCustody.path]=New-F32ModelListener $false
    $script:taskRows[$script:taskGate+'\restart-owned-broker-started.json']=[pscustomobject]@{
        schemaVersion=1;feature='F32';phase='restart';status='PUBLIC_HEALTHY_EXTERNAL_CUSTODY_PENDING';signalsRequested=0
        nonce=('b'*32);configuredPort=49000;observerPid=101;state='healthy';running=$true;version='0.2.0';port=50123
        script=$script:taskBase.expectedBrokerScript;startRequestedWallMs=([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-1000)
        observedAt=[DateTime]::UtcNow.ToString('o')
    }
    $script:taskRows[$script:taskGate+'\restart-owned-broker-stopped.json']=@{previousPort=50123}
    $taskError=$null
    try{[void](Watch-F32OwnedBrokerLifetime -BindingPath ($script:taskGate+'\watch-binding.json') -OutputPath ($script:taskGate+'\result.json'))}catch{$taskError=$_.Exception.Message}
    $taskPassed=if($taskCase -eq 'late-valid-observer'){$null -eq $taskError -and $script:taskEvents[0] -ceq 'fresh-tree' -and $script:taskEvents[1] -ceq 'broker-admitted'}else{$null -ne $taskError -and -not $script:taskEvents.Contains('broker-admitted')}
    $taskControls.Add([pscustomobject]@{id=$taskCase;pass=$taskPassed;actualError=$taskError;events=$script:taskEvents.ToArray()})
}
$taskErrors=$null;$taskTokens=$null
[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $Library),[ref]$taskTokens,[ref]$taskErrors)
$taskControls.Add([pscustomobject]@{id='syntax-errors-zero';pass=(@($taskErrors).Count -eq 0)})
$taskControls.Add([pscustomobject]@{id='no-live-query';pass=($script:taskForbidden -eq 0)})
$taskFailed=@($taskControls|Where-Object{-not $_.pass}).Count
$taskSource=Get-Item -LiteralPath (Join-Path $PSScriptRoot $Library)
$taskRecord=[ordered]@{schemaVersion=1;feature='F32';status=if($taskFailed -eq 0){'PURE_LATE_OBSERVER_CONTROLS_PASS_NOT_NATIVE'}else{'PURE_LATE_OBSERVER_CONTROLS_FAIL_NOT_NATIVE'};library=@{path=$taskSource.FullName;bytes=$taskSource.Length;sha256=(Get-FileHash -LiteralPath $taskSource.FullName -Algorithm SHA256).Hash.ToLowerInvariant()};controls=$taskControls.ToArray();failed=$taskFailed;forbiddenLiveCalls=$script:taskForbidden;scope='Pure receipt/tree readiness model with real Read-F32BrokerBinding and watcher orchestration. Broker process/listener/absence calls replaced by controlled functions; no native coverage.'}
$taskOutput=Join-Path $PSScriptRoot $OutputName
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskRecord|ConvertTo-Json -Depth 12)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskRecord|ConvertTo-Json -Depth 12
if($taskFailed -ne 0){exit 1}
