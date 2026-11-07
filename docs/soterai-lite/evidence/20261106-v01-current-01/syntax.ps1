$ErrorActionPreference='Stop'
$taskTokens=$null;$taskErrors=$null
foreach($taskName in @('affected-ps51-05.ps1','affected-editor-05.ps1','affected-mcp-05.ps1','affected-retained-05.ps1','affected-functional10-05.ps1','affected-security17-05.ps1','affected-functional-security-05.ps1','affected-preparation-pipe-ownership-01.ps1','affected-native-binding-05.ps1')){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count){throw 'PowerShell syntax failure'}}
Write-Output 'PASS: all nine affected helpers parsed; no host launch'
