$ErrorActionPreference='Stop'
$taskTokens=$null;$taskErrors=$null
foreach($taskName in @('affected-ps51-05.ps1','affected-editor-05.ps1','affected-mcp-05.ps1','affected-retained-05.ps1','affected-functional10-05.ps1','affected-security17-05.ps1','affected-functional-security-05.ps1','affected-native-binding-05.ps1','affected-preparation-pipe-ownership-01.ps1','observe-prior-owner-01.ps1')){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count -ne 0){throw 'Affected PowerShell syntax refused.'}}
Write-Output 'PASS: ten sealed affected/observer PowerShell files parsed; no native run.'
