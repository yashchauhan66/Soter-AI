# Fresh F26c exact-artifact checks. Names preserve the accepted helper interface;
# they grant no F26a/native06 execution or historical native result transfer.
function Get-F26cCurrentBinding {
    $taskF26cRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
    $taskF26cBindingPath=Join-Path $PSScriptRoot 'native-binding-02.json'
    if((Get-FileHash -LiteralPath $taskF26cBindingPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne '9d9cf02b283fbc2211abb8e07f7ea116123ac4204aa816112c25f77d93b15078'){throw 'F26c exact native binding changed.'}
    $taskF26cGuard=Join-Path $PSScriptRoot 'current-native-guard-02.cjs'
    if((Get-FileHash -LiteralPath $taskF26cGuard -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'b1a0f59c96517c45792b926e2aa6e64992c086310c3d15c8e01e945664d586e8'){throw 'F26c exact guard changed.'}
    & 'C:\Program Files\nodejs\node.exe' $taskF26cGuard | Out-Null
    if($LASTEXITCODE -ne 0){throw 'F26c current full/artifact/source/host checks unavailable.'}
    return (Get-Content -LiteralPath $taskF26cBindingPath -Raw -Encoding UTF8 | ConvertFrom-Json)
}
function Assert-F26AAffectedInputs {
    $taskF26cBinding=Get-F26cCurrentBinding
    $taskF26cRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
    $taskF26cVsix=[IO.Path]::GetFullPath((Join-Path $taskF26cRepo $taskF26cBinding.vsix.path))
    if([IO.Path]::GetFullPath($VsixPath) -ine $taskF26cVsix -or $ExpectedVsixSha256.ToLowerInvariant() -cne $taskF26cBinding.vsix.sha256 -or $ExpectedBundleSha256.ToLowerInvariant() -cne $taskF26cBinding.frontendSha256){throw 'F26c exact artifact parameters required.'}
    $taskF26cExtension=Join-Path $taskF26cRepo $taskF26cBinding.extractedRoot
    if($ExtensionRoot -and [IO.Path]::GetFullPath($ExtensionRoot) -ine [IO.Path]::GetFullPath($taskF26cExtension)){throw 'F26c exact extracted extension required.'}
    if($HostTestsPath){
        $taskF26cProvenance=Get-Content -LiteralPath (Join-Path $taskF26cRepo $taskF26cBinding.driverProvenance.path) -Raw -Encoding UTF8 | ConvertFrom-Json
        $taskF26cAllowed=@($taskF26cProvenance.drivers | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $PSScriptRoot $_.path)) })
        $taskF26cAllowed+=@('affected-preparation-functional10-driver-01.js','affected-preparation-security17-driver-01.js') | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $PSScriptRoot $_)) }
        if($taskF26cAllowed -inotcontains [IO.Path]::GetFullPath($HostTestsPath)){throw 'F26c sealed affected driver required; precommit native06 excluded.'}
    }
}
function Assert-F26AEditorHost {
    $taskF26cBinding=Get-F26cCurrentBinding
    $taskF26cRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
    $taskF26cReview=Get-Content -LiteralPath (Join-Path $taskF26cRepo $taskF26cBinding.hostReview.path) -Raw -Encoding UTF8 | ConvertFrom-Json
    if($CodePath -and [IO.Path]::GetFullPath($CodePath) -ine [IO.Path]::GetFullPath($taskF26cReview.currentHost.executable.path)){throw 'F26c exact reviewed Code executable required.'}
}
function Assert-F15bRuntimeBinding {
    param([string]$VsixPath,[string]$ExpectedVsixSha256,[string]$ExtensionRoot,[string]$ExpectedBundleSha256)
    Assert-F26AAffectedInputs
    $taskF26cBinding=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-binding-02.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $taskF26cInventory=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'offline-inventory-02/release-inventory.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach($taskF26cEntry in $taskF26cInventory.entries){
        if(-not $taskF26cEntry.path.StartsWith('extension/',[StringComparison]::Ordinal)){continue}
        $taskF26cFile=Join-Path $ExtensionRoot ($taskF26cEntry.path.Substring(10).Replace('/',[IO.Path]::DirectorySeparatorChar))
        $taskF26cItem=Get-Item -LiteralPath $taskF26cFile -Force
        if($taskF26cItem.PSIsContainer -or ($taskF26cItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $taskF26cItem.Length -ne $taskF26cEntry.bytes -or (Get-FileHash -LiteralPath $taskF26cFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskF26cEntry.sha256){throw 'F26c extracted exact archive entry mismatch.'}
    }
}
function Get-F26ARuntimeBindings {
    param([string]$ExecutionRoot)
    Assert-F26AAffectedInputs
    $taskF26cBinding=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-binding-02.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $taskF26cRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
    $taskF26cExecution=[IO.Path]::GetFullPath($ExecutionRoot)
    if(-not $taskF26cExecution.StartsWith('D:\SoterAI-Lite-test-profiles\',[StringComparison]::OrdinalIgnoreCase)){throw 'F26c isolated execution root required.'}
    foreach($taskF26cRuntime in $taskF26cBinding.runtimes){
        $taskF26cName=[IO.Path]::GetFileName($taskF26cRuntime.path)
        $taskF26cTarget=Join-Path $taskF26cExecution ('dist/'+$taskF26cName)
        $taskF26cItem=Get-Item -LiteralPath $taskF26cTarget -Force
        if($taskF26cItem.PSIsContainer -or ($taskF26cItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $taskF26cItem.Length -ne $taskF26cRuntime.bytes -or (Get-FileHash -LiteralPath $taskF26cTarget -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskF26cRuntime.sha256){throw 'F26c copied exact runtime mismatch.'}
        @{name=$taskF26cName;bytes=$taskF26cRuntime.bytes;sha256=$taskF26cRuntime.sha256;source=(Join-Path $taskF26cRepo $taskF26cRuntime.path);execution=$taskF26cTarget}
    }
}
