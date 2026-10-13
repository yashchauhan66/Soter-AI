$ErrorActionPreference = 'Stop'
$taskRoot = (Get-Location).Path
$taskEvidenceRoot = 'docs/project-privacy/evidence/20261012-final-local'
$taskFunctional = Get-Content -LiteralPath "$taskEvidenceRoot/raw/functional/functional-results.json" -Raw | ConvertFrom-Json
$taskSecurity = Get-Content -LiteralPath "$taskEvidenceRoot/raw/security/live-host.json" -Raw | ConvertFrom-Json
$taskNative = Get-Content -LiteralPath "$taskEvidenceRoot/raw/native/results.json" -Raw | ConvertFrom-Json
$taskComparison = Get-Content -LiteralPath "$taskEvidenceRoot/host-comparison.json" -Raw | ConvertFrom-Json
$taskVisual = Get-Content -LiteralPath "$taskEvidenceRoot/visual-results.json" -Raw | ConvertFrom-Json
$taskInventory = Get-Content -LiteralPath "$taskEvidenceRoot/vsix-integrity.json" -Raw | ConvertFrom-Json
$taskTap = Get-Content -LiteralPath "$taskEvidenceRoot/full-tests-agent-target.log"
$taskComparisonMismatches = 0
foreach ($taskRow in $taskComparison.rows) {
    $taskRaw = @($taskSecurity.results | Where-Object attack -EQ $taskRow.case)
    if ($taskRaw.Count -ne 1 -or $taskRaw[0].status -ne $taskRow.current) { $taskComparisonMismatches++ }
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskCandidatePath = "$taskEvidenceRoot/soterai-project-privacy-0.6.3-20261012.vsix"
$taskCandidate = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $taskRoot $taskCandidatePath))
$taskZipMismatchCount = 0
try {
    foreach ($taskExpected in $taskInventory.entries) {
        $taskEntry = $taskCandidate.GetEntry($taskExpected.name)
        if (-not $taskEntry) { $taskZipMismatchCount++; continue }
        $taskStream = $taskEntry.Open()
        $taskSha = [System.Security.Cryptography.SHA256]::Create()
        try { $taskEntryHash = ([BitConverter]::ToString($taskSha.ComputeHash($taskStream))).Replace('-','').ToLowerInvariant() }
        finally { $taskStream.Dispose(); $taskSha.Dispose() }
        if ($taskEntry.Length -ne $taskExpected.bytes -or $taskEntryHash -ne $taskExpected.sha256) { $taskZipMismatchCount++ }
    }
    $taskCandidateEntryCount = $taskCandidate.Entries.Count
} finally { $taskCandidate.Dispose() }
$taskNormalPath = 'packages/vscode-extension/soterai-ide-guard-0.6.3.vsix'
$taskNormal = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $taskRoot $taskNormalPath))
try {
    $taskNormalEntryCount = $taskNormal.Entries.Count
    $taskNormalHasVerification = $null -ne $taskNormal.GetEntry('extension/verification/project-privacy-verification.json')
    $taskNormalExtension = $taskNormal.GetEntry('extension/dist/extension.js')
    if (-not $taskNormalExtension) { throw 'Normal VSIX extension entry missing' }
    $taskStream = $taskNormalExtension.Open()
    $taskSha = [System.Security.Cryptography.SHA256]::Create()
    try { $taskNormalExtensionHash = ([BitConverter]::ToString($taskSha.ComputeHash($taskStream))).Replace('-','').ToLowerInvariant() }
    finally { $taskStream.Dispose(); $taskSha.Dispose() }
} finally { $taskNormal.Dispose() }
$taskPaths = @(
    'packages/vscode-extension/package.json',
    'packages/vscode-extension/README.md',
    'packages/vscode-extension/src/extension.ts',
    'packages/vscode-extension/src/project-privacy/ProjectFileAccess.ts',
    'packages/vscode-extension/src/project-privacy/SafeFileView.ts',
    'packages/vscode-extension/src/project-privacy/ReadTerminal.ts',
    'packages/vscode-extension/src/project-privacy/commands.ts',
    'packages/vscode-extension/src/project-privacy/panel.ts',
    'packages/vscode-extension/src/ai-boundary/BoundarySnapshot.ts',
    'packages/vscode-extension/src/ai-boundary/commands.ts',
    'packages/vscode-extension/src/ai-boundary/policy.ts',
    'packages/vscode-extension/src/terminal/ShellExecutionWatcher.ts',
    'packages/vscode-extension/src/secret-shield/SecretFileInterceptor.ts',
    'packages/vscode-extension/src/secret-shield/AutoVaultMigration.ts',
    'packages/vscode-extension/src/firewall/VaultManager.ts',
    'packages/vscode-extension/src/broker/BrokerManager.ts',
    'packages/vscode-extension/src/broker/autoStart.ts',
    'packages/guard-core/src/ContextRedactor.ts',
    'packages/guard-core/src/sensitiveFiles.ts',
    'docs/project-privacy/SCORECARD.md',
    'docs/project-privacy/USER-GUIDE.md',
    'docs/project-privacy/CLINE-ASSESSMENT.md',
    'docs/project-privacy/FINAL-LOCAL-REPORT.md',
    "$taskEvidenceRoot/full-tests-agent-target.log",
    "$taskEvidenceRoot/raw/functional/functional-results.json",
    "$taskEvidenceRoot/raw/security/live-host.json",
    "$taskEvidenceRoot/raw/native/results.json",
    "$taskEvidenceRoot/host-comparison.json",
    "$taskEvidenceRoot/vsix-integrity.json",
    "$taskEvidenceRoot/visual-results.json",
    'docs/soterai-lite/REQUIREMENTS-AUDIT-20261013.md'
)
$taskSourceHashes = @($taskPaths | ForEach-Object {
    $taskItem = Get-Item -LiteralPath $_
    [ordered]@{path=$_;bytes=$taskItem.Length;sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash}
})
$taskDrive = [System.IO.DriveInfo]::new('C:\')
$taskRecord = [ordered]@{
    inspectedAtUtc=[DateTime]::UtcNow.ToString('o')
    scope='STATIC-ONLY source assessment and read-only recount/hash inspection of retained 2026-10-12 synthetic execution evidence; no product tests rerun'
    independence='LOW'
    availableDiskBytes=$taskDrive.AvailableFreeSpace
    diskGatePass=$taskDrive.AvailableFreeSpace -ge 20000000000
    tap=[ordered]@{
        testRecords=@($taskTap | Where-Object {$_ -match "^\s+type: 'test'\s*$"}).Count
        suiteRecords=@($taskTap | Where-Object {$_ -match "^\s+type: 'suite'\s*$"}).Count
        failingTapRecords=@($taskTap | Where-Object {$_ -match '^\s*not ok\s+\d+\s+-'}).Count
        skippedTapRecords=@($taskTap | Where-Object {$_ -match '^\s*ok\s+\d+\s+-.*#\s*SKIP\b'}).Count
    }
    functionalStatuses=@($taskFunctional.observations | Group-Object status | Select-Object Name,Count)
    securityStatuses=@($taskSecurity.results | Group-Object status | Select-Object Name,Count)
    nativeStatuses=@($taskNative.observations | Group-Object status | Select-Object Name,Count)
    comparisonRows=$taskComparison.rows.Count
    comparisonMismatches=$taskComparisonMismatches
    visualAggregate=[ordered]@{passed=$taskVisual.passed;failed=$taskVisual.failed;individuallyRecounted=$false}
    testedCandidate=[ordered]@{path=$taskCandidatePath;sha256=(Get-FileHash -LiteralPath $taskCandidatePath -Algorithm SHA256).Hash;zipEntries=$taskCandidateEntryCount;inventoryEntriesChecked=$taskInventory.entries.Count;inventoryMismatches=$taskZipMismatchCount}
    currentExtensionSha256=(Get-FileHash -LiteralPath 'packages/vscode-extension/dist/extension.js' -Algorithm SHA256).Hash
    normalLocalVsix=[ordered]@{path=$taskNormalPath;sha256=(Get-FileHash -LiteralPath $taskNormalPath -Algorithm SHA256).Hash;zipEntries=$taskNormalEntryCount;extensionSha256=$taskNormalExtensionHash;hasProjectPrivacyVerification=$taskNormalHasVerification}
    sourceAndEvidenceHashes=$taskSourceHashes
    freshProductTests='NOT-RUN'
    newLiteBundle='NOT-BUILT'
    liteCoverageScore='UNMEASURED'
}
$taskRecord | ConvertTo-Json -Depth 7 | Out-File -LiteralPath (Join-Path $PSScriptRoot 'audit-raw-metadata.json') -Encoding utf8 -NoClobber
$taskRecord.Remove('sourceAndEvidenceHashes')
$taskRecord | ConvertTo-Json -Depth 7
if ($taskComparisonMismatches -ne 0 -or $taskZipMismatchCount -ne 0) { exit 1 }

