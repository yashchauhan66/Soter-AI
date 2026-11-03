$ErrorActionPreference='Stop'
$taskTokens=$null;$taskErrors=$null
foreach($taskName in @('affected-ps51-01.ps1','affected-editor-01.ps1','affected-mcp-01.ps1','affected-retained-01.ps1','affected-functional10-01.ps1','affected-security17-01.ps1','affected-native-binding-01.ps1','affected-preparation-pipe-ownership-01.ps1')){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count -ne 0){throw 'Affected PowerShell syntax refused.'}}
Write-Output 'PASS: eight affected PowerShell files parsed; no native run.'
