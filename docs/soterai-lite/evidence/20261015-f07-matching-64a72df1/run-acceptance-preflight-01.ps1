$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F07Acceptance([string]$Name,[string[]]$Arguments){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot $Name) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.result.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('F07 acceptance preflight failed: '+$Name)}
}
Invoke-F07Acceptance 'source-review-write-01.txt' @('docs/soterai-lite/evidence/20261015-f07-matching-64a72df1/write-source-review-01.cjs')
Invoke-F07Acceptance 'commit-scripts-prepare-01.txt' @('docs/soterai-lite/evidence/20261015-f07-matching-64a72df1/prepare-commit-scripts-01.cjs')
Invoke-F07Acceptance 'acceptance-preflight-01.txt' @('docs/soterai-lite/evidence/20261015-f07-matching-64a72df1/prepare-acceptance-01.cjs')
