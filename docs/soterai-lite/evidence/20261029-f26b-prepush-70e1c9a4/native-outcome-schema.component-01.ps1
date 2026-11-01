param([Parameter(Mandatory=$true)][ValidateSet('native-outcome-before-projection-01.json','native-outcome-after-projection-01.json')][string]$Projection)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Read-ComponentJson([string]$Name){Get-Content -LiteralPath (Join-Path $PSScriptRoot $Name) -Raw -Encoding utf8|ConvertFrom-Json}
$taskTokens=$null;$taskErrors=$null
$taskAst=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'native-launch-candidate-17.ps1.txt'),[ref]$taskTokens,[ref]$taskErrors)
if($taskErrors.Count){throw 'Actual launcher parse failed.'}
$taskFunction=@($taskAst.FindAll({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Assert-F26BResult'},$true))
if($taskFunction.Count -ne 1){throw 'Exact original validator required.'}
. ([scriptblock]::Create($taskFunction[0].Extent.Text))
$taskOriginal=Read-ComponentJson 'f26b-prepush-native-20261101T060429Z-575ce4ea/primary-results.json'
$taskFreeze=Read-ComponentJson 'native-fixture-static-result-08.json'
$taskBinding=Read-ComponentJson 'native-launch-binding-11.json'
$taskExecutionFreeze=Read-ComponentJson 'f26b-prepush-native-20261101T060429Z-575ce4ea/freeze.json'
$taskExpected=$taskBinding.frontendSha256;$taskWorkerExpected=$taskExecutionFreeze.workerSha256;$taskDriverExpected=$taskBinding.driver.sha256;$taskCodeExpected='9f33ede68f3317402280fa997bc8963f93e67f2905e416d6bb092c03d60a37eb';$taskRuntimeBindings=$taskExecutionFreeze.runtimeBindings
$taskManifestExpected=$taskOriginal.executionManifest.sha256
$taskProjection=Read-ComponentJson $Projection
if($taskProjection.scope -cne 'SIMULATED_SERIALIZATION_COMPONENT_ONLY_NOT_NATIVE_ACCEPTANCE'){throw 'Component-only projection required.'}
function Copy-Report($Property){
 $taskCopy=$taskOriginal|ConvertTo-Json -Depth 100|ConvertFrom-Json
 if($null -ne $Property.PSObject.Properties['driverFailure']){Add-Member -InputObject $taskCopy -MemberType NoteProperty -Name driverFailure -Value $Property.driverFailure}
 return $taskCopy
}
$script:taskPassed=0;$script:taskFailed=0;$script:taskIndex=0
function Check-Component([string]$Name,[scriptblock]$Work){$script:taskIndex++;try{& $Work;$script:taskPassed++;'ok '+$script:taskIndex+' - '+$Name}catch{$script:taskFailed++;'not ok '+$script:taskIndex+' - '+$Name+' ['+$_.Exception.GetType().Name+']'}}
function Must-Refuse($Value){$taskRefused=$false;try{Assert-F26BResult $Value 'primary'}catch{$taskRefused=$true};if(-not $taskRefused){throw 'Tampered component report accepted.'}}
Check-Component 'actual undefined-success producer property satisfies unchanged strict validator' {Assert-F26BResult (Copy-Report $taskProjection.success) 'primary'}
Check-Component 'ordinary failure remains represented and refused' {if($taskProjection.ordinaryFailure.driverFailure -cne 'NativePrePushComponentFailure'){throw 'Failure label changed.'};Must-Refuse (Copy-Report $taskProjection.ordinaryFailure)}
Check-Component 'busy-owner failure remains represented and refused' {if($taskProjection.busyFailure.driverFailure -cne 'STOP_UNCONFIRMED'){throw 'Busy label changed.'};Must-Refuse (Copy-Report $taskProjection.busyFailure)}
Check-Component 'missing required property is still refused' {Must-Refuse (Copy-Report ([pscustomobject]@{}))}
Check-Component 'failed observation cannot acquire PASS from schema correction' {$taskCopy=Copy-Report $taskProjection.success;$taskCopy.observations[0].status='FAIL';Must-Refuse $taskCopy}
Check-Component 'incomplete child EOF remains refused' {$taskCopy=Copy-Report $taskProjection.success;$taskCopy.children[0].stdoutEOF=$false;Must-Refuse $taskCopy}
Check-Component 'changed runtime identity remains refused' {$taskCopy=Copy-Report $taskProjection.success;$taskCopy.extensionBundleSha256='0'*64;Must-Refuse $taskCopy}
Check-Component 'non-loopback owner observation remains refused' {$taskCopy=Copy-Report $taskProjection.success;$taskCopy.ownerListeners[0].loopback=$false;Must-Refuse $taskCopy}
Check-Component 'changed frozen case scope remains refused' {$taskCopy=Copy-Report $taskProjection.success;$taskCopy.observations[0].scope='COMPONENT_ONLY_CHANGED_SCOPE';Must-Refuse $taskCopy}
Check-Component 'push-acceptance substitution remains refused' {$taskCopy=Copy-Report $taskProjection.success;$taskCopy.configuredGitPush='PASS';Must-Refuse $taskCopy}
'1..'+$script:taskIndex
'# tests '+$script:taskIndex
'# pass '+$script:taskPassed
'# fail '+$script:taskFailed
'# scope component serialization only; original native11 root remains failed and restart6 NOT_RUN'
if($script:taskFailed){exit 1}
