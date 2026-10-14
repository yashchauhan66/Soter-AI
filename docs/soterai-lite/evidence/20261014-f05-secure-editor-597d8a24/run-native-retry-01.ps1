$ErrorActionPreference='Stop'
$taskRunner=Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F05NativeStep([string]$Name,[string]$File,[string[]]$Arguments){
 $taskOutput=Join-Path $PSScriptRoot $Name
 if(Test-Path -LiteralPath $taskOutput){throw 'Existing evidence refused.'}
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile $taskOutput
 $taskResult=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('Native retry step failed: '+$Name)}
}
Invoke-F05NativeStep 'typecheck-07.txt' 'node' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F05NativeStep 'host-build-02.txt' 'node' @('docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/build-host-02.cjs')
Invoke-F05NativeStep 'native-host-launch-02.txt' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/run-native-02.ps1',
 '-CodePath','C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe',
 '-HostTestsPath','docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/prebuilt-host-02/lite-secure-editor-host.js',
 '-ExtensionRoot','docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/vsix-extracted-01/extension')
