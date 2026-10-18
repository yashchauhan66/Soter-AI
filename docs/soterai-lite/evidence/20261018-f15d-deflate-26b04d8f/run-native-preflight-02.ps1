$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
foreach($taskStep in @(@{Name='typecheck-02';Args=@('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')},@{Name='host-build-02';Args=@('docs/soterai-lite/evidence/20261018-f15d-deflate-26b04d8f/build-native-hosts-01.cjs','prebuilt-native-hosts-02')})){
 & $taskRunner -FilePath node -ArgumentList $taskStep.Args -OutputFile (Join-Path $PSScriptRoot ($taskStep.Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskStep.Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Native preflight failed; retained '+$taskStep.Name)}
}
