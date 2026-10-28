$ErrorActionPreference='Stop'
$taskFiles=Get-ChildItem -LiteralPath $PSScriptRoot -File -Filter '*.ps1'
$taskChecked=0
foreach($taskFile in $taskFiles){
 $taskTokens=$null;$taskErrors=$null
 [void][Management.Automation.Language.Parser]::ParseFile($taskFile.FullName,[ref]$taskTokens,[ref]$taskErrors)
 if(@($taskErrors).Count){$taskErrors;throw ('Invalid PowerShell: '+$taskFile.Name)}
 $taskChecked++
}
foreach($taskName in @('affected-native-binding-01.ps1','affected-preparation-pipe-ownership-01.ps1','affected-functional10-01.ps1','affected-security17-01.ps1','affected-preparation-functional10-driver-01.js','affected-preparation-security17-driver-01.js')){if(-not(Test-Path -LiteralPath (Join-Path $PSScriptRoot $taskName) -PathType Leaf)){throw 'Missing transitive affected helper'}}
[ordered]@{status='STATIC_SYNTAX_AND_TRANSITIVE_HELPERS_PASS_NOT_NATIVE_EXECUTION';checked=$taskChecked;signalsRequested=0;native06='F26a_USER_DEFERRED_NOT_RUN'}|ConvertTo-Json -Compress
