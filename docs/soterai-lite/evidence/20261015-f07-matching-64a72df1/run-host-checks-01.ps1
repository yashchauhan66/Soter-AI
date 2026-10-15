$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F07HostCheck([string]$Name,[string]$File,[string[]]$Arguments){
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot $Name) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.result.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('F07 host check failed; preserve evidence: '+$Name)}
}
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-02.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskRuntime=@($taskInspection.sourceProvenance.inventory | Where-Object {$_.name -eq 'extension.js'})[0].sha256
Invoke-F07HostCheck 'progress-write-01.txt' node @('docs/soterai-lite/evidence/20261015-f07-matching-64a72df1/write-progress-01.cjs')
Invoke-F07HostCheck 'host-prepare-01.txt' node @('docs/soterai-lite/evidence/20261015-f07-matching-64a72df1/prepare-host-checks-01.cjs')
Invoke-F07HostCheck 'native-host-launch-01.txt' powershell @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261015-f07-matching-64a72df1/run-native-01.ps1','-CodePath','C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe','-HostTestsPath','docs/soterai-lite/evidence/20261015-f07-matching-64a72df1/prebuilt-host-01/lite-secret-matching-host.js','-ExtensionRoot','docs/soterai-lite/evidence/20261015-f07-matching-64a72df1/vsix-extracted-02/extension')
Invoke-F07HostCheck 'affected-hosts-launch-01.txt' powershell @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261015-f07-matching-64a72df1/run-affected-hosts-02.ps1','-ExpectedBundleSha256',$taskRuntime,'-CodePath','C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe')
