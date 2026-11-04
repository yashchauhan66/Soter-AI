$ErrorActionPreference='Stop'
$taskBindingPath='D:\SoterAI-Lite-test-profiles\f32-installed-20261104T015437Z-9bc207a9\profile-primary\F32Gate\primary\primary-before-cli-absence-binding.json'
$taskBinding=[IO.File]::ReadAllText($taskBindingPath)|ConvertFrom-Json
$taskRows=[Collections.Generic.List[object]]::new()
foreach($taskTarget in @($taskBindingPath,$taskBinding.vendorReceipt.path)){
    $taskCursor=$taskTarget
    while($true){
        $taskItem=Get-Item -LiteralPath $taskCursor -Force -ErrorAction Stop
        $taskRows.Add([pscustomobject]@{path=$taskCursor;attributes=[string]$taskItem.Attributes;attributesNumeric=[long]$taskItem.Attributes;linkType=$taskItem.LinkType;target=@($taskItem.Target)})
        $taskParent=[IO.Path]::GetDirectoryName($taskCursor)
        if([string]::IsNullOrEmpty($taskParent)-or $taskParent -ceq $taskCursor){break}
        $taskCursor=$taskParent
    }
}
. (Join-Path $PSScriptRoot 'installed-owner-custody-proposed-04.ps1')
$script:taskForbiddenLiveCalls=0
function Get-CimInstance {$script:taskForbiddenLiveCalls++;throw 'No live queries in metadata diagnosis.'}
function Get-NetTCPConnection {$script:taskForbiddenLiveCalls++;throw 'No live queries in metadata diagnosis.'}
$taskActualError=$null
try{[void](Get-F32ReadOnlyFact -LiteralPath $taskBinding.vendorReceipt.path)}catch{$taskActualError=$_.Exception.Message}
if($taskActualError -cne 'F32 linked file or parent withheld.'){throw 'Expected current strict metadata refusal was not reproduced.'}
$taskVendorFile=Get-Item -LiteralPath $taskBinding.vendorReceipt.path
$taskVendorHash=(Get-FileHash -LiteralPath $taskBinding.vendorReceipt.path -Algorithm SHA256).Hash.ToLowerInvariant()
if($taskVendorHash -cne $taskBinding.vendorReceipt.sha256 -or $taskVendorFile.Length -ne $taskBinding.vendorReceipt.bytes){throw 'Original vendor receipt changed.'}
$taskValue=[ordered]@{
    schemaVersion=1;feature='F32';status='INITIAL_ABSENCE_VENDOR_RECEIPT_ONEDRIVE_ANCESTRY_REFUSAL_REPRODUCED'
    observedAt=[DateTime]::UtcNow.ToString('o');bindingPath=$taskBindingPath;vendorReceipt=$taskBinding.vendorReceipt
    originalVendorReceiptBytesVerified=$true;observations=$taskRows.ToArray();actualReadOnlyFactError=$taskActualError
    firstRejectedAncestor='C:\Users\USER\OneDrive\Desktop';liveCalls=$script:taskForbiddenLiveCalls;codeLaunches=0;cliInvocations=0;signalsRequested=0
    resolution='Retain strict custody04. Runner may copy exact admitted raw vendor-receipt bytes into fresh D assets and bind that fact; retain original receipt/source/vendor checks. No reparse exception, OneDrive setting or OS change.'
    scope='Targeted known binding/vendorReceipt ancestry attributes and actual strict reader only. No public-program/process/listener query, host, network or new native round.'
}
$taskOutput=Join-Path $PSScriptRoot 'vendor-reparse-diagnosis-01.json'
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskValue|ConvertTo-Json -Depth 12)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
Write-Output 'PASS: exact strict vendorReceipt ancestor refusal reproduced; no live queries or process launch.'
Get-FileHash -LiteralPath $taskOutput -Algorithm SHA256
