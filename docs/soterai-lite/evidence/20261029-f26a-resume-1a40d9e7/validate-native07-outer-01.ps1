$ErrorActionPreference='Stop'
$taskTokens=$null;$taskErrors=$null
$taskAst=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'start-native07-chain-01.ps1'),[ref]$taskTokens,[ref]$taskErrors)
if(@($taskErrors).Count){$taskErrors;throw 'Invalid native07 outer syntax'}
foreach($taskRequired in @('-WindowStyle Hidden','native07-consumption-01.json','EXPLICIT_USER_AUTHORIZATION_ONE_F26A_NATIVE07','-NoClobber')){
 if($taskRequired -ceq '-NoClobber'){if(-not $taskAst.Extent.Text.Contains('[IO.FileMode]::CreateNew')){throw 'Owner evidence must be exclusive'}}
 elseif(-not $taskAst.Extent.Text.Contains($taskRequired)){throw 'Missing native07 outer guard'}
}
[ordered]@{status='NATIVE07_OUTER_STATIC_SYNTAX_GUARDS_PASS_NOT_EXECUTED';files=@('start-native07-chain-01.ps1');signalsRequested=0}|ConvertTo-Json -Compress
