$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$basePath = 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\soterai-lite\evidence\20261013-f03-policy-review-207ad3dc'
$script:nextText = Get-Content -LiteralPath (Join-Path $basePath 'relocate-retained-profiles-02.ps1') -Raw
function Replace-Exact([string]$old, [string]$replacement) {
  if (-not $script:nextText.Contains($old)) { throw 'Expected immutable script fragment missing.' }
  $script:nextText = $script:nextText.Replace($old, $replacement)
}
Replace-Exact 'retained-profile-relocation-preflight-01.json' 'retained-profile-relocation-preflight-02.json'
Replace-Exact 'retained-profile-relocation-01.json' 'retained-profile-relocation-02.json'
Replace-Exact '$startedUtc = [DateTime]::UtcNow.ToString(''o'')' @'
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
$aclBeforePath = Join-Path $sourceRoot '20261013-f03-policy-review-207ad3dc\retained-profile-relocation-acl-before-01.json'
$aclAfterPath = Join-Path $sourceRoot '20261013-f03-policy-review-207ad3dc\retained-profile-relocation-acl-after-01.json'
$aclSnapshots = [Collections.Generic.List[object]]::new()
$aclChanges = [Collections.Generic.List[object]]::new()
$aclBeforeSha256 = $null
$aclAfterSha256 = $null
$parentAclBefore = $null
$parentAclAfter = $null
$startedUtc = [DateTime]::UtcNow.ToString('o')
'@
Replace-Exact 'foreach ($newPath in @($preflightPath, $receiptPath)) {' 'foreach ($newPath in @($preflightPath, $receiptPath, $aclBeforePath, $aclAfterPath)) {'
Replace-Exact @'
  $actualFiles = @($children | Where-Object { -not $_.PSIsContainer } | ForEach-Object { $_.FullName.Substring($root.Length + 1) } | Sort-Object)
'@ @'
  if ($root -eq $sourceRoot) {
    $expectedFiles = @($expectedFiles | Where-Object { $_ -notin $alreadyRemovedCFiles })
    $expectedDirectories = @($expectedDirectories | Where-Object { $_ -notin $alreadyRemovedCDirectories })
  }
  $actualFiles = @($children | Where-Object { -not $_.PSIsContainer } | ForEach-Object { $_.FullName.Substring($root.Length + 1) } | Sort-Object)
