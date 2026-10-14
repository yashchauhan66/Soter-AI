param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# COPY ONLY: retained isolated synthetic profiles. No deletion, overwrite, process,
# operating-system, product, or real-user-profile changes are performed.
$workspaceRoot = 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard'
$sourceRoot = Join-Path $workspaceRoot 'docs\soterai-lite\evidence'
$destinationParent = 'D:\SoterAI-Lite-test-profiles'
$destinationRoot = Join-Path $destinationParent 'retained-profiles-20261014-ccadf7b398d94a87a203dd98fbb1c0ab'
$receiptPath = Join-Path $sourceRoot '20261013-f03-policy-review-207ad3dc\retained-profile-copy-01.json'
$manifestPath = Join-Path $destinationRoot 'retained-profile-copy-manifest-01.json'
$startedUtc = [DateTime]::UtcNow.ToString('o')
$profilePaths = @(
  '20261013-f01-restrictions-914f6b6e\functional\privacy-20261013T141221Z-e2b0d1c7\profile',
  '20261013-f01-restrictions-914f6b6e\host-20261013T134751Z-679e8e81\profile',
  '20261013-f01-restrictions-914f6b6e\host-20261013T135828Z-a838967e\profile',
  '20261013-f01-restrictions-914f6b6e\native-host-20261013T140805Z-90f83793\profile',
  '20261013-f02-policy-6fb804da\f01-native-host-20261013T151746Z-2ee8ca6e\profile',
  '20261013-f02-policy-6fb804da\f01-native-host-20261013T152541Z-efc19501\profile',
  '20261013-f02-policy-6fb804da\functional\privacy-20261013T151850Z-8fb9cd5d\profile',
  '20261013-f02-policy-6fb804da\functional\privacy-20261013T152645Z-9d28b131\profile',
  '20261013-f02-policy-6fb804da\native-host-20261013T151000Z-3546e36c\profile',
  '20261013-f02-policy-6fb804da\native-host-20261013T151607Z-0230f57d\profile',
  '20261013-f02-policy-6fb804da\native-host-20261013T152524Z-db43815d\profile',
  '20261013-l0-resume-88fb9432\p03-functional\privacy-20261013T072914Z-0d426ab9\profile'
)

