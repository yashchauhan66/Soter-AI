$ErrorActionPreference='Stop'
$taskTokens=$null;$taskErrors=$null
foreach($taskName in @('cline.ps1','claude.ps1','gemini.ps1')){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count){throw ($taskErrors|Out-String)}}
Write-Output 'PASS: three transformed wrapper syntax previews; no launch'
