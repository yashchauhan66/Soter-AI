$ErrorActionPreference='Stop'
$taskTokens=$null;$taskErrors=$null
foreach($taskName in @('affected-ps51-04.ps1','affected-editor-04.ps1','affected-mcp-04.ps1','affected-retained-04.ps1','affected-functional10-04.ps1','affected-security17-04.ps1','affected-functional-security-04.ps1','affected-native-binding-04.ps1','affected-preparation-pipe-ownership-01.ps1','observe-prior-owner-01.ps1')){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count -ne 0){throw 'Affected PowerShell syntax refused.'}}
Write-Output 'PASS: ten final affected/observer PowerShell files parsed; no native run.'
