$ErrorActionPreference='Stop'
$taskNames=@('native06-candidate-02.ps1.txt','host-current-binding-01.ps1','artifact-binding-01.ps1')
foreach($taskName in $taskNames){
 $taskTokens=$null;$taskErrors=$null
 $taskAst=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors)
 if(@($taskErrors).Count){$taskErrors;throw ('Invalid native06 syntax: '+$taskName)}
 if($taskName -ceq 'native06-candidate-02.ps1.txt'){
  $taskText=$taskAst.Extent.Text
  foreach($taskRequired in @('EXPLICIT_USER_AUTHORIZATION_ONE_F26A_NATIVE06','native06-user-approval-01.json','native06-consumption-01.json','NATIVE06-REFRESHED-PROPOSAL01.md')){if(-not $taskText.Contains($taskRequired)){throw 'Fresh explicit-approval gate missing'}}
  if(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'native06-user-approval-01.json')){throw 'Native06 approval unexpectedly present during deferred preparation'}
  if(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'native06-consumption-01.json')){throw 'Native06 unexpectedly consumed during preparation'}
 }
}
[ordered]@{status='CURRENT_NATIVE06_SYNTAX_AND_EXPLICIT_APPROVAL_GATES_STATIC_PASS_NOT_EXECUTED';files=$taskNames;native06='USER_DEFERRED_NOT_RUN';signalsRequested=0}|ConvertTo-Json -Depth 3 -Compress
