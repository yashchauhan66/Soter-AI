# F09 release scaffolding. This consumes prior exact check receipts; no tests rerun.
param(
 [Parameter(Mandatory=$true)][string]$RetainedTypecheck,
 [Parameter(Mandatory=$true)][string]$RetainedFocused,
 [Parameter(Mandatory=$true)][string]$RetainedFullTests
)
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskPriorTemp=$env:TEMP;$taskPriorTmp=$env:TMP
function Assert-F09RetainedPass([string]$Name){
 $taskLog=if([IO.Path]::IsPathRooted($Name)){[IO.Path]::GetFullPath($Name)}else{[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $Name))}
 if(-not $taskLog.StartsWith($PSScriptRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Retained pass must belong to this exact F09 evidence directory.'}
 $taskRecord=$taskLog+'.result.json'
 if(-not(Test-Path -LiteralPath $taskLog -PathType Leaf) -or -not(Test-Path -LiteralPath $taskRecord -PathType Leaf)){throw 'Required completed F09 check is absent.'}
 $taskRetained=Get-Content -LiteralPath $taskRecord -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskRetained.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskLog -Algorithm SHA256).Hash -ine $taskRetained.sha256){throw 'Retained check failed or its raw bytes changed.'}
 if([IO.Path]::GetFullPath($taskRetained.output) -ine $taskLog){throw 'Retained receipt names a different raw log.'}
}
function Invoke-F09ReleaseCheck([string]$Name,[string]$File,[string[]]$Arguments){
 $taskLog=Join-Path $PSScriptRoot $Name
 if((Test-Path -LiteralPath $taskLog) -or (Test-Path -LiteralPath ($taskLog+'.result.json'))){throw 'Existing evidence must not be overwritten.'}
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile $taskLog -WorkingDirectory $taskRepo
 Assert-F09RetainedPass $Name
}
Assert-F09RetainedPass $RetainedTypecheck
Assert-F09RetainedPass $RetainedFocused
Assert-F09RetainedPass $RetainedFullTests
Assert-F09RetainedPass 'metadata-sync-02.txt'
Assert-F09RetainedPass 'generate-readiness-02.txt'
$taskMetadata=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'metadata-sync-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskMetadata.status -cne 'METADATA_SYNCED_NOT_TESTED' -or $taskMetadata.machineSettings -ne 48 -or $taskMetadata.flag -cne 'soterai.lite.vaultRuntime'){throw 'Current F09 metadata receipt is incomplete.'}
$taskCanonical=Join-Path $taskRepo 'packages/vscode-extension/package.json'
if((Get-FileHash -LiteralPath $taskCanonical -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskMetadata.canonical.sha256){throw 'Canonical metadata changed after its retained sync.'}
foreach($taskName in @('package-01.txt','vsix-inspection-01.txt','host-build-01.txt')){
 if((Test-Path -LiteralPath (Join-Path $PSScriptRoot $taskName)) -or (Test-Path -LiteralPath (Join-Path $PSScriptRoot ($taskName+'.result.json')))){throw ('A release output already exists: '+$taskName)}
}
foreach($taskRelative in @('packages/soterai-lite/soterai-lite-0.7.0-f09-20261015-attempt01.vsix',
 'docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/vsix-extracted-01',
 'docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/vsix-inspection-01.json')){
 if(Test-Path -LiteralPath (Join-Path $taskRepo $taskRelative)){throw 'An attempt01 artifact/inspection already exists; retain it and prepare a new unique attempt.'}
}
if(-not(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'build-host-01.cjs') -PathType Leaf)){throw 'Prepared host build script is unavailable.'}
try{
 $env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
 if(-not(Test-Path -LiteralPath $env:TEMP -PathType Container)){throw 'Existing isolated D: temporary directory required.'}
 Invoke-F09ReleaseCheck 'package-01.txt' node @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f09-20261015-attempt01.vsix')
 Invoke-F09ReleaseCheck 'vsix-inspection-01.txt' powershell @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/inspect-vsix-01.ps1')
 Invoke-F09ReleaseCheck 'host-build-01.txt' node @('docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/build-host-01.cjs')
 Write-Output 'F09 release preparation complete; native/affected acceptance and scoped byte verification remain pending.'
}finally{$env:TEMP=$taskPriorTemp;$env:TMP=$taskPriorTmp}