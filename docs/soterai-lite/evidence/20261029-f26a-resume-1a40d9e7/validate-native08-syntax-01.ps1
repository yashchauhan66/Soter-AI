$ErrorActionPreference='Stop'
$taskFiles=@('native08-candidate-01.ps1.txt','host-current-binding-08.ps1','artifact-binding-08.ps1','start-native08-chain-01.ps1')
foreach($taskFile in $taskFiles){
 $taskTokens=$null;$taskErrors=$null
 $taskAst=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskFile),[ref]$taskTokens,[ref]$taskErrors)
 if(@($taskErrors).Count){$taskErrors;throw ('Invalid native08 packet syntax: '+$taskFile)}
 $taskText=$taskAst.Extent.Text
 if($taskFile -ceq 'native08-candidate-01.ps1.txt'){
  foreach($taskRequired in @('EXPLICIT_USER_AUTHORIZATION_ONE_F26A_NATIVE08','native08-user-approval-01.json','native08-consumption-01.json','NATIVE08-STORAGE-FIX-PROPOSAL01.md','storage-current-admission-09.cjs','native-current-binding-09.json','FRESH1037_FULL09_COMPILER09_BUILD09_ATTEMPT02_BOUND_NATIVE_NOT_RUN')){if(-not $taskText.Contains($taskRequired)){throw 'Current storage fix/fresh approval gate missing'}}
  foreach($taskForbidden in @('native06-user-approval-01.json','native07-user-approval-01.json','native06-consumption-01.json','native07-consumption-01.json')){if($taskText.Contains($taskForbidden)){throw 'Earlier consumed approval cannot authorize native08'}}
  if($taskText.IndexOf('Write-F26ANewJson $taskConsumption') -ge $taskText.IndexOf('$taskName=')){throw 'Consume exactly once before any new native execution directory'}
 }
 if($taskFile -ceq 'start-native08-chain-01.ps1' -and -not $taskText.Contains('-WindowStyle Hidden')){throw 'Owned helper must start hidden'}
}
foreach($taskFile in @('native08-user-approval-01.json','native08-consumption-01.json','run-precommit-native-08.ps1')){if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $taskFile)){throw 'Unapproved native08 must not be materialized/consumed'}}
[ordered]@{status='CURRENT_NATIVE08_SYNTAX_FRESH_SINGLE_APPROVAL_AND1037_BINDING_STATIC_PASS_NOT_EXECUTED';files=$taskFiles;oracles=34;signalsRequested=0}|ConvertTo-Json -Depth 4 -Compress
