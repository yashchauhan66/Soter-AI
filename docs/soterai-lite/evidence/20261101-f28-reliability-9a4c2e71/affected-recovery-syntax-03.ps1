$ErrorActionPreference='Stop'
foreach($n in @('affected-current-admission-03.cjs','run-affected-current-03.cjs','verify-affected-current-04.cjs','audit-affected-partial-04.cjs')){& 'C:\Program Files\nodejs\node.exe' --check (Join-Path $PSScriptRoot $n);if($LASTEXITCODE -ne 0){throw 'Recovery JavaScript syntax failed'}}
Write-Output 'PASS: four recovery JavaScript syntax checks; no host execution.'
