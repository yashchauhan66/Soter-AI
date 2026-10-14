$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskRepoRoot=[IO.Path]::GetFullPath((Get-Location).Path)
$taskVsix=Join-Path $taskRepoRoot 'packages/soterai-lite/soterai-lite-0.7.0-f04-20261014-attempt01.vsix'
$taskOutput=Join-Path $PSScriptRoot 'vsix-extracted-01'
if (Test-Path -LiteralPath $taskOutput) { throw 'Extraction output already exists.' }
$taskAllowed=@('[Content_Types].xml','extension.vsixmanifest','extension/package.json','extension/readme.md','extension/changelog.md','extension/LICENSE.md',
 'extension/dist/extension.js','extension/dist/local-ai-broker.js','extension/dist/soterai-mcp-server.js',
 'extension/media/icon.svg','extension/media/logo_circle_whiter.png','extension/media/walkthrough/demo.md',
 'extension/media/walkthrough/integrate.md','extension/media/walkthrough/vault.md')
$taskZip=[IO.Compression.ZipFile]::OpenRead($taskVsix)
$taskEntries=@()
try {
    foreach($taskEntry in $taskZip.Entries) {
        $taskName=$taskEntry.FullName
        if ($taskName -notin $taskAllowed -or $taskName.Contains('..') -or $taskName.StartsWith('/') -or $taskName.Contains('\')) { throw ('Unexpected package entry: '+$taskName) }
        $taskStream=$taskEntry.Open()
        $taskBuffer=New-Object IO.MemoryStream
        try { $taskStream.CopyTo($taskBuffer); $taskBytes=$taskBuffer.ToArray() } finally { $taskStream.Dispose();$taskBuffer.Dispose() }
        $taskHash=[Security.Cryptography.SHA256]::Create()
        try { $taskDigest=[BitConverter]::ToString($taskHash.ComputeHash($taskBytes)).Replace('-','').ToLowerInvariant() } finally { $taskHash.Dispose() }
        $taskTarget=[IO.Path]::GetFullPath((Join-Path $taskOutput $taskName))
        if (-not $taskTarget.StartsWith($taskOutput+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Extraction path escaped.' }
        [void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskTarget))
        $taskWrite=[IO.File]::Open($taskTarget,[IO.FileMode]::CreateNew)
        try { $taskWrite.Write($taskBytes,0,$taskBytes.Length) } finally { $taskWrite.Dispose() }
        $taskEntries+=@{path=$taskName;bytes=$taskBytes.Length;sha256=$taskDigest}
    }
} finally { $taskZip.Dispose() }
if ($taskEntries.Count -ne $taskAllowed.Count) { throw 'Package inventory count differs.' }
$taskProvenance=Get-Content -LiteralPath 'packages/soterai-lite/dist/build-receipt.json' -Raw | ConvertFrom-Json
foreach($taskRuntime in $taskProvenance.inventory) {
    $taskEntry=@($taskEntries | Where-Object {$_.path -eq ('extension/dist/'+$taskRuntime.name)})[0]
    if ($taskEntry.sha256 -ne $taskRuntime.sha256) { throw 'Archive/runtime provenance mismatch.' }
    foreach($taskInput in $taskRuntime.inputs) {
        if ($taskInput.path -match 'apps/privacy-controller/|project-privacy/capabilities/|tier2-lite/|/__tests__/|/fixtures/|/evidence/') { throw 'Forbidden source provenance.' }
    }
}
$taskInspection=@{status='PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED';vsix=$taskVsix;bytes=(Get-Item -LiteralPath $taskVsix).Length;
 sha256=(Get-FileHash -LiteralPath $taskVsix).Hash.ToLowerInvariant();entryCount=$taskEntries.Count;entries=$taskEntries;
 extractedExtensionRoot=(Join-Path $taskOutput 'extension');runtimeCount=3;forbiddenRuntimeInputs=0;verificationEvidenceShipped=$false;
 sourceProvenance=$taskProvenance;observedAt=[DateTime]::UtcNow.ToString('o')}
$taskInspection | ConvertTo-Json -Depth 15 | Out-File -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-01.json') -Encoding utf8 -NoClobber
$taskEntries | ForEach-Object { [pscustomobject]$_ } | Format-Table path,bytes,sha256 -AutoSize
Write-Output ('VSIX SHA256: '+$taskInspection.sha256)
