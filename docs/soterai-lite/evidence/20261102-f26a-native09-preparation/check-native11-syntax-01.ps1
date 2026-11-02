$ErrorActionPreference='Stop'
foreach($taskName in @('native11-current-candidate-01.ps1.txt','native11-current-preapproval-01.ps1')){
 $taskTokens=$null;$taskErrors=$null
 [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors)
 if($taskErrors.Count -ne 0){throw ($taskName+': '+($taskErrors.Message -join '; '))}
}
& 'C:\Program Files\nodejs\node.exe' --check (Join-Path $PSScriptRoot 'run-native11-current-chain-01.cjs')
if($LASTEXITCODE -ne 0){throw 'Native11 runner syntax failed.'}
Write-Output 'PASS_NATIVE11_PS2_JS1_SYNTAX_ONLY_NOT_RUN'
