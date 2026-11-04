param(
    [ValidatePattern('^affected-(prior|post)-owner-absence-[0-9]{2}\.json$')][string]$OutputName,
    [switch]$PureControls
)
$ErrorActionPreference = 'Stop'
$taskFamilies = @('logs-native','owned-output-native','artifact-native','streaming-output-native','vault-runtime-native','ps51-native','cmd-native','gitbash-native','history-native','mcp-native','affected-editor','affected-ci','affected-service-account','affected-registry','affected-terraform','affected-container','affected-source','affected-hygiene','affected-vault','retained-native')
$taskFamilyExpression = (@($taskFamilies | ForEach-Object { [regex]::Escape($_) }) -join '|')
$taskProfileExpression = '^D:\\SoterAI-Lite-test-profiles\\(?:f32-installed-[0-9TZ]+-[0-9a-f]{8}\\profile-(?:primary|restricted|upgrade)|f26a-(?:' + $taskFamilyExpression + ')-[0-9TZ]+-[0-9a-f]{8}\\profile|privacy-[0-9TZ]+-[0-9a-f]{8}\\profile|soterai-security-review-[0-9a-f]{32}\\profile)$'
function Get-MarkedSyntheticProfile([string]$CommandLine) {
    $taskMatches = [regex]::Matches($CommandLine, '(?:^|\s)"?--user-data-dir(?:=|\s+)(?:"(?<quoted>[^"]+)"|(?<plain>[^\s"]+))"?', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($taskMatches.Count -ne 1) { throw 'Exactly one marked synthetic profile argument is required.' }
    $taskProfile = if ($taskMatches[0].Groups['quoted'].Success) { $taskMatches[0].Groups['quoted'].Value } else { $taskMatches[0].Groups['plain'].Value }
    if (-not [regex]::IsMatch($taskProfile, $taskProfileExpression, [Text.RegularExpressions.RegexOptions]::IgnoreCase)) { throw 'Matched Code row is outside the exact declared synthetic profile shapes.' }
    return $taskProfile
}
if ($PureControls) {
    $taskValid = @(
        '"Code.exe" "--user-data-dir=D:\SoterAI-Lite-test-profiles\f26a-cmd-native-20261104T020000Z-1234abcd\profile"',
        '"Code.exe" --user-data-dir="D:\SoterAI-Lite-test-profiles\f26a-affected-editor-20261104T020000Z-1234abcd\profile"',
        '"Code.exe" --user-data-dir "D:\SoterAI-Lite-test-profiles\f32-installed-20261104T020000Z-1234abcd\profile-primary"',
        '"Code.exe" --user-data-dir=D:\SoterAI-Lite-test-profiles\privacy-20261104T020000Z-1234abcd\profile',
        '"Code.exe" --user-data-dir=D:\SoterAI-Lite-test-profiles\soterai-security-review-1234567890abcdef1234567890abcdef\profile'
    )
    foreach ($taskLine in $taskValid) { [void](Get-MarkedSyntheticProfile $taskLine) }
    $taskInvalid = @(
        '"Code.exe" --user-data-dir=C:\Users\USER\AppData\Roaming\Code',
        '"Code.exe" D:\SoterAI-Lite-test-profiles\privacy-20261104T020000Z-1234abcd\profile',
        '"Code.exe" --user-data-dir=D:\SoterAI-Lite-test-profiles-other\privacy-20261104T020000Z-1234abcd\profile',
        '"Code.exe" --user-data-dir=D:\SoterAI-Lite-test-profiles\privacy-20261104T020000Z-1234abcd\profile\..\normal',
        '"Code.exe" --user-data-dir=E:\SoterAI-Lite-test-profiles\privacy-20261104T020000Z-1234abcd\profile',
        '"Code.exe" --user-data-dir=D:\SoterAI-Lite-test-profiles\f26a-precommit-native-20261104T020000Z-1234abcd\profile',
        '"Code.exe" --user-data-dir=D:\SoterAI-Lite-test-profiles\privacy-20261104T020000Z-1234abcd\profile --user-data-dir=C:\normal'
    )
    foreach ($taskLine in $taskInvalid) {
        $taskRejected = $false
        try { [void](Get-MarkedSyntheticProfile $taskLine) } catch { $taskRejected = $true }
        if (-not $taskRejected) { throw 'Synthetic profile pure negative control was unexpectedly admitted.' }
    }
    Write-Output 'PASS: 12 actual PowerShell synthetic-profile argument controls; CIM queries0, native launches0, signals0.'
    return
}
if (-not $OutputName) { throw 'An exclusive output filename is required.' }
$taskOutput = Join-Path $PSScriptRoot $OutputName
if (Test-Path -LiteralPath $taskOutput) { throw 'Existing absence evidence refused.' }
$taskRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskBinding = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'prepared-affected-binding-01.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskVendorPath = [IO.Path]::GetFullPath((Join-Path $taskRepo $taskBinding.hostReview.path))
if ((Get-FileHash -LiteralPath $taskVendorPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskBinding.hostReview.sha256) { throw 'Bound current host receipt changed.' }
$taskVendor = Get-Content -LiteralPath $taskVendorPath -Raw -Encoding UTF8 | ConvertFrom-Json
$taskCodePath = [IO.Path]::GetFullPath($taskVendor.currentHost.executable.path)
if ((Get-FileHash -LiteralPath $taskCodePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'af032b86db394d21ba86872f4237a11b8395d2f57e8187963a3718a2cc6666ad') { throw 'Current pinned Code executable changed.' }
$taskPrefixes = @('D:\SoterAI-Lite-test-profiles\f32-installed-', 'D:\SoterAI-Lite-test-profiles\privacy-', 'D:\SoterAI-Lite-test-profiles\soterai-security-review-')
$taskPrefixes += @($taskFamilies | ForEach-Object { 'D:\SoterAI-Lite-test-profiles\f26a-' + $_ + '-' })
$taskClauses = @($taskPrefixes | ForEach-Object { "CommandLine LIKE '%" + $_.Replace('\','\\') + "%'" })
$taskFilter = "Name='Code.exe' AND ExecutablePath='" + $taskCodePath.Replace('\','\\') + "' AND CommandLine LIKE '%--user-data-dir%' AND (" + ($taskClauses -join ' OR ') + ')'
$taskObservations = @()
for ($taskIndex = 0; $taskIndex -lt 2; $taskIndex++) {
    # Server-side filtering returns only declared synthetic Code root rows.
    # No unfiltered normal-profile command line or environment is enumerated.
    $taskRows = @(Get-CimInstance -ClassName Win32_Process -Filter $taskFilter -Property ProcessId,CreationDate,CommandLine,ExecutablePath -ErrorAction Stop)
    $taskOwners = @()
    foreach ($taskRow in $taskRows) {
        if ([IO.Path]::GetFullPath($taskRow.ExecutablePath) -ine $taskCodePath) { throw 'Unexpected Code executable in server-filtered row.' }
        $taskSyntheticProfile = Get-MarkedSyntheticProfile $taskRow.CommandLine
        $taskOwners += @{ pid = [int]$taskRow.ProcessId; creationUtc = $taskRow.CreationDate.ToUniversalTime().ToString('o'); syntheticProfile = $taskSyntheticProfile }
    }
    $taskObservations += @{ observedAt = [DateTime]::UtcNow.ToString('o'); markedCount = $taskOwners.Count; owners = $taskOwners }
    if ($taskIndex -eq 0) { Start-Sleep -Milliseconds 1000 }
}
$taskAbsent = @($taskObservations | Where-Object { $_.markedCount -ne 0 }).Count -eq 0
$taskResult = @{ status = $(if ($taskAbsent) { 'MARKED_SYNTHETIC_CODE_ABSENT_TWICE_NO_SIGNALS' } else { 'MARKED_SYNTHETIC_CODE_STILL_PRESENT_NO_SIGNALS' }); observedAt = [DateTime]::UtcNow.ToString('o'); observations = $taskObservations; codeSha256 = $taskVendor.currentHost.executable.sha256; signalsRequested = 0; scope = 'Server-filtered declared synthetic Code roots with exact profile flag only. No normal profile enumeration, descendant closure, pipe EOF or historical shutdown is inferred.' }
$taskRaw = [Text.UTF8Encoding]::new($false).GetBytes(($taskResult | ConvertTo-Json -Depth 8) + [Environment]::NewLine)
$taskStream = [IO.File]::Open($taskOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try { $taskStream.Write($taskRaw,0,$taskRaw.Length) } finally { $taskStream.Dispose() }
Write-Output ($taskResult | ConvertTo-Json -Depth 8)
if (-not $taskAbsent) { exit 1 }
