$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
foreach($taskCheck in @(@{Name='typecheck-07';Args=@('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')},@{Name='host-build-03';Args=@('docs/soterai-lite/evidence/20261017-f14-broker-lifecycle-71e5b490/build-native-hosts-01.cjs','prebuilt-native-hosts-03')})){
 & $taskRunner -FilePath node -ArgumentList $taskCheck.Args -OutputFile (Join-Path $PSScriptRoot ($taskCheck.Name+'.txt')) -WorkingDirectory $taskRepo
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskCheck.Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F14 fixture precheck failed; retained '+$taskCheck.Name)}
}
& (Join-Path $PSScriptRoot 'run-final-hosts-02.ps1')