function Assert-Within([string]$candidate, [string]$root) {
  $full = [IO.Path]::GetFullPath($candidate).TrimEnd('\')
  $fullRoot = [IO.Path]::GetFullPath($root).TrimEnd('\')
  if (-not $full.StartsWith($fullRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw "Path outside explicit root: $full"
  }
  return $full
}
function Assert-NoReparseAncestors([string]$candidate) {
  $current = [IO.Path]::GetFullPath($candidate)
  # The authorized source root is the boundary: Desktop's upstream OneDrive
  # cloud reparse tag does not make any profile/root descendant a link.
  $stopAt = $null
  if ($current.Equals($sourceRoot, [StringComparison]::OrdinalIgnoreCase) -or
      $current.StartsWith($sourceRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    $stopAt = $sourceRoot
  }
  while ($current) {
    if (Test-Path -LiteralPath $current) {
      $item = Get-Item -LiteralPath $current -Force
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Reparse path rejected: $current"
      }
    }
    if ($stopAt -and $current.Equals($stopAt, [StringComparison]::OrdinalIgnoreCase)) { break }
    $parent = [IO.Directory]::GetParent($current)
    if ($null -eq $parent) { break }
    $current = $parent.FullName
  }
}
function Write-NewJson([string]$path, $value) {
  $json = $value | ConvertTo-Json -Depth 12
  $stream = [IO.FileStream]::new($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  $writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false))
  try { $writer.Write($json); $writer.WriteLine(); $writer.Flush() }
  finally { $writer.Dispose(); $stream.Dispose() }
}
function Read-ByteIdentity([string]$path) {
  $fileBefore = Get-Item -LiteralPath $path -Force
  if (($fileBefore.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Reparse file rejected: $path"
  }
  $namedStreams = @(Get-Item -LiteralPath $path -Stream '*' -ErrorAction Stop | Where-Object { $_.Stream -notin @(':$DATA', '$DATA') })
  if ($namedStreams.Count -ne 0) { throw "Named alternate data stream requires separate retention verification: $path" }
  # FileShare.Read rejects active writers while hashing, including SQLite/log files.
  $stream = [IO.FileStream]::new($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { $bytes = $stream.Length; $digest = $hasher.ComputeHash($stream) }
  finally { $hasher.Dispose(); $stream.Dispose() }
  $fileAfter = Get-Item -LiteralPath $path -Force
  if ($bytes -ne $fileBefore.Length -or $bytes -ne $fileAfter.Length -or
      $fileBefore.LastWriteTimeUtc.Ticks -ne $fileAfter.LastWriteTimeUtc.Ticks) {
    throw "File changed during hash: $path"
  }
  return [ordered]@{
    bytes = [int64]$bytes
    sha256 = ([BitConverter]::ToString($digest)).Replace('-', '').ToLowerInvariant()
    lastWriteUtc = $fileAfter.LastWriteTimeUtc.ToString('o')
    creationUtc = $fileAfter.CreationTimeUtc.ToString('o')
    attributes = $fileAfter.Attributes.ToString()
  }
}

# All containment and collision checks precede any destination mutation.
$sourceRoot = (Resolve-Path -LiteralPath $sourceRoot).Path.TrimEnd('\')
$destinationParent = (Resolve-Path -LiteralPath $destinationParent).Path.TrimEnd('\')
$destinationRoot = Assert-Within $destinationRoot $destinationParent
$receiptPath = Assert-Within $receiptPath $sourceRoot
$manifestPath = Assert-Within $manifestPath $destinationRoot
Assert-NoReparseAncestors $sourceRoot
Assert-NoReparseAncestors $destinationRoot
Assert-NoReparseAncestors $receiptPath
if (Test-Path -LiteralPath $destinationRoot) { throw 'Unique destination root already exists; no overwrite allowed.' }
if (Test-Path -LiteralPath $receiptPath) { throw 'Receipt already exists; no overwrite allowed.' }

$inventories = @()
$initialReparseCount = 0
foreach ($relativeProfile in $profilePaths) {
  $sourceProfile = Assert-Within (Join-Path $sourceRoot $relativeProfile) $sourceRoot
  $destinationProfile = Assert-Within (Join-Path $destinationRoot $relativeProfile) $destinationRoot
  Assert-NoReparseAncestors $sourceProfile
  $profileItem = Get-Item -LiteralPath $sourceProfile -Force
  if (-not $profileItem.PSIsContainer -or $profileItem.Name -notin @('profile', 'profiles')) {
    throw "Unexpected synthetic-profile target: $sourceProfile"
  }
  $children = @(Get-ChildItem -LiteralPath $sourceProfile -Recurse -Force -ErrorAction Stop)
  $reparseItems = @($children | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
  $initialReparseCount += $reparseItems.Count
  if ($reparseItems.Count -ne 0) { throw "Reparse descendant rejected: $sourceProfile" }
  $files = @($children | Where-Object { -not $_.PSIsContainer } | Sort-Object FullName)
  $directories = @($children | Where-Object { $_.PSIsContainer } | Sort-Object FullName)
  $inventories += [pscustomobject]@{
    relativePath = $relativeProfile; sourcePath = $sourceProfile; destinationPath = $destinationProfile
    files = $files; directories = $directories
    fileCount = $files.Count; bytes = [int64](($files | Measure-Object Length -Sum).Sum)
  }
}

$entries = [Collections.Generic.List[object]]::new()
$errors = [Collections.Generic.List[object]]::new()
$directoryEntries = [Collections.Generic.List[object]]::new()
[void][IO.Directory]::CreateDirectory($destinationRoot)
foreach ($inventory in $inventories) {
  [void][IO.Directory]::CreateDirectory($inventory.destinationPath)
  $allDirectories = @((Get-Item -LiteralPath $inventory.sourcePath -Force)) + @($inventory.directories)
  foreach ($directory in $allDirectories) {
    $relativeDirectory = $directory.FullName.Substring($sourceRoot.Length + 1)
    $destinationDirectory = Assert-Within (Join-Path $destinationRoot $relativeDirectory) $destinationRoot
    Assert-NoReparseAncestors $destinationDirectory
    [void][IO.Directory]::CreateDirectory($destinationDirectory)
    $directoryEntries.Add([ordered]@{relativePath = $relativeDirectory; sourcePath = $directory.FullName; destinationPath = $destinationDirectory})
  }
  foreach ($file in $inventory.files) {
    $relativeFile = $file.FullName.Substring($sourceRoot.Length + 1)
    $destinationFile = Assert-Within (Join-Path $destinationRoot $relativeFile) $destinationRoot
    $entry = [ordered]@{relativePath = $relativeFile; sourcePath = $file.FullName; destinationPath = $destinationFile; status = 'INCOMPLETE'; sourceBefore = $null; sourceAfter = $null; destinationAfter = $null; sourceFinal = $null; destinationFinal = $null; error = $null}
    try {
      [void](Assert-Within $file.FullName $inventory.sourcePath)
      Assert-NoReparseAncestors $file.FullName
      Assert-NoReparseAncestors $destinationFile
      if (Test-Path -LiteralPath $destinationFile) { throw 'Destination file exists; no overwrite allowed.' }
      $entry.sourceBefore = Read-ByteIdentity $file.FullName
      [IO.File]::Copy($file.FullName, $destinationFile, $false)
      $entry.destinationAfter = Read-ByteIdentity $destinationFile
      $entry.sourceAfter = Read-ByteIdentity $file.FullName
      if ($entry.sourceBefore.bytes -ne $entry.sourceAfter.bytes -or
          $entry.sourceBefore.sha256 -ne $entry.sourceAfter.sha256 -or
          $entry.sourceBefore.lastWriteUtc -ne $entry.sourceAfter.lastWriteUtc -or
          $entry.sourceBefore.bytes -ne $entry.destinationAfter.bytes -or
          $entry.sourceBefore.sha256 -ne $entry.destinationAfter.sha256) {
        throw 'Source changed or destination byte verification mismatch.'
      }
      $entry.status = 'PASS'
    } catch {
      $entry.error = $_.Exception.Message
      $errors.Add([ordered]@{path = $file.FullName; error = $_.Exception.Message})
    }
    $entries.Add($entry)
  }
  try {
    $afterItems = @(Get-ChildItem -LiteralPath $inventory.sourcePath -Recurse -Force -ErrorAction Stop)
    $afterReparse = @($afterItems | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
    $afterFiles = @($afterItems | Where-Object { -not $_.PSIsContainer } | Sort-Object FullName)
    $beforeNames = @($inventory.files | ForEach-Object { $_.FullName })
    $afterNames = @($afterFiles | ForEach-Object { $_.FullName })
    if ($afterReparse.Count -ne 0 -or @(Compare-Object $beforeNames $afterNames).Count -ne 0) {
      throw 'Source profile membership/reparse state changed during copy.'
    }
  } catch { $errors.Add([ordered]@{path = $inventory.sourcePath; error = $_.Exception.Message}) }
}

# Recheck every copied object after the whole copy, detecting later source drift.
foreach ($entry in $entries) {
  if ($entry.status -ne 'PASS') { continue }
  try {
    $entry.sourceFinal = Read-ByteIdentity $entry.sourcePath
    $entry.destinationFinal = Read-ByteIdentity $entry.destinationPath
    if ($entry.sourceBefore.bytes -ne $entry.sourceFinal.bytes -or
        $entry.sourceBefore.sha256 -ne $entry.sourceFinal.sha256 -or
        $entry.sourceBefore.lastWriteUtc -ne $entry.sourceFinal.lastWriteUtc -or
        $entry.sourceBefore.bytes -ne $entry.destinationFinal.bytes -or
        $entry.sourceBefore.sha256 -ne $entry.destinationFinal.sha256) {
      throw 'Final source/destination byte verification mismatch or later source drift.'
    }
  } catch {
    $entry.status = 'INCOMPLETE'; $entry.error = $_.Exception.Message
    $errors.Add([ordered]@{path = $entry.sourcePath; error = $_.Exception.Message})
  }
}

$destinationChildren = @(Get-ChildItem -LiteralPath $destinationRoot -Recurse -Force -ErrorAction Stop)
$destinationReparseCount = @($destinationChildren | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 }).Count
$destinationFiles = @($destinationChildren | Where-Object { -not $_.PSIsContainer })
$expectedFiles = @($entries | Where-Object { $_.status -eq 'PASS' })
if ($destinationReparseCount -ne 0 -or $destinationFiles.Count -ne $entries.Count) {
  $errors.Add([ordered]@{path = $destinationRoot; error = 'Destination reparse/count mismatch.'})
}
$fileCount = @($inventories | ForEach-Object { $_.files }).Count
$bytesBefore = [int64](($inventories | Measure-Object bytes -Sum).Sum)
$verifiedBytes = [int64](($expectedFiles | ForEach-Object { $_.destinationAfter.bytes } | Measure-Object -Sum).Sum)
$status = if ($errors.Count -eq 0 -and $expectedFiles.Count -eq $fileCount -and $verifiedBytes -eq $bytesBefore) { 'PASS' } else { 'INCOMPLETE' }
$manifest = [ordered]@{
  schemaVersion = 1; operation = 'COPY_ONLY'; status = $status
  startedUtc = $startedUtc; completedUtc = [DateTime]::UtcNow.ToString('o')
  sourceRoot = $sourceRoot; destinationRoot = $destinationRoot
  sourceOriginalsRetained = $true; sourceDeletionPerformed = $false; overwritePerformed = $false
  scope = 'Exact twelve isolated synthetic test profiles; no real user profile.'
  initialSourceReparseCount = $initialReparseCount; destinationReparseCount = $destinationReparseCount
  profileCount = $inventories.Count; fileCount = $fileCount; sourceBytesBefore = $bytesBefore
  verifiedFileCount = $expectedFiles.Count; verifiedBytes = $verifiedBytes; directoryCount = $directoryEntries.Count
  profiles = @($inventories | Select-Object relativePath, sourcePath, destinationPath, fileCount, bytes)
  directories = $directoryEntries.ToArray(); entries = $entries.ToArray(); errors = $errors.ToArray()
}
Write-NewJson $manifestPath $manifest
$manifestIdentity = Read-ByteIdentity $manifestPath
$receipt = [ordered]@{
  schemaVersion = 1; operation = 'COPY_ONLY'; status = $status
  startedUtc = $startedUtc; completedUtc = [DateTime]::UtcNow.ToString('o')
  scriptPath = $PSCommandPath; scriptSha256 = (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
  sourceRoot = $sourceRoot; destinationRoot = $destinationRoot
  manifestPath = $manifestPath; manifestBytes = $manifestIdentity.bytes; manifestSha256 = $manifestIdentity.sha256
  profileCount = $inventories.Count; fileCount = $fileCount; sourceBytesBefore = $bytesBefore
  verifiedFileCount = $expectedFiles.Count; verifiedBytes = $verifiedBytes
  sourceOriginalsRetained = $true; sourceDeletionPerformed = $false; overwritePerformed = $false
  sourceReparseCount = $initialReparseCount; destinationReparseCount = $destinationReparseCount
  errorCount = $errors.Count; independence = 'LOW'; approvalState = 'Copy preparation only; original removal not authorized.'
}
Write-NewJson $receiptPath $receipt
$receipt | ConvertTo-Json -Depth 5
if ($status -ne 'PASS') { exit 2 }
