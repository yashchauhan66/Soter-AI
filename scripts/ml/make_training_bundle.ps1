param(
  [string]$Output = "soterai-train-bundle.zip"
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$OutputPath = if ([System.IO.Path]::IsPathRooted($Output)) {
  $Output
} else {
  Join-Path $RepoRoot $Output
}

$Stage = Join-Path ([System.IO.Path]::GetTempPath()) ("soterai-train-bundle-" + [System.Guid]::NewGuid().ToString("N"))
$StageResolved = $null

try {
  New-Item -ItemType Directory -Path $Stage | Out-Null
  $StageResolved = Resolve-Path $Stage
  $TempRoot = Resolve-Path ([System.IO.Path]::GetTempPath())
  if (-not $StageResolved.Path.StartsWith($TempRoot.Path, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to use unsafe staging path: $StageResolved"
  }

  foreach ($file in @("package.json", "requirements-colab.txt", "docs\SOTERAI-COLAB-TRAINING-RUNBOOK.md", "docs\SOTERAI-ML-LAKERA-BEATING-TRANSFORMATION-REPORT.md")) {
    $destination = Join-Path $Stage $file
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $RepoRoot $file) -Destination $destination
  }

  foreach ($dir in @("scripts\ml", "notebooks", "datasets", "docs\ml", "manifests\ml")) {
    $src = Join-Path $RepoRoot $dir
    $dst = Join-Path $Stage $dir
    New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $src -Destination $dst -Recurse
  }

  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  $zip = [System.IO.Compression.ZipFile]::Open($OutputPath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    $stageUri = [System.Uri]::new(($StageResolved.Path.TrimEnd("\") + "\"))
    Get-ChildItem -LiteralPath $Stage -Recurse -File |
      Where-Object { $_.FullName -notmatch "\\__pycache__\\" -and $_.Extension -ne ".pyc" } |
      ForEach-Object {
        $fileUri = [System.Uri]::new($_.FullName)
        $relative = [System.Uri]::UnescapeDataString($stageUri.MakeRelativeUri($fileUri).ToString())
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
      }
  } finally {
    $zip.Dispose()
  }

  $bundle = Get-Item -LiteralPath $OutputPath
  Write-Host "Wrote $($bundle.FullName) ($([math]::Round($bundle.Length / 1MB, 2)) MB)"
} finally {
  if ($StageResolved -and (Test-Path -LiteralPath $StageResolved.Path)) {
    Remove-Item -LiteralPath $StageResolved.Path -Recurse -Force
  }
}
