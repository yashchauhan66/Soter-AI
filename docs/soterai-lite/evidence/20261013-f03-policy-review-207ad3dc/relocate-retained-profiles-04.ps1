param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Explicit user authorization applies only to the exact twelve verified C:
# synthetic profile duplicates. D: retained bytes and all other evidence stay.
$authorization = 'Haan, verified C: duplicates remove karo'
$workspaceRoot = 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard'
$sourceRoot = Join-Path $workspaceRoot 'docs\soterai-lite\evidence'
$destinationRoot = 'D:\SoterAI-Lite-test-profiles\retained-profiles-20261014-ccadf7b398d94a87a203dd98fbb1c0ab'
$copyReceiptPath = Join-Path $sourceRoot '20261013-f03-policy-review-207ad3dc\retained-profile-copy-01.json'
$manifestPath = Join-Path $destinationRoot 'retained-profile-copy-manifest-01.json'
$preflightPath = Join-Path $sourceRoot '20261013-f03-policy-review-207ad3dc\retained-profile-relocation-preflight-03.json'
$receiptPath = Join-Path $sourceRoot '20261013-f03-policy-review-207ad3dc\retained-profile-relocation-03.json'
$expectedManifestSha256 = '4f7040a55ff9f67901c74205d4353ec73b2b05761fd705294d6308cb7e1a5f6f'
$expectedCopyReceiptSha256 = '51bebbd29c1420cc3665d2bbfcf8b09964bea7fc92c8cbd2f245694be4c863ce'
$expectedProfiles = @(
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
$firstRelativeProfile = $expectedProfiles[0]
$alreadyRemovedCFiles = @(
  $firstRelativeProfile + '\.copilot\logs\.copilot-log.lock'
  $firstRelativeProfile + '\.copilot\logs\process-1791900755963-1568.log'
  $firstRelativeProfile + '\.copilot\logs\process-1791900756524-9716.log'
  $firstRelativeProfile + '\.vscode\argv.json'
)
$alreadyRemovedCDirectories = @(
  $firstRelativeProfile + '\.copilot'
  $firstRelativeProfile + '\.copilot\logs'
  $firstRelativeProfile + '\.vscode'
)
$aclBeforePath = Join-Path $sourceRoot '20261013-f03-policy-review-207ad3dc\retained-profile-relocation-acl-before-02.json'
$aclAfterPath = Join-Path $sourceRoot '20261013-f03-policy-review-207ad3dc\retained-profile-relocation-acl-after-02.json'
$aclSnapshots = [Collections.Generic.List[object]]::new()
$aclChanges = [Collections.Generic.List[object]]::new()
$aclBeforeSha256 = $null
$aclAfterSha256 = $null
$parentAclBefore = $null
$parentAclAfter = $null
$startedUtc = [DateTime]::UtcNow.ToString('o')
$freeBefore = ([IO.DriveInfo]::new('C')).AvailableFreeSpace
$dFreeBefore = ([IO.DriveInfo]::new('D')).AvailableFreeSpace
$heldStreams = [Collections.Generic.List[object]]::new()
$verifiedEntries = [Collections.Generic.List[object]]::new()
$removedProfiles = [Collections.Generic.List[object]]::new()
$profileRows = [Collections.Generic.List[object]]::new()
$errors = [Collections.Generic.List[object]]::new()
$preflightSha256 = $null
$manifestSha256 = $null
$status = 'INCOMPLETE'
$phase = 'PREVALIDATION'

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
  $stopAt = $null
  if ($current.Equals($sourceRoot, [StringComparison]::OrdinalIgnoreCase) -or
      $current.StartsWith($sourceRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { $stopAt = $sourceRoot }
  while ($current) {
    if (Test-Path -LiteralPath $current) {
      $item = Get-Item -LiteralPath $current -Force
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse path rejected: $current" }
    }
    if ($stopAt -and $current.Equals($stopAt, [StringComparison]::OrdinalIgnoreCase)) { break }
    $parent = [IO.Directory]::GetParent($current)
    if ($null -eq $parent) { break }
    $current = $parent.FullName
  }
}
function Write-NewJson([string]$path, $value) {
  $json = $value | ConvertTo-Json -Depth 9
  $stream = [IO.FileStream]::new($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  $writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false))
  try { $writer.Write($json); $writer.WriteLine(); $writer.Flush() }
  finally { $writer.Dispose(); $stream.Dispose() }
}
function Get-HeldIdentity([string]$path, [string]$profile, [string]$role) {
  Assert-NoReparseAncestors $path
  $before = Get-Item -LiteralPath $path -Force
  if ($before.PSIsContainer) { throw "Expected file: $path" }
  $namedStreams = @(Get-Item -LiteralPath $path -Stream '*' -ErrorAction Stop | Where-Object { $_.Stream -notin @(':$DATA', '$DATA') })
  if ($namedStreams.Count -ne 0) { throw "Named alternate stream drift: $path" }
  $stream = [IO.FileStream]::new($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  $hasher = [Security.Cryptography.SHA256]::Create()
  $held = $false
  try {
    $bytes = $stream.Length
    $digest = $hasher.ComputeHash($stream)
    $after = Get-Item -LiteralPath $path -Force
    if ($before.Length -ne $bytes -or $after.Length -ne $bytes -or $before.LastWriteTimeUtc.Ticks -ne $after.LastWriteTimeUtc.Ticks) {
      throw "File changed during fresh hash: $path"
    }
    $heldStreams.Add([pscustomobject]@{path = $path; profile = $profile; role = $role; stream = $stream; closed = $false})
    $held = $true
    return [pscustomobject]@{
      bytes = [int64]$bytes
      sha256 = ([BitConverter]::ToString($digest)).Replace('-', '').ToLowerInvariant()
      lastWriteUtc = $after.LastWriteTimeUtc.ToString('o')
      attributes = $after.Attributes.ToString()
    }
  } finally { $hasher.Dispose(); if (-not $held) { $stream.Dispose() } }
}
function Assert-ProfileTree([string]$profilePath, [string]$root, [string[]]$expectedFiles, [string[]]$expectedDirectories) {
  [void](Assert-Within $profilePath $root)
  Assert-NoReparseAncestors $profilePath
  $profileItem = Get-Item -LiteralPath $profilePath -Force
  if (-not $profileItem.PSIsContainer -or $profileItem.Name -ne 'profile') { throw "Unexpected profile target: $profilePath" }
  $children = @(Get-ChildItem -LiteralPath $profilePath -Recurse -Force -ErrorAction Stop)
  if (@($children | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 }).Count -ne 0) {
    throw "Profile reparse drift: $profilePath"
  }
  if ($root -eq $sourceRoot) {
    $expectedFiles = @($expectedFiles | Where-Object { $_ -notin $alreadyRemovedCFiles })
    $expectedDirectories = @($expectedDirectories | Where-Object { $_ -notin $alreadyRemovedCDirectories })
  }
  $actualFiles = @($children | Where-Object { -not $_.PSIsContainer } | ForEach-Object { $_.FullName.Substring($root.Length + 1) } | Sort-Object)
  $actualDirectories = @($profileItem.FullName.Substring($root.Length + 1)) + @($children | Where-Object { $_.PSIsContainer } | ForEach-Object { $_.FullName.Substring($root.Length + 1) })
  if (@(Compare-Object ($expectedFiles | Sort-Object) $actualFiles).Count -ne 0 -or
      @(Compare-Object ($expectedDirectories | Sort-Object) ($actualDirectories | Sort-Object)).Count -ne 0) {
    throw "Profile file/directory membership drift: $profilePath"
  }
}

try {
  $sourceRoot = (Resolve-Path -LiteralPath $sourceRoot).Path.TrimEnd('\')
  $destinationRoot = (Resolve-Path -LiteralPath $destinationRoot).Path.TrimEnd('\')
  if ($sourceRoot -ne (Join-Path $workspaceRoot 'docs\soterai-lite\evidence') -or
      $destinationRoot -ne 'D:\SoterAI-Lite-test-profiles\retained-profiles-20261014-ccadf7b398d94a87a203dd98fbb1c0ab') {
    throw 'Resolved source/destination root identity mismatch.'
  }
  Assert-NoReparseAncestors $sourceRoot
  Assert-NoReparseAncestors $destinationRoot
  foreach ($newPath in @($preflightPath, $receiptPath, $aclBeforePath, $aclAfterPath)) {
    [void](Assert-Within $newPath $sourceRoot)
    Assert-NoReparseAncestors $newPath
    if (Test-Path -LiteralPath $newPath) { throw "New receipt target already exists: $newPath" }
  }
  $receiptIdentity = Get-HeldIdentity $copyReceiptPath '' 'COPY_RECEIPT'
  if ($receiptIdentity.sha256 -ne $expectedCopyReceiptSha256) { throw 'Copy receipt SHA-256 drift.' }
  $copyReceipt = Get-Content -LiteralPath $copyReceiptPath -Raw | ConvertFrom-Json
  $manifestIdentity = Get-HeldIdentity $manifestPath '' 'D_MANIFEST'
  $manifestSha256 = $manifestIdentity.sha256
  if ($manifestSha256 -ne $expectedManifestSha256 -or $manifestSha256 -ne $copyReceipt.manifestSha256) {
    throw 'Fresh D manifest SHA-256 does not match the pinned copy receipt.'
  }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.status -ne 'PASS' -or $copyReceipt.status -ne 'PASS' -or
      $manifest.sourceRoot -ne $sourceRoot -or $manifest.destinationRoot -ne $destinationRoot -or
      $copyReceipt.sourceRoot -ne $sourceRoot -or $copyReceipt.destinationRoot -ne $destinationRoot -or
      $copyReceipt.manifestPath -ne $manifestPath -or $manifest.profileCount -ne 12 -or
      $manifest.fileCount -ne 1649 -or $manifest.verifiedFileCount -ne 1649 -or
      $manifest.verifiedBytes -ne 228023900 -or @($manifest.errors).Count -ne 0 -or
      @($manifest.entries).Count -ne 1649 -or @($manifest.profiles).Count -ne 12) {
    throw 'Pinned manifest/receipt count, scope, or PASS contract mismatch.'
  }
  if (@(Compare-Object ($expectedProfiles | Sort-Object) @($manifest.profiles.relativePath | Sort-Object)).Count -ne 0) {
    throw 'Manifest does not contain the exact twelve approved profile paths.'
  }
  if (@($manifest.entries.relativePath | Select-Object -Unique).Count -ne 1649) { throw 'Duplicate manifest file paths.' }
  foreach ($profile in $manifest.profiles) {
    $sourcePath = Assert-Within (Join-Path $sourceRoot $profile.relativePath) $sourceRoot
    $destinationPath = Assert-Within (Join-Path $destinationRoot $profile.relativePath) $destinationRoot
    if ($sourcePath -ne $profile.sourcePath -or $destinationPath -ne $profile.destinationPath) { throw 'Profile absolute path mismatch.' }
    $prefix = $profile.relativePath + '\'
    $profileEntries = @($manifest.entries | Where-Object { $_.relativePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) })
    $profileDirectories = @($manifest.directories | Where-Object { $_.relativePath -eq $profile.relativePath -or $_.relativePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) })
    if ($profileEntries.Count -ne $profile.fileCount) { throw 'Profile file-count mismatch.' }
    Assert-ProfileTree $sourcePath $sourceRoot @($profileEntries.relativePath) @($profileDirectories.relativePath)
    Assert-ProfileTree $destinationPath $destinationRoot @($profileEntries.relativePath) @($profileDirectories.relativePath)
    $profileRows.Add([ordered]@{relativePath = $profile.relativePath; sourcePath = $sourcePath; destinationPath = $destinationPath; fileCount = $profile.fileCount; bytes = $profile.bytes})
  }
  $phase = 'FRESH_ALL_FILE_VERIFICATION'
  foreach ($entry in $manifest.entries) {
    $sourcePath = Assert-Within (Join-Path $sourceRoot $entry.relativePath) $sourceRoot
    $destinationPath = Assert-Within (Join-Path $destinationRoot $entry.relativePath) $destinationRoot
    $matchingProfiles = @($expectedProfiles | Where-Object { $entry.relativePath.StartsWith($_ + '\', [StringComparison]::OrdinalIgnoreCase) })
    if ($matchingProfiles.Count -ne 1 -or $entry.status -ne 'PASS' -or $sourcePath -ne $entry.sourcePath -or $destinationPath -ne $entry.destinationPath) {
      throw "File outside the exact approved profile scope: $sourcePath"
    }
    $sourceIdentity = $null
    $alreadyRemoved = $entry.relativePath -in $alreadyRemovedCFiles
    if ($alreadyRemoved) {
      if (Test-Path -LiteralPath $sourcePath) { throw "Previously removed C file unexpectedly reappeared: $sourcePath" }
    } else { $sourceIdentity = Get-HeldIdentity $sourcePath $matchingProfiles[0] 'C_PROFILE' }
    $destinationIdentity = Get-HeldIdentity $destinationPath $matchingProfiles[0] 'D_PROFILE'
    $sourceMismatch = $false
    if ($sourceIdentity) {
      $sourceMismatch = $sourceIdentity.bytes -ne $entry.sourceFinal.bytes -or $sourceIdentity.sha256 -ne $entry.sourceFinal.sha256 -or
        $sourceIdentity.lastWriteUtc -ne $entry.sourceFinal.lastWriteUtc -or
        $sourceIdentity.bytes -ne $destinationIdentity.bytes -or $sourceIdentity.sha256 -ne $destinationIdentity.sha256
    }
    if ($sourceMismatch -or
        $destinationIdentity.bytes -ne $entry.destinationFinal.bytes -or $destinationIdentity.sha256 -ne $entry.destinationFinal.sha256 -or
        $destinationIdentity.lastWriteUtc -ne $entry.destinationFinal.lastWriteUtc) {
      throw "Fresh C/D identity or metadata drift: $sourcePath"
    }
    $verifiedEntries.Add([ordered]@{
      relativePath = $entry.relativePath; sourcePath = $sourcePath; destinationPath = $destinationPath
      bytes = $destinationIdentity.bytes
      sourceSha256 = if ($sourceIdentity) { $sourceIdentity.sha256 } else { $null }
      destinationSha256 = $destinationIdentity.sha256
      sourceLastWriteUtc = if ($sourceIdentity) { $sourceIdentity.lastWriteUtc } else { $null }
      destinationLastWriteUtc = $destinationIdentity.lastWriteUtc
      sourcePreviouslyRemovedByAuthorizedAttempt = $alreadyRemoved
      verifiedUtc = [DateTime]::UtcNow.ToString('o')
    })
  }
  $verifiedBytes = [int64](($verifiedEntries | ForEach-Object { $_.bytes } | Measure-Object -Sum).Sum)
  if ($verifiedEntries.Count -ne 1649 -or $verifiedBytes -ne 228023900) { throw 'Fresh verified totals mismatch.' }
  foreach ($profile in $manifest.profiles) {
    $prefix = $profile.relativePath + '\'
    $profileEntries = @($manifest.entries | Where-Object { $_.relativePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) })
    $profileDirectories = @($manifest.directories | Where-Object { $_.relativePath -eq $profile.relativePath -or $_.relativePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) })
    Assert-ProfileTree $profile.sourcePath $sourceRoot @($profileEntries.relativePath) @($profileDirectories.relativePath)
    Assert-ProfileTree $profile.destinationPath $destinationRoot @($profileEntries.relativePath) @($profileDirectories.relativePath)
  }
  $preflight = [ordered]@{
    schemaVersion = 1; status = 'VERIFIED_READY_FOR_AUTHORIZED_REMOVAL'; operation = 'SCOPED_C_DUPLICATE_REMOVAL'
    startedUtc = $startedUtc; verifiedUtc = [DateTime]::UtcNow.ToString('o'); authorizationVerbatim = $authorization
    sourceRoot = $sourceRoot; destinationRoot = $destinationRoot; copyReceiptSha256 = $receiptIdentity.sha256
    manifestPath = $manifestPath; manifestSha256 = $manifestSha256
    profileCount = 12; fileCount = $verifiedEntries.Count; verifiedBytes = $verifiedBytes
    sourceReparseCount = 0; destinationReparseCount = 0; namedAlternateStreamCount = 0
    remainingCVerifiedFileCount = 1645; remainingCVerifiedBytes = 228022511
    previouslyAuthorizedRemovedCFiles = $alreadyRemovedCFiles; previouslyAuthorizedRemovedCDirectories = $alreadyRemovedCDirectories
    priorIncompleteRemovalReceipt = Join-Path $sourceRoot '20261013-f03-policy-review-207ad3dc\retained-profile-relocation-01.json'
    cFreeBytesBefore = $freeBefore; dFreeBytesBefore = $dFreeBefore
    profiles = $profileRows.ToArray(); entries = $verifiedEntries.ToArray(); independence = 'LOW'
  }
  Write-NewJson $preflightPath $preflight
  $preflightSha256 = (Get-FileHash -LiteralPath $preflightPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $phase = 'SCOPED_C_DIRECTORY_ACL_SNAPSHOT'
  $parentAclBefore = [ordered]@{workspace = (Get-Acl -LiteralPath $workspaceRoot).Sddl; evidenceRoot = (Get-Acl -LiteralPath $sourceRoot).Sddl}
  foreach ($profile in $manifest.profiles) {
    $directories = @((Get-Item -LiteralPath $profile.sourcePath -Force)) + @(Get-ChildItem -LiteralPath $profile.sourcePath -Directory -Recurse -Force)
    foreach ($directory in $directories) {
      $scopeMatches = @($profileRows | Where-Object { $directory.FullName -eq $_.sourcePath -or $directory.FullName.StartsWith($_.sourcePath + '\', [StringComparison]::OrdinalIgnoreCase) })
      if ($scopeMatches.Count -ne 1) { throw "ACL target outside exact twelve C profiles: $($directory.FullName)" }
      [void](Assert-Within $directory.FullName $sourceRoot)
      Assert-NoReparseAncestors $directory.FullName
      $acl = Get-Acl -LiteralPath $directory.FullName -ErrorAction Stop
      $aclSnapshots.Add([pscustomobject]@{path = $directory.FullName; owner = $acl.Owner; originalSddl = $acl.Sddl; originalInheritanceProtected = $acl.AreAccessRulesProtected})
    }
  }
  Write-NewJson $aclBeforePath ([ordered]@{
    schemaVersion = 1; operation = 'SCOPED_DELETE_PERMISSION_PREPARATION'; status = 'SNAPSHOT_BEFORE_ANY_ACL_EDIT'
    authorizationVerbatim = $authorization; recordedUtc = [DateTime]::UtcNow.ToString('o')
    scope = 'Only remaining directories inside the exact twelve already verified synthetic C profile duplicates.'
    plannedChange = 'Preserve copied access rules; disable inheritance only on a directory with a deletion deny; remove only Delete/DeleteSubdirectoriesAndFiles bits from deny rules.'
    parentAclsNotEdited = $true; dAclsNotEdited = $true; parentAclBefore = $parentAclBefore
    preflightPath = $preflightPath; preflightSha256 = $preflightSha256
    directories = $aclSnapshots.ToArray()
  })
  $aclBeforeSha256 = (Get-FileHash -LiteralPath $aclBeforePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $phase = 'SCOPED_C_DIRECTORY_DELETE_DENY_ADJUSTMENT'
  $deleteMask = [int][Security.AccessControl.FileSystemRights]::Delete -bor [int][Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles
  # Deepest-first freezes each current inherited descriptor before its parent changes.
  foreach ($snapshot in @($aclSnapshots | Sort-Object @{Expression = { $_.path.Length }; Descending = $true})) {
    $scopeMatches = @($profileRows | Where-Object { $snapshot.path -eq $_.sourcePath -or $snapshot.path.StartsWith($_.sourcePath + '\', [StringComparison]::OrdinalIgnoreCase) })
    if ($scopeMatches.Count -ne 1) { throw 'ACL target scope mismatch.' }
    Assert-NoReparseAncestors $snapshot.path
    $acl = Get-Acl -LiteralPath $snapshot.path -ErrorAction Stop
    if ($acl.Sddl -ne $snapshot.originalSddl) { throw "C directory ACL drift before edit: $($snapshot.path)" }
    $deleteDenies = @($acl.Access | Where-Object { $_.AccessControlType -eq [Security.AccessControl.AccessControlType]::Deny -and (([int]$_.FileSystemRights -band $deleteMask) -ne 0) })
    if ($deleteDenies.Count -eq 0) { continue }
    # Build explicit ACE copies. An inherited ACE cannot be removed reliably by
    # RemoveAccessRuleSpecific before the protected DACL has been persisted.
    $originalRules = @($acl.Access)
    $originalOwner = $acl.GetOwner([Security.Principal.SecurityIdentifier])
    $originalGroup = $acl.GetGroup([Security.Principal.SecurityIdentifier])
    $adjustedAcl = [Security.AccessControl.DirectorySecurity]::new()
    $adjustedAcl.SetOwner($originalOwner)
    $adjustedAcl.SetGroup($originalGroup)
    $adjustedAcl.SetAccessRuleProtection($true, $false)
    foreach ($rule in $originalRules) {
      $retainedRights = [int]$rule.FileSystemRights
      if ($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Deny) {
        $retainedRights = $retainedRights -band (-bnot $deleteMask)
      }
      if ($retainedRights -eq 0) { continue }
      $retainedRule = [Security.AccessControl.FileSystemAccessRule]::new($rule.IdentityReference, [Security.AccessControl.FileSystemRights]$retainedRights, $rule.InheritanceFlags, $rule.PropagationFlags, $rule.AccessControlType)
      [void]$adjustedAcl.AddAccessRule($retainedRule)
    }
    $originalAllow = @($originalRules | Where-Object {$_.AccessControlType -eq 'Allow'} | ForEach-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value + '|' + [int]$_.FileSystemRights + '|' + [int]$_.InheritanceFlags + '|' + [int]$_.PropagationFlags } | Sort-Object)
    $adjustedAllow = @($adjustedAcl.Access | Where-Object {$_.AccessControlType -eq 'Allow'} | ForEach-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value + '|' + [int]$_.FileSystemRights + '|' + [int]$_.InheritanceFlags + '|' + [int]$_.PropagationFlags } | Sort-Object)
    if (@(Compare-Object $originalAllow $adjustedAllow).Count -ne 0) { throw 'Allow ACE preservation check failed.' }
    $acl = $adjustedAcl
    Set-Acl -LiteralPath $snapshot.path -AclObject $acl -ErrorAction Stop
    $afterAcl = Get-Acl -LiteralPath $snapshot.path -ErrorAction Stop
    if (-not $afterAcl.AreAccessRulesProtected -or
        $afterAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $originalOwner.Value -or
        $afterAcl.GetGroup([Security.Principal.SecurityIdentifier]).Value -ne $originalGroup.Value -or
        @($afterAcl.Access | Where-Object { $_.AccessControlType -eq [Security.AccessControl.AccessControlType]::Deny -and (([int]$_.FileSystemRights -band $deleteMask) -ne 0) }).Count -ne 0) {
      throw "Scoped directory deletion deny remains: $($snapshot.path)"
    }
    $aclChanges.Add([ordered]@{path = $snapshot.path; originalSddl = $snapshot.originalSddl; adjustedSddl = $afterAcl.Sddl; deletionDenyRuleCount = $deleteDenies.Count; changedUtc = [DateTime]::UtcNow.ToString('o')})
  }
  Write-NewJson $aclAfterPath ([ordered]@{
    schemaVersion = 1; operation = 'SCOPED_DELETE_PERMISSION_PREPARATION'; status = 'PASS'
    originalAclReceiptPath = $aclBeforePath; originalAclReceiptSha256 = $aclBeforeSha256
    changedDirectoryCount = $aclChanges.Count; parentAclsNotEdited = $true; dAclsNotEdited = $true
    changes = $aclChanges.ToArray()
  })
  $aclAfterSha256 = (Get-FileHash -LiteralPath $aclAfterPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $phase = 'AUTHORIZED_SCOPED_C_REMOVAL'
  foreach ($profile in $manifest.profiles) {
    $prefix = $profile.relativePath + '\'
    $profileEntries = @($manifest.entries | Where-Object { $_.relativePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) })
    $profileDirectories = @($manifest.directories | Where-Object { $_.relativePath -eq $profile.relativePath -or $_.relativePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) })
    Assert-ProfileTree $profile.sourcePath $sourceRoot @($profileEntries.relativePath) @($profileDirectories.relativePath)
    foreach ($entry in $profileEntries) {
      if ($entry.relativePath -in $alreadyRemovedCFiles) { continue }
      $current = Get-Item -LiteralPath $entry.sourcePath -Force
      if ($current.Length -ne $entry.sourceFinal.bytes -or $current.LastWriteTimeUtc.ToString('o') -ne $entry.sourceFinal.lastWriteUtc) {
        throw "Last-moment source metadata drift: $($entry.sourcePath)"
      }
    }
    # Windows directory removal needs source handles closed. Release this exact
    # profile's writer-blocking read handles only immediately before removal.
    foreach ($heldStream in $heldStreams) {
      if ($heldStream.role -eq 'C_PROFILE' -and $heldStream.profile -eq $profile.relativePath -and -not $heldStream.closed) {
        $heldStream.stream.Dispose(); $heldStream.closed = $true
      }
    }
    $verifiedTarget = Assert-Within $profile.sourcePath $sourceRoot
    Assert-NoReparseAncestors $verifiedTarget
    Remove-Item -LiteralPath $verifiedTarget -Recurse -Force -ErrorAction Stop
    if (Test-Path -LiteralPath $verifiedTarget) { throw "Approved C duplicate remains after removal: $verifiedTarget" }
    $removedProfiles.Add([ordered]@{sourcePath = $verifiedTarget; destinationPath = $profile.destinationPath; fileCount = $profile.fileCount; bytes = $profile.bytes; removedUtc = [DateTime]::UtcNow.ToString('o')})
  }
  $phase = 'FINAL_RETAINED_DESTINATION_VERIFICATION'
  foreach ($profile in $manifest.profiles) {
    if (Test-Path -LiteralPath $profile.sourcePath) { throw "C duplicate remains: $($profile.sourcePath)" }
    $prefix = $profile.relativePath + '\'
    $profileEntries = @($manifest.entries | Where-Object { $_.relativePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) })
    $profileDirectories = @($manifest.directories | Where-Object { $_.relativePath -eq $profile.relativePath -or $_.relativePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) })
    Assert-ProfileTree $profile.destinationPath $destinationRoot @($profileEntries.relativePath) @($profileDirectories.relativePath)
  }
  if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedManifestSha256) {
    throw 'Retained D manifest hash changed.'
  }
  if ($removedProfiles.Count -ne 12) { throw 'Exact twelve removals were not completed.' }
  $status = 'PASS'
  $phase = 'COMPLETE'
} catch {
  $errors.Add([ordered]@{phase = $phase; error = $_.Exception.Message; fullError = $_.ToString(); targetObject = [string]$_.TargetObject; category = $_.CategoryInfo.ToString(); scriptStackTrace = $_.ScriptStackTrace; recordedUtc = [DateTime]::UtcNow.ToString('o')})
} finally {
  foreach ($heldStream in $heldStreams) {
    if (-not $heldStream.closed) { $heldStream.stream.Dispose(); $heldStream.closed = $true }
  }
}

$freeAfter = ([IO.DriveInfo]::new('C')).AvailableFreeSpace
$dFreeAfter = ([IO.DriveInfo]::new('D')).AvailableFreeSpace
$finalReceipt = [ordered]@{
  schemaVersion = 1; operation = 'SCOPED_C_DUPLICATE_REMOVAL'; status = $status; phase = $phase
  startedUtc = $startedUtc; completedUtc = [DateTime]::UtcNow.ToString('o'); authorizationVerbatim = $authorization
  authorizationScope = 'Only exact twelve previously verified isolated synthetic C profile duplicates; evidence retained on D.'
  scriptPath = $PSCommandPath; scriptSha256 = (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
  sourceRoot = $sourceRoot; destinationRoot = $destinationRoot
  copyReceiptPath = $copyReceiptPath; copyReceiptSha256 = $expectedCopyReceiptSha256
  manifestPath = $manifestPath; manifestSha256 = $manifestSha256
  preflightPath = $preflightPath; preflightSha256 = $preflightSha256
  verifiedFileCount = $verifiedEntries.Count; verifiedBytes = [int64](($verifiedEntries | ForEach-Object { $_.bytes } | Measure-Object -Sum).Sum)
  remainingCVerifiedFileCountBefore = 1645; remainingCVerifiedBytesBefore = 228022511
  previouslyRemovedCFileCountFromAuthorizedAttempt = 4; previouslyRemovedCFileBytesFromAuthorizedAttempt = 1389
  previouslyRemovedCFiles = $alreadyRemovedCFiles; previouslyRemovedCDirectories = $alreadyRemovedCDirectories
  aclBeforeReceiptPath = $aclBeforePath; aclBeforeReceiptSha256 = $aclBeforeSha256
  aclAfterReceiptPath = $aclAfterPath; aclAfterReceiptSha256 = $aclAfterSha256
  aclChangedDirectoryCount = $aclChanges.Count; parentAclsEdited = $false; dAclsEdited = $false
  removedProfileCount = $removedProfiles.Count; removedFileCount = [int64](($removedProfiles | ForEach-Object { $_.fileCount } | Measure-Object -Sum).Sum)
  removedFileBytes = [int64](($removedProfiles | ForEach-Object { $_.bytes } | Measure-Object -Sum).Sum)
  profiles = $profileRows.ToArray(); removedProfiles = $removedProfiles.ToArray()
  cFreeBytesBefore = $freeBefore; cFreeBytesAfter = $freeAfter; cFreeByteChange = $freeAfter - $freeBefore
  dFreeBytesBefore = $dFreeBefore; dFreeBytesAfter = $dFreeAfter
  dDataDeletedOrOverwritten = $false; otherCPathsDeleted = $false
  remainingCProfilePaths = @($expectedProfiles | ForEach-Object { Join-Path $sourceRoot $_ } | Where-Object { Test-Path -LiteralPath $_ })
  errors = $errors.ToArray(); independence = 'LOW'
}
Write-NewJson $receiptPath $finalReceipt
$finalReceipt | ConvertTo-Json -Depth 6
if ($status -ne 'PASS') { exit 2 }
