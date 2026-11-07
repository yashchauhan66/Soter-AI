if('__F26A_TEMPLATE_BOUND__' -cne 'F26A_CURRENT_FACTS_BOUND'){throw 'F26A template is PREPARED_NOT_BOUND; bind current checked facts in a new owned copy before execution.'}
function Assert-F26AEditorHost {
 $taskFrozenRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 $taskFullGate=Join-Path $PSScriptRoot 'full-tests-02.txt.result.json'
 if((Get-FileHash -LiteralPath $taskFullGate -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__F26A_FULL02_RECEIPT_SHA256__'){throw 'Current full gate receipt bytes changed or remain unbound.'}
 $taskFullGateResult=Get-Content -LiteralPath $taskFullGate -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskFullGateResult.exitCode -ne 0){throw 'Current full gate did not pass; no native launch.'}
 $taskFullRaw=Join-Path $taskFrozenRepo 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/full-tests-02.txt'
 if((Get-FileHash -LiteralPath $taskFullRaw -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskFullGateResult.sha256.ToLowerInvariant()){throw 'Current full gate raw bytes do not match the checked exit receipt.'}
 if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'full-inputs-02.json') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322'){throw 'Final native source/test/build freeze changed or remains unbound.'}
 $taskDriverProvenance=Join-Path $PSScriptRoot 'native-driver-provenance-02.json'
 if((Get-FileHash -LiteralPath $taskDriverProvenance -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__F26A_DRIVER02_PROVENANCE_SHA256__'){throw 'Current built driver provenance changed or remains unbound.'}
 $taskDrivers=Get-Content -LiteralPath $taskDriverProvenance -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskDrivers.status -cne 'BUILT_NOT_RUN_ESM_PARSER_INLINED' -or @($taskDrivers.drivers).Count -ne 21){throw 'Twenty-one current built native drivers required.'}
 foreach($taskDriver in $taskDrivers.drivers){$taskBuilt=Join-Path $PSScriptRoot $taskDriver.path;if((Get-Item -LiteralPath $taskBuilt).Length -ne $taskDriver.bytes -or (Get-FileHash -LiteralPath $taskBuilt -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskDriver.sha256){throw 'Current native driver output bytes changed.'}}
 $taskFrozen=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'full-inputs-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
 $taskFrozenRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 foreach($taskInput in $taskFrozen.files){
  $taskInputPath=Join-Path $taskFrozenRepo $taskInput.path
  if((Get-Item -LiteralPath $taskInputPath).Length -ne $taskInput.bytes -or (Get-FileHash -LiteralPath $taskInputPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInput.sha256){throw 'Frozen scoped source/test/build input changed.'}
 }
 if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'host-version-review-01.json') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__F26A_HOST_REVIEW_SHA256__'){throw 'Fresh F26A installed-host review changed or remains unbound.'}
 $taskReview=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-version-review-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReview.status -cne 'REVIEWED_NEW_EDITOR_HOST_STATIC_ONLY_NATIVE_PENDING' -or $taskReview.currentHost.version -cne '1.143.1'){throw 'Explicit reviewed host binding required.'}
 $taskHost=$taskReview.currentHost
 if($taskHost.executable.sha256 -cne '325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6' -or $taskHost.executable.bytes -ne 238249784){throw 'Current reviewed Code1.143.1 executable pin differs; stop for fresh inspection.'}
 if([IO.Path]::GetFullPath($taskHost.executable.path) -ine [IO.Path]::GetFullPath('C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe')){throw 'Fresh reviewed executable path differs.'}
 if((Get-Variable -Name CodePath -ErrorAction SilentlyContinue) -and [IO.Path]::GetFullPath($CodePath) -ine [IO.Path]::GetFullPath($taskHost.executable.path)){throw 'Requested Code path differs from the current reviewed host.'}
 if([Diagnostics.FileVersionInfo]::GetVersionInfo($taskHost.executable.path).ProductVersion -cne $taskHost.version){throw 'Reviewed editor version changed.'}
 foreach($taskRecord in @($taskHost.executable)+@($taskHost.applicationFiles)){
  if((Get-Item -LiteralPath $taskRecord.path).Length -ne $taskRecord.bytes -or (Get-FileHash -LiteralPath $taskRecord.path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskRecord.sha256){throw 'Reviewed editor application/executable bytes changed.'}
 }
}
