if('F24_CURRENT_FACTS_BOUND' -cne 'F24_CURRENT_FACTS_BOUND'){throw 'F24 template is PREPARED_NOT_BOUND; bind current checked facts in a new owned copy before execution.'}
function Assert-F24EditorHost {
 $taskFrozenRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 $taskFullGate=Join-Path $PSScriptRoot 'full-tests-01.txt.result.json'
 if((Get-FileHash -LiteralPath $taskFullGate -Algorithm SHA256).Hash.ToLowerInvariant() -cne '4d9181b82235ef1e579bd97e60a01fa42839f31b346e05f24751f2120e1b6323'){throw 'Current full gate receipt bytes changed or remain unbound.'}
 $taskFullGateResult=Get-Content -LiteralPath $taskFullGate -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskFullGateResult.exitCode -ne 0){throw 'Current full gate did not pass; no native launch.'}
 $taskFullRaw=Join-Path $taskFrozenRepo 'docs/soterai-lite/evidence/20261023-f24-artifact-c3a5d91e/full-tests-01.txt'
 if((Get-FileHash -LiteralPath $taskFullRaw -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskFullGateResult.sha256.ToLowerInvariant()){throw 'Current full gate raw bytes do not match the checked exit receipt.'}
 $taskFrozen=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'source-inputs-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
 $taskFrozenRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 foreach($taskInput in $taskFrozen.records){
  $taskInputPath=Join-Path $taskFrozenRepo $taskInput.path
  if((Get-Item -LiteralPath $taskInputPath).Length -ne $taskInput.bytes -or (Get-FileHash -LiteralPath $taskInputPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInput.sha256){throw 'Frozen scoped source/test/build input changed.'}
 }
 $taskReview=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-version-review-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReview.status -cne 'REVIEWED_NEW_EDITOR_HOST_STATIC_ONLY_NATIVE_PENDING' -or $taskReview.currentHost.version -cne '1.143.1'){throw 'Explicit reviewed host binding required.'}
 $taskHost=$taskReview.currentHost
 if([Diagnostics.FileVersionInfo]::GetVersionInfo($taskHost.executable.path).ProductVersion -cne $taskHost.version){throw 'Reviewed editor version changed.'}
 foreach($taskRecord in @($taskHost.executable)+@($taskHost.applicationFiles)){
  if((Get-Item -LiteralPath $taskRecord.path).Length -ne $taskRecord.bytes -or (Get-FileHash -LiteralPath $taskRecord.path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskRecord.sha256){throw 'Reviewed editor application/executable bytes changed.'}
 }
}
