$ErrorActionPreference='Stop'
$taskTokens=$null;$taskErrors=$null
foreach($taskName in @('affected-ps51-02.ps1','affected-editor-02.ps1','affected-mcp-02.ps1','affected-retained-02.ps1','affected-functional10-02.ps1','affected-security17-02.ps1','affected-functional-security-02.ps1','affected-native-binding-02.ps1','affected-preparation-pipe-ownership-01.ps1')){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count -ne 0){throw 'Affected PowerShell syntax refused.'}}
Write-Output 'PASS: nine affected PowerShell files parsed; no native run.'
