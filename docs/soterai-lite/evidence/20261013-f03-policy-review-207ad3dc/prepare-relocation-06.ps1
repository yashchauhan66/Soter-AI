$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$basePath = 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\soterai-lite\evidence\20261013-f03-policy-review-207ad3dc'
$text = Get-Content -LiteralPath (Join-Path $basePath 'relocate-retained-profiles-05.ps1') -Raw
$text = $text.Replace('retained-profile-relocation-preflight-04.json', 'retained-profile-relocation-preflight-05.json').Replace('retained-profile-relocation-04.json', 'retained-profile-relocation-05.json').Replace('retained-profile-relocation-acl-before-03.json', 'retained-profile-relocation-acl-before-04.json').Replace('retained-profile-relocation-acl-after-03.json', 'retained-profile-relocation-acl-after-04.json')
$startMarker = '    # Build explicit ACE copies. An inherited ACE cannot be removed reliably by'
$endMarker = '    $acl = $adjustedAcl'
$startIndex = $text.IndexOf($startMarker, [StringComparison]::Ordinal)
$endIndex = $text.IndexOf($endMarker, $startIndex, [StringComparison]::Ordinal)
if ($startIndex -lt 0 -or $endIndex -lt $startIndex) { throw 'Exact immutable descriptor block unavailable.' }
$replacement = @'
    # Clone raw ACE bytes to preserve Win32 generic masks outside FileSystemRights.
    $originalRules = @($acl.Access)
    $originalOwner = $acl.GetOwner([Security.Principal.SecurityIdentifier])
    $originalGroup = $acl.GetGroup([Security.Principal.SecurityIdentifier])
    $descriptor = [Security.AccessControl.RawSecurityDescriptor]::new($acl.GetSecurityDescriptorBinaryForm(), 0)
    $clonedDacl = [Security.AccessControl.RawAcl]::new($descriptor.DiscretionaryAcl.Revision, $descriptor.DiscretionaryAcl.Count)
    foreach ($originalAce in $descriptor.DiscretionaryAcl) {
      $aceBytes = [byte[]]::new($originalAce.BinaryLength)
      $originalAce.GetBinaryForm($aceBytes, 0)
      $copiedAce = [Security.AccessControl.GenericAce]::CreateFromBinaryForm($aceBytes, 0)
      $copiedAce.AceFlags = [Security.AccessControl.AceFlags]([int]$copiedAce.AceFlags -band (-bnot [int][Security.AccessControl.AceFlags]::Inherited))
      if ($copiedAce -is [Security.AccessControl.QualifiedAce] -and $copiedAce.AceQualifier -eq [Security.AccessControl.AceQualifier]::AccessDenied) {
        $copiedAce.AccessMask = $copiedAce.AccessMask -band (-bnot $deleteMask)
        if ($copiedAce.AccessMask -eq 0) { continue }
      }
      $clonedDacl.InsertAce($clonedDacl.Count, $copiedAce)
    }
    $descriptor.DiscretionaryAcl = $clonedDacl
    $descriptor.SetFlags($descriptor.ControlFlags -bor [Security.AccessControl.ControlFlags]::DiscretionaryAclProtected)
    $descriptorBytes = [byte[]]::new($descriptor.BinaryLength)
    $descriptor.GetBinaryForm($descriptorBytes, 0)
    $adjustedAcl = [Security.AccessControl.DirectorySecurity]::new()
    $adjustedAcl.SetSecurityDescriptorBinaryForm($descriptorBytes)
    $originalAllow = @($originalRules | Where-Object {$_.AccessControlType -eq 'Allow'} | ForEach-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value + '|' + [int]$_.FileSystemRights + '|' + [int]$_.InheritanceFlags + '|' + [int]$_.PropagationFlags } | Sort-Object)
    $adjustedAllow = @($adjustedAcl.Access | Where-Object {$_.AccessControlType -eq 'Allow'} | ForEach-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value + '|' + [int]$_.FileSystemRights + '|' + [int]$_.InheritanceFlags + '|' + [int]$_.PropagationFlags } | Sort-Object)
    if (@(Compare-Object $originalAllow $adjustedAllow).Count -ne 0) { throw 'Raw Allow ACE preservation check failed.' }
    $acl = $adjustedAcl
'@
$text = $text.Substring(0, $startIndex) + $replacement + $text.Substring($endIndex + $endMarker.Length)
$newPath = Join-Path $basePath 'relocate-retained-profiles-06.ps1'
$stream = [IO.FileStream]::new($newPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
$writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false))
try { $writer.Write($text); $writer.Flush() } finally { $writer.Dispose(); $stream.Dispose() }
$tokens = $null; $errors = $null
[void][Management.Automation.Language.Parser]::ParseFile($newPath, [ref]$tokens, [ref]$errors)
[pscustomobject]@{ScriptPath = $newPath; ParseErrorCount = @($errors).Count; ScriptSha256 = (Get-FileHash -LiteralPath $newPath -Algorithm SHA256).Hash.ToLowerInvariant()} | ConvertTo-Json -Depth 3
if (@($errors).Count -ne 0) { exit 1 }
