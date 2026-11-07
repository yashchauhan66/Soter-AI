$ErrorActionPreference='Stop'
$taskTokens=$null;$taskErrors=$null
foreach($taskName in @('run-current-route.ps1','pipe-ownership.ps1')){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count){throw 'Route PowerShell syntax failed'}}
Write-Output 'PASS: route wrapper syntax; no execution'
