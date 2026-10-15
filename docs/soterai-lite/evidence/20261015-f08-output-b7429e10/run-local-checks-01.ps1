$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskPriorTemp=$env:TEMP;$taskPriorTmp=$env:TMP
function Invoke-F08Check([string]$Name,[string]$File,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot $Name) -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.result.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('F08 check failed or incomplete; retain every receipt: '+$Name)}
}
function Assert-F08RetainedPass([string]$Name){
 $taskLog=Join-Path $PSScriptRoot $Name;$taskRecord=$taskLog+'.result.json'
 if(-not(Test-Path -LiteralPath $taskLog -PathType Leaf) -or -not(Test-Path -LiteralPath $taskRecord -PathType Leaf)){throw ('Required previously completed check is not ready: '+$Name)}
 $taskRetained=Get-Content -LiteralPath $taskRecord -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskRetained.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskLog -Algorithm SHA256).Hash -ne $taskRetained.sha256){throw ('Retained check failed or its log changed: '+$Name)}
}
try{
 $env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
 if(-not(Test-Path -LiteralPath $env:TEMP -PathType Container)){throw 'Existing isolated D: temporary directory required.'}
 Invoke-F08Check 'metadata-sync-01.txt' node @('docs/soterai-lite/evidence/20261015-f08-output-b7429e10/prepare-metadata-01.cjs')
 Invoke-F08Check 'generate-readiness-01.txt' node @('packages/vscode-extension/scripts/generate-readiness.mjs')
 Assert-F08RetainedPass 'typecheck-01.txt'
 Assert-F08RetainedPass 'focused-after-02.txt'
 Invoke-F08Check 'full-tests-01.txt' node @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
 Invoke-F08Check 'package-01.txt' node @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f08-20261015-attempt01.vsix')
 Invoke-F08Check 'vsix-inspection-01.txt' powershell @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261015-f08-output-b7429e10/inspect-vsix-01.ps1')
 Invoke-F08Check 'host-build-01.txt' node @('docs/soterai-lite/evidence/20261015-f08-output-b7429e10/build-host-01.cjs')
}finally{$env:TEMP=$taskPriorTemp;$env:TMP=$taskPriorTmp}
