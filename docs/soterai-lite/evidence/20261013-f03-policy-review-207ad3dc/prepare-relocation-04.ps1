$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$basePath = 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\soterai-lite\evidence\20261013-f03-policy-review-207ad3dc'
$text = Get-Content -LiteralPath (Join-Path $basePath 'relocate-retained-profiles-03.ps1') -Raw
$text = $text.Replace('retained-profile-relocation-preflight-02.json', 'retained-profile-relocation-preflight-03.json')
$text = $text.Replace('retained-profile-relocation-02.json', 'retained-profile-relocation-03.json')
$text = $text.Replace('retained-profile-relocation-acl-before-01.json', 'retained-profile-relocation-acl-before-02.json')
$text = $text.Replace('retained-profile-relocation-acl-after-01.json', 'retained-profile-relocation-acl-after-02.json')
$oldBlock = @'
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
'@
$newBlock = @'
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
'@
if (-not $text.Contains($oldBlock)) { throw 'Exact immutable ACL adjustment block missing.' }
$text = $text.Replace($oldBlock, $newBlock)
$oldCheck = @'
    if (@($afterAcl.Access | Where-Object { $_.AccessControlType -eq [Security.AccessControl.AccessControlType]::Deny -and (([int]$_.FileSystemRights -band $deleteMask) -ne 0) }).Count -ne 0) {
'@
$newCheck = @'
    if (-not $afterAcl.AreAccessRulesProtected -or
        $afterAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $originalOwner.Value -or
        $afterAcl.GetGroup([Security.Principal.SecurityIdentifier]).Value -ne $originalGroup.Value -or
        @($afterAcl.Access | Where-Object { $_.AccessControlType -eq [Security.AccessControl.AccessControlType]::Deny -and (([int]$_.FileSystemRights -band $deleteMask) -ne 0) }).Count -ne 0) {
'@
if (-not $text.Contains($oldCheck)) { throw 'Exact immutable ACL verification block missing.' }
$text = $text.Replace($oldCheck, $newCheck)
$newPath = Join-Path $basePath 'relocate-retained-profiles-04.ps1'
$stream = [IO.FileStream]::new($newPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
$writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false))
try { $writer.Write($text); $writer.Flush() } finally { $writer.Dispose(); $stream.Dispose() }
$tokens = $null; $errors = $null
[void][Management.Automation.Language.Parser]::ParseFile($newPath, [ref]$tokens, [ref]$errors)
[pscustomobject]@{ScriptPath = $newPath; ParseErrorCount = @($errors).Count; ScriptSha256 = (Get-FileHash -LiteralPath $newPath -Algorithm SHA256).Hash.ToLowerInvariant()} | ConvertTo-Json -Depth 3
if (@($errors).Count -ne 0) { exit 1 }
