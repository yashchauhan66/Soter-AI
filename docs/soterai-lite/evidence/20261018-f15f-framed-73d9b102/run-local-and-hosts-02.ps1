$ErrorActionPreference='Stop'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run-local-02.ps1')
if($LASTEXITCODE -ne 0){throw 'Current local gates failed; native launch withheld.'}
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run-hosts-01.ps1')
if($LASTEXITCODE -ne 0){throw 'Current native/affected gates incomplete; preserve receipts.'}
