# F09 orchestration scaffolding; root supplies exact already-completed check logs.
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
 if(-not $taskLog.StartsWith($PSScriptRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Retained pass must belong to this F09 evidence directory.'}
 $taskRecord=$taskLog+'.result.json'
 if(-not(Test-Path -LiteralPath $taskLog -PathType Leaf) -or -not(Test-Path -LiteralPath $taskRecord -PathType Leaf)){throw 'Required completed check is absent.'}
 $taskRetained=Get-Content -LiteralPath $taskRecord -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskRetained.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskLog -Algorithm SHA256).Hash -ine $taskRetained.sha256){throw 'Retained check failed or its raw bytes changed.'}
}
function Invoke-F09Check([string]$Name,[string]$File,[string[]]$Arguments,[string]$Directory=$taskRepo){
 $taskLog=Join-Path $PSScriptRoot $Name
 if((Test-Path -LiteralPath $taskLog) -or (Test-Path -LiteralPath ($taskLog+'.result.json'))){throw 'Existing check evidence must not be overwritten.'}
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile $taskLog -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath ($taskLog+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskLog -Algorithm SHA256).Hash -ine $taskReceipt.sha256){throw ('F09 check failed or incomplete; retain every receipt: '+$Name)}
}
Assert-F09RetainedPass $RetainedTypecheck
Assert-F09RetainedPass $RetainedFocused
Assert-F09RetainedPass $RetainedFullTests
try{
 $env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
 if(-not(Test-Path -LiteralPath $env:TEMP -PathType Container)){throw 'Existing isolated D: temporary directory required.'}
 Invoke-F09Check 'metadata-sync-01.txt' node @('docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/prepare-metadata-01.cjs')
 Invoke-F09Check 'generate-readiness-01.txt' node @('packages/vscode-extension/scripts/generate-readiness.mjs')
 Invoke-F09Check 'package-01.txt' node @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f09-20261015-attempt01.vsix')
 Invoke-F09Check 'vsix-inspection-01.txt' powershell @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/inspect-vsix-01.ps1')
 Write-Output 'F09 retained checks and content inspection complete; native acceptance remains pending.'
}finally{$env:TEMP=$taskPriorTemp;$env:TMP=$taskPriorTmp}