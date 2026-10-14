$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
function Invoke-F05Check([string]$Name,[string]$File,[string[]]$Arguments,[string]$Directory=$taskRepo){
 $taskOutput=Join-Path $PSScriptRoot $Name
 if(Test-Path -LiteralPath $taskOutput){throw 'Existing evidence refused.'}
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $Directory
 $taskResult=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F05 step failed: '+$Name)}
}
Invoke-F05Check 'typecheck-08.txt' 'node' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F05Check 'focused-after-04.txt' 'node' @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/lite-secure-editor-model.test.ts','packages/vscode-extension/src/__tests__/lite-secure-editor-recovery.test.ts','packages/vscode-extension/src/__tests__/lite-secure-editor-commands.test.ts')
Invoke-F05Check 'full-tests-04.txt' 'node' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F05Check 'package-02.txt' 'node' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f05-20261014-attempt02.vsix')
Invoke-F05Check 'prepare-inspection-02.txt' 'node' @('docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/prepare-inspection-02.cjs')
Invoke-F05Check 'vsix-inspection-02.txt' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/inspect-vsix-02.ps1')
Invoke-F05Check 'host-build-03.txt' 'node' @('docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/build-host-03.cjs')
Invoke-F05Check 'native-host-launch-03.txt' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/run-native-02.ps1','-CodePath','C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe','-HostTestsPath','docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/prebuilt-host-03/lite-secure-editor-host.js','-ExtensionRoot','docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/vsix-extracted-02/extension')
