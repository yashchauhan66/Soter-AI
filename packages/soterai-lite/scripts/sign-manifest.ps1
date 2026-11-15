param(
    [Parameter(Mandatory = $true)][string]$ManifestPath,
    [Parameter(Mandatory = $true)][string]$SignaturePath
)
$ErrorActionPreference = 'Stop'
$signingCertificate = $null
$signingBytes = $null
$signatureStream = $null
try {
    Add-Type -AssemblyName System.Security.Cryptography.Pkcs
    $signingRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..')).TrimEnd('\', '/')
    $manifestFile = [IO.Path]::GetFullPath($ManifestPath)
    $signatureFile = [IO.Path]::GetFullPath($SignaturePath)
    foreach ($signingPath in @($manifestFile, $signatureFile)) {
        if (!$signingPath.StartsWith($signingRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Signing path outside repository' }
        for ($signingParent = [IO.Path]::GetDirectoryName($signingPath); $signingParent -ne $signingRoot; $signingParent = [IO.Path]::GetDirectoryName($signingParent)) {
            if ((Get-Item -LiteralPath $signingParent).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Signing parent is a link' }
        }
    }
    $manifestInfo = Get-Item -LiteralPath $manifestFile
    if ($manifestInfo.PSIsContainer -or ($manifestInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $manifestInfo.Length -gt 16MB) { throw 'Invalid signing manifest' }
    if (!$env:CERT_B64 -or !$env:CERT_PW -or $env:CERT_B64.Length -gt 4MB) { throw 'Signing credentials unavailable' }
    # Import the supplied certificate in memory. No PFX/private key file, cert
    # store installation, command-line password or secret-bearing output.
    $signingBytes = [Convert]::FromBase64String($env:CERT_B64)
    $signingCertificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new(
        $signingBytes, $env:CERT_PW, [Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet)
    if (!$signingCertificate.HasPrivateKey) { throw 'Private signing key unavailable' }
    $manifestBytes = [IO.File]::ReadAllBytes($manifestFile)
    $signedCms = [Security.Cryptography.Pkcs.SignedCms]::new([Security.Cryptography.Pkcs.ContentInfo]::new($manifestBytes), $true)
    $cmsSigner = [Security.Cryptography.Pkcs.CmsSigner]::new($signingCertificate)
    $cmsSigner.DigestAlgorithm = [Security.Cryptography.Oid]::new('2.16.840.1.101.3.4.2.1') # SHA-256
    $cmsSigner.IncludeOption = [Security.Cryptography.X509Certificates.X509IncludeOption]::ExcludeRoot
    $signedCms.ComputeSignature($cmsSigner, $true)
    $signatureBytes = $signedCms.Encode()
    $signatureStream = [IO.File]::Open($signatureFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $signatureStream.Write($signatureBytes, 0, $signatureBytes.Length)
    $signatureStream.Flush($true)
    Write-Output 'Detached signature created. Official VSIX signature verification is still required.'
} catch {
    Write-Error 'Detached manifest signing failed. No signature verification or release claim is issued.' -ErrorAction Continue
    exit 1
} finally {
    if ($signatureStream) { $signatureStream.Dispose() }
    if ($signingCertificate) { $signingCertificate.Dispose() }
    if ($signingBytes) { [Array]::Clear($signingBytes, 0, $signingBytes.Length) }
}
