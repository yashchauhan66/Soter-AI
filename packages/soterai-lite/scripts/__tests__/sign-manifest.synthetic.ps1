param([Parameter(Mandatory = $true)][string]$EvidenceDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security.Cryptography.Pkcs
$syntheticRoot = [IO.Path]::GetFullPath($EvidenceDirectory)
if (Test-Path -LiteralPath $syntheticRoot) { throw 'Synthetic evidence directory must be new' }
[void][IO.Directory]::CreateDirectory($syntheticRoot)
$syntheticManifest = Join-Path $syntheticRoot 'manifest.json'
$syntheticSignature = Join-Path $syntheticRoot 'signature.p7s'
[IO.File]::WriteAllText($syntheticManifest, '{"synthetic":"public-manifest-only"}')
$syntheticRsa = [Security.Cryptography.RSA]::Create(2048)
$syntheticCertificate = $null
try {
    $request = [Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=SoterAI Synthetic Test Only', $syntheticRsa,
        [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $syntheticCertificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-1), [DateTimeOffset]::UtcNow.AddDays(1))
    $env:CERT_PW = 'synthetic-signing-password-only'
    $env:CERT_B64 = [Convert]::ToBase64String($syntheticCertificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $env:CERT_PW))
    & (Join-Path $PSScriptRoot '../sign-manifest.ps1') -ManifestPath $syntheticManifest -SignaturePath $syntheticSignature
    if (!(Test-Path -LiteralPath $syntheticSignature)) { throw 'Synthetic signature not created' }
    $content = [IO.File]::ReadAllBytes($syntheticManifest)
    $cms = [Security.Cryptography.Pkcs.SignedCms]::new([Security.Cryptography.Pkcs.ContentInfo]::new($content), $true)
    $cms.Decode([IO.File]::ReadAllBytes($syntheticSignature))
    $cms.CheckSignature($true) # integrity only; synthetic certificate is not trusted
    $content[0] = $content[0] -bxor 1
    $tampered = [Security.Cryptography.Pkcs.SignedCms]::new([Security.Cryptography.Pkcs.ContentInfo]::new($content), $true)
    $tampered.Decode([IO.File]::ReadAllBytes($syntheticSignature))
    $rejected = $false
    try { $tampered.CheckSignature($true) } catch { $rejected = $true }
    if (!$rejected) { throw 'Changed manifest was not rejected' }
    $result = @{ status = 'PASS_SYNTHETIC_CMS_INTEGRITY'; tamperedManifestRejected = $true; certificateStoreModified = $false;
        organizationCertificateTested = $false; officialVsixTrustVerification = 'NOT_CLAIMED' }
    $json = $result | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $syntheticRoot 'result.json'), $json)
    Write-Output $json
} finally {
    $env:CERT_B64 = $null; $env:CERT_PW = $null
    if ($syntheticCertificate) { $syntheticCertificate.Dispose() }
    $syntheticRsa.Dispose()
}
