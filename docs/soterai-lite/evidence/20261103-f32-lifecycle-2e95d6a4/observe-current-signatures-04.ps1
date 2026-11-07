$ErrorActionPreference = 'Stop'
# Successor of observe-current-signatures-03.ps1 for VS Code 1.145.1. Same read-only observation, fresh output name (6 Nov 2026,
# after the 4 Nov 1.145.0 observation). No host launch, no process or listener query, no network.
$out = Join-Path $PSScriptRoot 'current-signature-observation-04.json'
if (Test-Path -LiteralPath $out) { throw 'Evidence overwrite refused' }
$vendorFile = Join-Path $PSScriptRoot 'public-vendor-observation-04.json'
$vendor = Get-Content -LiteralPath $vendorFile -Raw | ConvertFrom-Json
$rows = @()
foreach ($item in @($vendor.currentHost.executable, $vendor.systemPowerShell, $vendor.node)) {
    $before = Get-FileHash -LiteralPath $item.path -Algorithm SHA256
    if ($before.Hash.ToLowerInvariant() -cne $item.sha256) { throw 'Public executable drift' }
    $signature = Get-AuthenticodeSignature -LiteralPath $item.path
    $after = Get-FileHash -LiteralPath $item.path -Algorithm SHA256
    if ($before.Hash -cne $after.Hash) { throw 'Executable changed during signature observation' }
    $rows += [pscustomobject]@{
        path = $item.path; sha256 = $after.Hash.ToLowerInvariant()
        status = [string]$signature.Status
        signerSubject = [string]$signature.SignerCertificate.Subject
        signerThumbprint = [string]$signature.SignerCertificate.Thumbprint
        timestampSubject = [string]$signature.TimeStamperCertificate.Subject
    }
}
if ($rows[0].status -cne 'Valid' -or $rows[0].signerSubject -notmatch 'Microsoft Corporation') { throw 'Current Code signer not admitted' }
if ($rows[1].status -cne 'Valid' -or $rows[2].status -cne 'Valid') { throw 'System PowerShell and Node signatures must be Valid' }
$result = [ordered]@{
    feature = 'F32'; status = 'CURRENT_PUBLIC_SIGNATURES_OBSERVED_NO_HOST_LAUNCH'
    observedAt = [DateTime]::UtcNow.ToString('o'); vendorReceiptSha256 = (Get-FileHash -LiteralPath $vendorFile -Algorithm SHA256).Hash.ToLowerInvariant()
    rows = $rows; nativeLaunches = 0; signalsRequested = 0
}
[IO.File]::WriteAllText($out, ($result | ConvertTo-Json -Depth 8) + "`n", [Text.UTF8Encoding]::new($false))
$result | ConvertTo-Json -Depth 8
