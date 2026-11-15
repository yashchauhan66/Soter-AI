$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskDownload=Join-Path $taskRepo '.tmp\powershell-7.6.9-install'
$taskTarget=Join-Path $env:LOCALAPPDATA 'Programs\PowerShell\7'
if(Test-Path -LiteralPath $taskTarget){throw 'Existing PowerShell installation will not be overwritten'}
if(-not(Test-Path -LiteralPath $taskDownload -PathType Container)){throw 'Verified earlier download required'}
[IO.Directory]::CreateDirectory($taskDownload)|Out-Null
$taskZip=Join-Path $taskDownload 'PowerShell-7.6.9-win-x64.zip'
$taskExpected='ce7484804c0f0ad4dda10c958e71acdaf7eebfb22505c1b480f89e0e9f1da94d'
if((Get-Item -LiteralPath $taskZip).Length -ne 109620855){throw 'Official archive size mismatch'}
if((Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskExpected){throw 'Official archive SHA256 mismatch'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchive=[IO.Compression.ZipFile]::OpenRead($taskZip)
try {
  [long]$taskTotal=0
  foreach($taskEntry in $taskArchive.Entries){
    $taskResolved=[IO.Path]::GetFullPath((Join-Path $taskTarget $taskEntry.FullName))
    if(-not $taskResolved.StartsWith($taskTarget+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Archive entry escaped installation directory'}
    $taskTotal+=$taskEntry.Length
    if($taskTotal -gt 1073741824 -or $taskArchive.Entries.Count -gt 10000){throw 'Archive expansion bound exceeded'}
  }
}finally{$taskArchive.Dispose()}
foreach($taskParent in @($env:LOCALAPPDATA,(Join-Path $env:LOCALAPPDATA 'Programs'),(Join-Path $env:LOCALAPPDATA 'Programs\PowerShell'))){
  if((Test-Path -LiteralPath $taskParent) -and ((Get-Item -LiteralPath $taskParent).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Aliased installation parent refused'}
}
[IO.Compression.ZipFile]::ExtractToDirectory($taskZip,$taskTarget)
$taskExecutable=Join-Path $taskTarget 'pwsh.exe'
$taskSignature=Get-AuthenticodeSignature -LiteralPath $taskExecutable
if($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation'){throw 'Valid Microsoft Authenticode signature required'}
$taskVersion=& $taskExecutable -NoLogo -NoProfile -NonInteractive -Command '@{version=$PSVersionTable.PSVersion.ToString();edition=$PSVersionTable.PSEdition}|ConvertTo-Json -Compress'
if($LASTEXITCODE -ne 0){throw 'Installed PowerShell version query failed'}
$taskParsed=$taskVersion | ConvertFrom-Json
if($taskParsed.version -cne '7.6.9' -or $taskParsed.edition -cne 'Core'){throw 'Installed runtime version/edition mismatch'}
$taskReceipt=@{status='OFFICIAL_POWERSHELL7_INSTALLED_SIGNATURE_VERIFIED';observedAt=[DateTime]::UtcNow.ToString('o');archiveSha256=$taskExpected;archiveBytes=109620855;executable=$taskExecutable;executableSha256=(Get-FileHash -LiteralPath $taskExecutable -Algorithm SHA256).Hash.ToLowerInvariant();signatureStatus=[string]$taskSignature.Status;signer=$taskSignature.SignerCertificate.Subject;versionOutput=$taskVersion;pathEnvironmentChanged=$false}
[IO.File]::WriteAllText((Join-Path $taskDownload 'installation.json'),($taskReceipt|ConvertTo-Json -Depth 10)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
$taskReceipt|ConvertTo-Json -Depth 10
