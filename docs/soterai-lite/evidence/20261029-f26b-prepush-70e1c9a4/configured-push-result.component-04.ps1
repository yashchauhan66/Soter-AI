$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Read-TestJson([string]$Name){Get-Content -LiteralPath (Join-Path $PSScriptRoot $Name) -Raw -Encoding utf8|ConvertFrom-Json}
$taskTokens=$null;$taskErrors=$null;$taskAst=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'configured-push-launch-candidate-05.ps1.txt'),[ref]$taskTokens,[ref]$taskErrors);if($taskErrors.Count){throw 'Actual configured-push candidate syntax failed.'}
$taskFunction=@($taskAst.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq 'Assert-F26BResult'},$true));if($taskFunction.Count -ne 1){throw 'Exact configured-push validator required.'};. ([scriptblock]::Create($taskFunction[0].Extent.Text))
$taskActual=Read-TestJson 'f26b-prepush-native-20261101T065751Z-1999e2f2/primary-results.json';$taskRestart=Read-TestJson 'f26b-prepush-native-20261101T065751Z-1999e2f2/restart-results.json';$taskExecution=Read-TestJson 'f26b-prepush-native-20261101T065751Z-1999e2f2/freeze.json';$taskDriver=Read-TestJson 'configured-push-driver-provenance-02.json';$taskFreeze=Read-TestJson 'configured-push-static-result-02.json'
$taskExpected=$taskActual.extensionBundleSha256;$taskWorkerExpected=$taskActual.workerSha256;$taskDriverExpected=$taskDriver.driver.sha256;$taskCodeExpected=$taskActual.codeSha256;$taskRuntimeBindings=$taskExecution.runtimeBindings;$taskManifestExpected=$taskActual.executionManifest.sha256;$taskPushAuthorizationSha='b'*64
function Project-TestReport{
 $p=$taskActual|ConvertTo-Json -Depth 100|ConvertFrom-Json
 $p.expectedChecks=8;$p.passed=8;$p.failed=0;$p.notRun=0;$p.driverFailure=$null;$p.scope='F26B_CONFIGURED_LOCAL_FILE_PUSH_TWO_INVOCATIONS_ONLY';$p.hostProbeSha256=$taskDriverExpected
 $p.observations=@($taskFreeze.cases|ForEach-Object{[pscustomobject]@{id=$_.id;scope=$_.scope;status='PASS'}})
 $p.children=@($taskActual.children[0],$taskActual.children[1])|ConvertTo-Json -Depth 100|ConvertFrom-Json
 $p.children[0].kind='configured-push';$p.children[0].operation='ACTUAL_GIT_PUSH_LOCAL_PUBLIC';$p.children[0].code=0
 $p.children[1].kind='configured-push';$p.children[1].operation='ACTUAL_GIT_PUSH_LOCAL_BLOCKED_SECRET';$p.children[1].code=1
 $p.requests=@(($taskActual.requests|Where-Object{$_.status -ceq 'ALLOW'}|Select-Object -First 1),($taskActual.requests|Where-Object{$_.status -ceq 'BLOCK'}|Select-Object -First 1))|ConvertTo-Json -Depth 100|ConvertFrom-Json
 $p.ownerListeners=@($taskRestart.ownerListeners[0])|ConvertTo-Json -Depth 100|ConvertFrom-Json
 $p.safeWithdrawal='EXACT_ORIGINAL_HOOK_MODE_AND_FLAG_RESTORED_OWNER_CLOSED'
 Add-Member -InputObject $p -MemberType NoteProperty -Name pushInvocations -Value 2
 Add-Member -InputObject $p -MemberType NoteProperty -Name externalNetwork -Value 'NOT_AUTHORIZED_NOT_RUN'
 Add-Member -InputObject $p -MemberType NoteProperty -Name localOnlyAuthoritySha256 -Value $taskPushAuthorizationSha
 return $p
}
function Must-Refuse($p){$refused=$false;try{Assert-F26BResult $p 'primary'}catch{$refused=$true};if(-not $refused){throw 'Tampered projected result was accepted.'}}
$script:taskPassed=0;$script:taskFailed=0;$script:taskIndex=0
function Check([string]$Name,[scriptblock]$Work){$script:taskIndex++;try{& $Work;$script:taskPassed++;'ok '+$script:taskIndex+' - '+$Name}catch{$script:taskFailed++;'not ok '+$script:taskIndex+' - '+$Name+' ['+$_.Exception.GetType().Name+']'}}
Check 'projected eight-case metadata satisfies actual strict validator without native or push execution' {Assert-F26BResult (Project-TestReport) 'primary'}
Check 'missing null success property is refused' {$p=Project-TestReport;$p.PSObject.Properties.Remove('driverFailure');Must-Refuse $p}
Check 'failed frozen observation is refused' {$p=Project-TestReport;$p.observations[0].status='FAIL';Must-Refuse $p}
Check 'wrong frozen case scope is refused' {$p=Project-TestReport;$p.observations[0].scope='CHANGED_COMPONENT_SCOPE';Must-Refuse $p}
Check 'third local push count is refused' {$p=Project-TestReport;$p.pushInvocations=3;Must-Refuse $p}
Check 'external network authority substitution is refused' {$p=Project-TestReport;$p.externalNetwork='AUTHORIZED';Must-Refuse $p}
Check 'incomplete actual child EOF is refused' {$p=Project-TestReport;$p.children[0].stdoutEOF=$false;Must-Refuse $p}
Check 'wrong ordered local signed decision is refused' {$p=Project-TestReport;$p.requests[0].status='BLOCK';Must-Refuse $p}
Check 'unclosed owner listener is refused' {$p=Project-TestReport;$p.ownerListeners[0].closed=$false;Must-Refuse $p}
Check 'changed local authority digest is refused' {$p=Project-TestReport;$p.localOnlyAuthoritySha256='0'*64;Must-Refuse $p}
Check 'changed loaded driver identity is refused' {$p=Project-TestReport;$p.hostProbeSha256='0'*64;Must-Refuse $p}
Check 'missing reviewed withdrawal is refused' {$p=Project-TestReport;$p.safeWithdrawal='NOT_RUN';Must-Refuse $p}
'1..'+$script:taskIndex;'# tests '+$script:taskIndex;'# pass '+$script:taskPassed;'# fail '+$script:taskFailed
'# scope component projections only; original native results unchanged; actual Git pushes0'
if($script:taskFailed){exit 1}
