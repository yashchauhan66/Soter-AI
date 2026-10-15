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
 $taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
 $taskRuntime=@($taskInspection.sourceProvenance.inventory|Where-Object{$_.name -eq 'extension.js'})[0].sha256
 if($taskRuntime -notmatch '^[a-f0-9]{64}$'){throw 'Exact inspected runtime identity required.'}
 $taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
 $taskSource=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'
 if((Get-FileHash -LiteralPath (Join-Path $taskSource 'dist/extension.js')).Hash.ToLowerInvariant() -ne $taskRuntime){throw 'Inspected runtime differs before host launch.'}
 $taskBefore=@(Get-ChildItem -LiteralPath $PSScriptRoot -Directory -Filter 'f08-native-host-*'|ForEach-Object{$_.FullName})
 Invoke-F08Check 'native-host-launch-01.txt' powershell @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261015-f08-output-b7429e10/run-native-01.ps1','-CodePath',$taskCode,'-HostTestsPath','docs/soterai-lite/evidence/20261015-f08-output-b7429e10/prebuilt-host-02/lite-streaming-output-host.js','-ExtensionRoot',$taskSource)
 $taskNew=@(Get-ChildItem -LiteralPath $PSScriptRoot -Directory -Filter 'f08-native-host-*'|Where-Object{$_.FullName -notin $taskBefore})
 if($taskNew.Count -ne 1){throw 'Exactly one new native result directory required.'}
 $taskNative=Get-Content -LiteralPath (Join-Path $taskNew[0].FullName 'matching-results.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskNative.extensionBundleSha256 -ne $taskRuntime -or $taskNative.passed -ne 13 -or $taskNative.failed -ne 0 -or $taskNative.notRun -ne 0 -or $taskNative.driverFailure -or @($taskNative.observations).Count -ne 13 -or @($taskNative.observations|Where-Object{$_.status -ne 'PASS'}).Count -ne 0){throw 'Native13 acceptance incomplete; retain exact result.'}
 Invoke-F08Check 'affected-hosts-launch-01.txt' powershell @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261015-f08-output-b7429e10/run-affected-hosts-01.ps1','-ExpectedBundleSha256',$taskRuntime,'-CodePath',$taskCode)
}finally{$env:TEMP=$taskPriorTemp;$env:TMP=$taskPriorTmp}
