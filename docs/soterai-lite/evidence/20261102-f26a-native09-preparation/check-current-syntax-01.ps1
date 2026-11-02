$ErrorActionPreference='Stop'
$taskNames=@('native09-current-candidate-01.ps1.txt','native09-current-preapproval-01.ps1','native09-host-current-binding-01.ps1','native09-artifact-binding-01.ps1')
foreach($taskName in $taskNames){
 $taskTokens=$null;$taskErrors=$null
 [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors)
 if($taskErrors.Count -ne 0){throw ($taskName+': '+($taskErrors.Message -join '; '))}
}
& 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'check-current-javascript-syntax-01.cjs')
if($LASTEXITCODE -ne 0){throw 'JavaScript syntax check failed.'}
@{status='PASS_SYNTAX_ONLY_NO_NATIVE_LAUNCH';powershellFiles=$taskNames;parserErrors=0;nativeLaunches=0}|ConvertTo-Json -Depth 5
