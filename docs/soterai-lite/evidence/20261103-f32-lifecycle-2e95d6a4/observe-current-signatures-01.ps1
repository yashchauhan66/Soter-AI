$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot 'current-signature-observation-01.json'
if (Test-Path -LiteralPath $out) { throw 'Evidence overwrite refused' }
$vendorFile = Join-Path $PSScriptRoot 'public-vendor-observation-02.json'
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
$result = [ordered]@{
    feature = 'F32'; status = 'CURRENT_PUBLIC_SIGNATURES_OBSERVED_NO_HOST_LAUNCH'
    observedAt = [DateTime]::UtcNow.ToString('o'); vendorReceiptSha256 = (Get-FileHash -LiteralPath $vendorFile -Algorithm SHA256).Hash.ToLowerInvariant()
    rows = $rows; nativeLaunches = 0; signalsRequested = 0
}
[IO.File]::WriteAllText($out, ($result | ConvertTo-Json -Depth 8) + "`n", [Text.UTF8Encoding]::new($false))
$result | ConvertTo-Json -Depth 8
