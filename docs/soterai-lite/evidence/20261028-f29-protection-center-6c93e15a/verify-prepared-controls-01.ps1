$ErrorActionPreference='Stop'
$taskErrors=[System.Collections.Generic.List[string]]::new()
foreach($taskName in @('affected-native-binding-01.ps1','affected-preparation-pipe-ownership-01.ps1','affected-ps51-01.ps1','affected-editor-01.ps1','affected-functional-security-01.ps1','renderer-listener-query-01.ps1')){
    $taskPath=Join-Path $PSScriptRoot $taskName
    $taskTokens=$null
    $taskParseErrors=$null
    if($taskName -eq 'renderer-listener-query-01.ps1'){
        $taskText=[IO.File]::ReadAllText($taskPath).Replace('ROOT_ID','10000').Replace('PORT_ID','20000').Replace('PROFILE_PATH',"'D:\SoterAI-Lite-test-profiles\syntax-only\profile'").Replace('OUTPUT_PATH',"'D:\SoterAI-Lite-test-profiles\syntax-only\custody.json'")
        [void][Management.Automation.Language.Parser]::ParseInput($taskText,[ref]$taskTokens,[ref]$taskParseErrors)
    }else{
        [void][Management.Automation.Language.Parser]::ParseFile($taskPath,[ref]$taskTokens,[ref]$taskParseErrors)
    }
    if($taskParseErrors.Count -gt 0){$taskErrors.Add($taskName+': '+($taskParseErrors.Message -join '|'))}
}
if($taskErrors.Count -gt 0){throw ($taskErrors -join [Environment]::NewLine)}
Write-Output 'PASS: six prepared PowerShell controls parse; nothing executed.'
