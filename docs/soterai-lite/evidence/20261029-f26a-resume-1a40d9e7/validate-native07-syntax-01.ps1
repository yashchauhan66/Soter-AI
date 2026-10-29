$ErrorActionPreference='Stop'
$taskNames=@('native07-candidate-01.ps1.txt','host-current-binding-07.ps1','artifact-binding-01.ps1')
foreach($taskName in $taskNames){
 $taskTokens=$null;$taskErrors=$null
 $taskAst=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors)
 if(@($taskErrors).Count){$taskErrors;throw ('Invalid diagnostic07 syntax: '+$taskName)}
 if($taskName -ceq 'native07-candidate-01.ps1.txt'){
  $taskText=$taskAst.Extent.Text
  foreach($taskRequired in @('EXPLICIT_USER_AUTHORIZATION_ONE_F26A_NATIVE07','native07-user-approval-01.json','native07-consumption-01.json','NATIVE07-DIAGNOSTIC-PROPOSAL01.md','diagnostic-admission-07.cjs')){if(-not $taskText.Contains($taskRequired)){throw 'Fresh explicit-approval/diagnostic admission gate missing'}}
  foreach($taskForbidden in @('native06-user-approval-01.json','native06-consumption-01.json','EXPLICIT_USER_AUTHORIZATION_ONE_F26A_NATIVE06')){if($taskText.Contains($taskForbidden)){throw 'Consumed native06 approval must not authorize successor'}}
  if(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'native07-user-approval-01.json')){throw 'Native07 approval unexpectedly present'}
  if(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'native07-consumption-01.json')){throw 'Native07 unexpectedly consumed'}
  if(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'run-precommit-native-07.ps1')){throw 'Native07 unexpectedly materialized'}
 }
}
[ordered]@{status='NATIVE07_SYNTAX_AND_SINGLE_FRESH_APPROVAL_GATES_STATIC_PASS_NOT_EXECUTED';files=$taskNames;oracles=34;signalsRequested=0}|ConvertTo-Json -Depth 3 -Compress
