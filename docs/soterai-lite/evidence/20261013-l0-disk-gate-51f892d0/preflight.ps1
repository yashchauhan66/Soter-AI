$ErrorActionPreference = 'Stop'
$taskEvidenceDirectory = $PSScriptRoot
$taskDrive = [System.IO.DriveInfo]::new('C:\')
$taskMeasurement = [ordered]@{
    measuredAtUtc = [DateTime]::UtcNow.ToString('o')
    workspace = 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard'
    source = 'System.IO.DriveInfo.AvailableFreeSpace'
    volume = $taskDrive.Name
    isReady = $taskDrive.IsReady
    availableFreeBytes = $taskDrive.AvailableFreeSpace
    totalFreeBytes = $taskDrive.TotalFreeSpace
    totalSizeBytes = $taskDrive.TotalSize
    availableFreeGB = $taskDrive.AvailableFreeSpace / 1000000000
    availableFreeGiB = $taskDrive.AvailableFreeSpace / 1073741824
    minimumDecimalBytes = 20000000000
    minimumBinaryBytes = 21474836480
    decimalGatePass = $taskDrive.AvailableFreeSpace -ge 20000000000
    binaryGatePass = $taskDrive.AvailableFreeSpace -ge 21474836480
}
$taskMeasurement | ConvertTo-Json | Out-File -LiteralPath (Join-Path $taskEvidenceDirectory 'disk-measurement.json') -Encoding utf8 -NoClobber
$taskMeasurement | ConvertTo-Json
$taskStatus = & git --no-optional-locks status --short
if ($LASTEXITCODE -ne 0) { throw 'git status failed' }
$taskStatus | Out-File -LiteralPath (Join-Path $taskEvidenceDirectory 'git-status-before.txt') -Encoding utf8 -NoClobber
$taskBranch = & git branch --show-current
if ($LASTEXITCODE -ne 0) { throw 'git branch inspection failed' }
$taskBranch | Out-File -LiteralPath (Join-Path $taskEvidenceDirectory 'git-branch-before.txt') -Encoding utf8 -NoClobber
$taskHead = & git rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'git HEAD inspection failed' }
$taskHead | Out-File -LiteralPath (Join-Path $taskEvidenceDirectory 'git-head-before.txt') -Encoding utf8 -NoClobber
$taskRequestHash = Get-FileHash -LiteralPath 'C:\Users\USER\.codex\attachments\faaf064d-68fb-4208-b56a-5f26be1f6cc0\Pasted text.txt' -Algorithm SHA256
$taskRequestHash | Select-Object Algorithm,Hash,Path | ConvertTo-Json | Out-File -LiteralPath (Join-Path $taskEvidenceDirectory 'request-identity.json') -Encoding utf8 -NoClobber
if (-not $taskMeasurement.decimalGatePass) {
    'FAIL: L0 requires at least 20 GB free; STOP. Subsequent stages are NOT-RUN.'
    exit 20
}
if (-not $taskMeasurement.binaryGatePass) {
    'INCOMPLETE: clarify GB/GiB threshold before continuing.'
    exit 21
}
'PASS: disk gate only; other preflight gates have not run.'
