$ErrorActionPreference='Stop'
$taskTokens=$null;$taskErrors=$null
$taskAst=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'native-launch-candidate-04.ps1.txt'),[ref]$taskTokens,[ref]$taskErrors)
if(@($taskErrors).Count -ne 0){throw 'Launcher syntax invalid.'}
$taskFunction=$taskAst.Find({param($taskNode)$taskNode -is [Management.Automation.Language.FunctionDefinitionAst] -and $taskNode.Name -ceq 'Assert-F28Result'},$true)
if(-not $taskFunction){throw 'Actual strict result validator missing.'};Invoke-Expression $taskFunction.Extent.Text
$taskFreeze=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-case-freeze-03.json') -Raw|ConvertFrom-Json
$taskContent=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'content-inspection-02.json') -Raw|ConvertFrom-Json
$taskDrivers=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-driver-provenance-04.json') -Raw|ConvertFrom-Json
$taskExpected=$taskContent.vsix.extensionSha256;$taskDriverExpected=$taskDrivers.nativeDriver.sha256
$taskBinding=@{sourceProof=@{sha256='70d3b237332ada5f7317906a8e745ff7d8f7bc2213b8c27f810a25b919b30743'}}
$taskRuntimeBindings=@($taskContent.entries|Where-Object{$_.path -match '^extension/dist/.*\.js$'}|ForEach-Object{@{name=[IO.Path]::GetFileName($_.path);bytes=$_.bytes;sha256=$_.sha256}})
$taskExecution='D:\SoterAI-Lite-test-profiles\f28-reliability-native-20261101T000000Z-00000000';$taskRun=Join-Path $PSScriptRoot 'projected-only-not-created'
# Explicit projected metadata doubles. These prove validator behavior only,
# never native process/stream/file/clock closure or product execution.
function Assert-F28File([string]$File,[string]$Expected,[long]$Bytes){if($Expected -cnotmatch '^[a-f0-9]{64}$' -or $Bytes -lt 0){throw 'Invalid projected pin.'}}
function Copy-F28New([string]$Source,[string]$Target){}
function Write-F28NewJson([string]$File,[object]$Value){}
function Get-Process([int]$Id,[object]$ErrorAction){return $null}
function Start-Sleep([int]$Milliseconds){}
function New-Observed([string]$Phase){
 $taskCount=if($Phase -ceq 'primary'){25}else{5}
 $taskPeers=@();if($Phase -ceq 'primary'){$taskPeers=@(@{pid=999999;closed=$true;code=0;signal=$null;stdoutEOF=$true;stderrEOF=$true;overflow=$false;streamError=$false;profile=(Join-Path $taskExecution 'peer-profile');streams=@(@{channel='stdout';file=(Join-Path $taskExecution 'peer-stdout.bin');bytes=0;sha256=('a'*64)},@{channel='stderr';file=(Join-Path $taskExecution 'peer-stderr.bin');bytes=0;sha256=('b'*64)});signalsRequested=0})}
 $taskValue=@{schemaVersion=1;phase=$Phase;syntheticOnly=$true;hostVersion='1.144.0';expectedChecks=$taskCount;passed=$taskCount;failed=0;notRun=0;driverFailure=$null;extensionBundleSha256=$taskExpected;hostProbeSha256=$taskDriverExpected;sourceProofSha256=$taskBinding.sourceProof.sha256;signalsRequested=0;unfinishedFixtureHandles=0;sourceHandleOpens=$(if($Phase -ceq 'primary'){2}else{0});sourceHandleCloses=$(if($Phase -ceq 'primary'){2}else{0});originalEnvironmentDocumentEvents=0;readStatus=@{activeReads=0;status=$(if($Phase -ceq 'primary'){'DISABLED'}else{'READY'})};runtimeBindings=$taskRuntimeBindings;observations=@($taskFreeze.cases|Where-Object{$_.phase -ceq $Phase}|ForEach-Object{@{id=$_.id;scope=$_.scope;status='PASS'}});readyForInterphase=($Phase -ceq 'primary');safeWithdrawal=$(if($Phase -ceq 'primary'){'PRIMARY_DISABLED_NO_PENDING_READS_RESTART_REQUIRED'}else{'ORIGINAL_FLAG_RESTORED_NO_PENDING_READS'});peerChildren=$taskPeers;measurements=@(@{kind='ACTUAL_PACKAGED_COMMAND_SELECTED128_OF4096';selected=128;bulkSyntheticFiles=4096;milliseconds=2000})}
 return ($taskValue|ConvertTo-Json -Depth 40)|ConvertFrom-Json
}
$taskCount=0
function Test-Observed([string]$Label,[scriptblock]$Mutation,[bool]$Expected=$false,[string]$Phase='primary'){
 $taskObserved=New-Observed $Phase;& $Mutation $taskObserved;$taskAccepted=$false
 try{Assert-F28Result $taskObserved $Phase;$taskAccepted=$true}catch{if($Expected){Write-Output $_.Exception.Message}}
 if($taskAccepted -ne $Expected){throw ('Actual validator component failed: '+$Label)};$script:taskCount++;Write-Output ('PASS_PROJECTED_VALIDATOR '+$Label)
}
Test-Observed 'complete primary' {} $true
Test-Observed 'complete restart' {} $true 'restart'
Test-Observed 'missing explicit driverFailure' {param($v)$v.PSObject.Properties.Remove('driverFailure')}
Test-Observed 'failed count' {param($v)$v.failed=1}
Test-Observed 'incomplete passing count' {param($v)$v.passed=24}
Test-Observed 'duplicate ID' {param($v)$v.observations[1].id=$v.observations[0].id}
Test-Observed 'changed frozen scope' {param($v)$v.observations[0].scope='changed'}
Test-Observed 'wrong runtime' {param($v)$v.extensionBundleSha256=('a'*64)}
Test-Observed 'wrong source proof' {param($v)$v.sourceProofSha256=('a'*64)}
Test-Observed 'runtime binding omitted' {param($v)$v.runtimeBindings=@($v.runtimeBindings|Select-Object -First 3)}
Test-Observed 'unfinished source handle' {param($v)$v.unfinishedFixtureHandles=1}
Test-Observed 'source handle close missing' {param($v)$v.sourceHandleCloses=1}
Test-Observed 'raw environment document' {param($v)$v.originalEnvironmentDocumentEvents=1}
Test-Observed 'active reader remains' {param($v)$v.readStatus.activeReads=1}
Test-Observed 'primary not withdrawn' {param($v)$v.readStatus.status='READY'}
Test-Observed 'missing peer' {param($v)$v.peerChildren=@()}
Test-Observed 'peer still running' {param($v)$v.peerChildren[0].closed=$false}
Test-Observed 'peer missing EOF' {param($v)$v.peerChildren[0].stderrEOF=$false}
Test-Observed 'peer nonzero' {param($v)$v.peerChildren[0].code=1}
Test-Observed 'peer signal' {param($v)$v.peerChildren[0].signal='SIGTERM'}
Test-Observed 'peer null signal omitted' {param($v)$v.peerChildren[0].PSObject.Properties.Remove('signal')}
Test-Observed 'peer streams omitted' {param($v)$v.peerChildren[0].streams=@()}
Test-Observed 'peer duplicate channel' {param($v)$v.peerChildren[0].streams[1].channel='stdout'}
Test-Observed 'peer wrong profile' {param($v)$v.peerChildren[0].profile='C:\Synthetic-unowned-profile'}
Test-Observed 'workload fewer bulk inputs' {param($v)$v.measurements[0].bulkSyntheticFiles=4095}
Test-Observed 'workload expired' {param($v)$v.measurements[0].milliseconds=60000}
Test-Observed 'restart withdrawal absent' {param($v)$v.safeWithdrawal='NOT_COMPLETED'} $false 'restart'
Test-Observed 'restart unexpected source handles' {param($v)$v.sourceHandleOpens=2;$v.sourceHandleCloses=2} $false 'restart'
Write-Output ('PROJECTED_RESULT_COMPONENTS_PASS controls='+$taskCount+'; no native coverage/process/file/clock observation.')