'@
Replace-Exact @'
    $sourceIdentity = Get-HeldIdentity $sourcePath $matchingProfiles[0] 'C_PROFILE'
    $destinationIdentity = Get-HeldIdentity $destinationPath $matchingProfiles[0] 'D_PROFILE'
    if ($sourceIdentity.bytes -ne $entry.sourceFinal.bytes -or $sourceIdentity.sha256 -ne $entry.sourceFinal.sha256 -or
        $sourceIdentity.lastWriteUtc -ne $entry.sourceFinal.lastWriteUtc -or
        $destinationIdentity.bytes -ne $entry.destinationFinal.bytes -or $destinationIdentity.sha256 -ne $entry.destinationFinal.sha256 -or
        $destinationIdentity.lastWriteUtc -ne $entry.destinationFinal.lastWriteUtc -or
        $sourceIdentity.bytes -ne $destinationIdentity.bytes -or $sourceIdentity.sha256 -ne $destinationIdentity.sha256) {
'@ @'
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
'@
Replace-Exact @'
      bytes = $sourceIdentity.bytes; sourceSha256 = $sourceIdentity.sha256; destinationSha256 = $destinationIdentity.sha256
      sourceLastWriteUtc = $sourceIdentity.lastWriteUtc; destinationLastWriteUtc = $destinationIdentity.lastWriteUtc
'@ @'
      bytes = $destinationIdentity.bytes
      sourceSha256 = if ($sourceIdentity) { $sourceIdentity.sha256 } else { $null }
      destinationSha256 = $destinationIdentity.sha256
      sourceLastWriteUtc = if ($sourceIdentity) { $sourceIdentity.lastWriteUtc } else { $null }
      destinationLastWriteUtc = $destinationIdentity.lastWriteUtc
      sourcePreviouslyRemovedByAuthorizedAttempt = $alreadyRemoved
'@
Replace-Exact @'
    sourceReparseCount = 0; destinationReparseCount = 0; namedAlternateStreamCount = 0
'@ @'
    sourceReparseCount = 0; destinationReparseCount = 0; namedAlternateStreamCount = 0
    remainingCVerifiedFileCount = 1645; remainingCVerifiedBytes = 228022511
    previouslyAuthorizedRemovedCFiles = $alreadyRemovedCFiles; previouslyAuthorizedRemovedCDirectories = $alreadyRemovedCDirectories
    priorIncompleteRemovalReceipt = Join-Path $sourceRoot '20261013-f03-policy-review-207ad3dc\retained-profile-relocation-01.json'
'@
Replace-Exact @'
  $phase = 'AUTHORIZED_SCOPED_C_REMOVAL'
'@ @'
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
    $acl.SetAccessRuleProtection($true, $true)
    $deleteDenies = @($acl.Access | Where-Object { $_.AccessControlType -eq [Security.AccessControl.AccessControlType]::Deny -and (([int]$_.FileSystemRights -band $deleteMask) -ne 0) })
    foreach ($rule in $deleteDenies) {
      $remainingRights = [int]$rule.FileSystemRights -band (-bnot $deleteMask)
      $acl.RemoveAccessRuleSpecific($rule)
      if ($remainingRights -ne 0) {
        $retainedRule = [Security.AccessControl.FileSystemAccessRule]::new($rule.IdentityReference, [Security.AccessControl.FileSystemRights]$remainingRights, $rule.InheritanceFlags, $rule.PropagationFlags, [Security.AccessControl.AccessControlType]::Deny)
        [void]$acl.AddAccessRule($retainedRule)
      }
    }
    Set-Acl -LiteralPath $snapshot.path -AclObject $acl -ErrorAction Stop
    $afterAcl = Get-Acl -LiteralPath $snapshot.path -ErrorAction Stop
    if (@($afterAcl.Access | Where-Object { $_.AccessControlType -eq [Security.AccessControl.AccessControlType]::Deny -and (([int]$_.FileSystemRights -band $deleteMask) -ne 0) }).Count -ne 0) {
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
'@
Replace-Exact @'
    foreach ($entry in $profileEntries) {
      $current = Get-Item -LiteralPath $entry.sourcePath -Force
'@ @'
    foreach ($entry in $profileEntries) {
      if ($entry.relativePath -in $alreadyRemovedCFiles) { continue }
      $current = Get-Item -LiteralPath $entry.sourcePath -Force
'@
Replace-Exact @'
  $errors.Add([ordered]@{phase = $phase; error = $_.Exception.Message; recordedUtc = [DateTime]::UtcNow.ToString('o')})
'@ @'
  $errors.Add([ordered]@{phase = $phase; error = $_.Exception.Message; fullError = $_.ToString(); targetObject = [string]$_.TargetObject; category = $_.CategoryInfo.ToString(); scriptStackTrace = $_.ScriptStackTrace; recordedUtc = [DateTime]::UtcNow.ToString('o')})
'@
Replace-Exact @'
  verifiedFileCount = $verifiedEntries.Count; verifiedBytes = [int64](($verifiedEntries | ForEach-Object { $_.bytes } | Measure-Object -Sum).Sum)
'@ @'
  verifiedFileCount = $verifiedEntries.Count; verifiedBytes = [int64](($verifiedEntries | ForEach-Object { $_.bytes } | Measure-Object -Sum).Sum)
  remainingCVerifiedFileCountBefore = 1645; remainingCVerifiedBytesBefore = 228022511
  previouslyRemovedCFileCountFromAuthorizedAttempt = 4; previouslyRemovedCFileBytesFromAuthorizedAttempt = 1389
  previouslyRemovedCFiles = $alreadyRemovedCFiles; previouslyRemovedCDirectories = $alreadyRemovedCDirectories
  aclBeforeReceiptPath = $aclBeforePath; aclBeforeReceiptSha256 = $aclBeforeSha256
  aclAfterReceiptPath = $aclAfterPath; aclAfterReceiptSha256 = $aclAfterSha256
  aclChangedDirectoryCount = $aclChanges.Count; parentAclsEdited = $false; dAclsEdited = $false
'@
$newPath = Join-Path $basePath 'relocate-retained-profiles-03.ps1'
$stream = [IO.FileStream]::new($newPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
$writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false))
try { $writer.Write($script:nextText); $writer.Flush() }
finally { $writer.Dispose(); $stream.Dispose() }
$tokens = $null; $parseErrors = $null
[void][Management.Automation.Language.Parser]::ParseFile($newPath, [ref]$tokens, [ref]$parseErrors)
[pscustomobject]@{ScriptPath = $newPath; ParseErrorCount = @($parseErrors).Count; Errors = @($parseErrors | ForEach-Object {$_.Message}); ScriptSha256 = (Get-FileHash -LiteralPath $newPath -Algorithm SHA256).Hash.ToLowerInvariant()} | ConvertTo-Json -Depth 4
if (@($parseErrors).Count -ne 0) { exit 1 }
