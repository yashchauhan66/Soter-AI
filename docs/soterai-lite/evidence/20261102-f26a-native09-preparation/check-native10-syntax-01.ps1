$ErrorActionPreference='Stop'
foreach($taskName in @('native10-current-candidate-01.ps1.txt','native10-current-preapproval-01.ps1','native10-prior-owners-01.ps1')){
 $taskTokens=$null;$taskErrors=$null
 [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors)
 if($taskErrors.Count -ne 0){throw ($taskName+': '+($taskErrors.Message -join '; '))}
}
foreach($taskName in @('run-native10-current-chain-01.cjs','native10-bootstrap-admission-01.cjs','json-bootstrap-component-01.cjs')){
 & 'C:\Program Files\nodejs\node.exe' --check (Join-Path $PSScriptRoot $taskName)
 if($LASTEXITCODE -ne 0){throw ($taskName+': syntax error')}
}
Write-Output 'PASS_PS3_JS3_SYNTAX_ONLY_NATIVE10_NOT_RUN'
