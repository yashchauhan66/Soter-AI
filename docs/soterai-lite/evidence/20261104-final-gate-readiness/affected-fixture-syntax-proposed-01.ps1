$ErrorActionPreference = 'Stop'
$taskTokens = $null
$taskErrors = $null
$taskBinding = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'prepared-affected-binding-01.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskNames = @($taskBinding.families | ForEach-Object { [IO.Path]::GetFileName($_.helper.path) })
$taskNames += @('affected-functional-security-05.ps1','affected-functional10-05.ps1','affected-security17-05.ps1','affected-native-binding-current-01.ps1','affected-preparation-pipe-ownership-01.ps1')
foreach ($taskName in $taskNames) {
    [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName), [ref]$taskTokens, [ref]$taskErrors)
    if (@($taskErrors).Count -ne 0) { throw ('Affected fixture syntax refused: ' + $taskName) }
}
Write-Output ('PASS: ' + $taskNames.Count + ' PowerShell fixture files parsed; native launches 0.')
