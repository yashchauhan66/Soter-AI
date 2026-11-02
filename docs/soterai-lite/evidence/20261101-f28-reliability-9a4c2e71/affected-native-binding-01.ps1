# Current F26b helper interface; no F26a/native09 execution or historical acceptance.
function Get-F26cCurrentBinding {
    $taskF26cBindingPath=Join-Path $PSScriptRoot 'native-binding-03.json'
    if((Get-FileHash -LiteralPath $taskF26cBindingPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne '6ad782a541704d8da93321093d479f5947684371802818b711802ded0587a8b3'){throw 'Exact F26b current native binding changed.'}
    $taskF26cGuard=Join-Path $PSScriptRoot 'affected-current-admission-01.cjs'
    if((Get-FileHash -LiteralPath $taskF26cGuard -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'f8375545b8477b8af52d2e6961d2e04c5e83d5e2513d991909b9e66bb94c9b28'){throw 'Exact F26b affected guard changed.'}
    $taskF26cAnswer=& 'C:\Program Files\nodejs\node.exe' $taskF26cGuard --require-component --emit-binding
    if($LASTEXITCODE -ne 0){throw 'Current native36 closure/full/artifact/source/host acceptance unavailable.'}
    return ($taskF26cAnswer | ConvertFrom-Json)
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
        $taskF26cAllowed=@($taskF26cProvenance.drivers | Where-Object { [IO.Path]::GetFileName($_.path) -cne 'lite-precommit-guard-host.js' } | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $taskF26cRepo $_.path)) })
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
    $taskF26cBinding=Get-F26cCurrentBinding
    $taskF26cInventory=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'content-inspection-02.json') -Raw -Encoding UTF8 | ConvertFrom-Json
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
    $taskF26cBinding=Get-F26cCurrentBinding
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
