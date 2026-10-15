$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath node -ArgumentList @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit') -OutputFile (Join-Path $PSScriptRoot 'typecheck-07.txt') -WorkingDirectory $taskRepo
if($LASTEXITCODE -ne 0){throw 'Typecheck failed.'}
& $taskRunner -FilePath node -ArgumentList @('docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/build-host-04.cjs') -OutputFile (Join-Path $PSScriptRoot 'host-build-04.txt') -WorkingDirectory $taskRepo
if($LASTEXITCODE -ne 0){throw 'Host build failed.'}
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/run-native-02.ps1','-CodePath','C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe','-HostTestsPath','docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/prebuilt-host-04/lite-vault-host.js','-ExtensionRoot','docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/vsix-extracted-01/extension') -OutputFile (Join-Path $PSScriptRoot 'native-host-launch-05.txt') -WorkingDirectory $taskRepo
