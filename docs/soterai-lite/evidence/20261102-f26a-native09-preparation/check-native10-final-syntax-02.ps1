$ErrorActionPreference='Stop'
foreach($taskName in @('native10-current-candidate-02.ps1.txt','native10-current-preapproval-02.ps1')){
 $taskTokens=$null;$taskErrors=$null
 [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors)
 if($taskErrors.Count -ne 0){throw ($taskName+': '+($taskErrors.Message -join '; '))}
}
Write-Output 'PASS_FINAL_PS2_SYNTAX_ONLY_NATIVE10_NOT_RUN'
