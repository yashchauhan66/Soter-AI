param([Parameter(Mandatory=$true)][string]$FilePath,
    [string[]]$ArgumentList,
    [Parameter(Mandatory=$true)][string]$OutputFile,
    [string]$WorkingDirectory)
$ErrorActionPreference='Stop'
if (Test-Path -LiteralPath $OutputFile) { throw 'Evidence overwrite refused.' }
if ($WorkingDirectory) { Push-Location -LiteralPath $WorkingDirectory }
try {
    $ErrorActionPreference='Continue'
    $taskCheckRaw = & $FilePath @ArgumentList 2>&1
    $taskCheckExit = $LASTEXITCODE
    $ErrorActionPreference='Stop'
    $taskCheckRaw | Out-File -LiteralPath $OutputFile -Encoding utf8 -NoClobber
    $taskCheckResult = @{ file=$FilePath; arguments=$ArgumentList; exitCode=$taskCheckExit;
        output=$OutputFile; sha256=(Get-FileHash -LiteralPath $OutputFile -Algorithm SHA256).Hash;
        observedAt=[DateTime]::UtcNow.ToString('o') }
    $taskCheckResult | ConvertTo-Json -Depth 5 | Out-File -LiteralPath ($OutputFile + '.result.json') -Encoding utf8 -NoClobber
    $taskCheckResult | ConvertTo-Json -Depth 5
    exit $taskCheckExit
} finally { if ($WorkingDirectory) { Pop-Location } }
