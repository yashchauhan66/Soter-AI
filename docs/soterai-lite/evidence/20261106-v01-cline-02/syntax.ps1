$ErrorActionPreference='Stop'
$taskTokens=$null;$taskErrors=$null
foreach($taskName in @('run-current-route.ps1','pipe-ownership.ps1','updater-preflight.ps1')){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count){throw ($taskErrors|Out-String)}}
Write-Output 'PASS: successor syntax only; no native launch'
