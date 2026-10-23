$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
& (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1') -FilePath 'powershell' -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'complete-byte-barriers-04.ps1')) -OutputFile (Join-Path $PSScriptRoot 'byte-barriers-run-01.txt') -WorkingDirectory $taskRepo
exit $LASTEXITCODE
