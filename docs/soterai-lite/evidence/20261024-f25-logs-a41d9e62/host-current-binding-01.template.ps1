if('__F25_TEMPLATE_BOUND__' -cne 'F25_CURRENT_FACTS_BOUND'){throw 'F25 template is PREPARED_NOT_BOUND; bind current checked facts in a new owned copy before execution.'}
function Assert-F25EditorHost {
 $taskFrozenRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 $taskFullGate=Join-Path $PSScriptRoot '__F25_FULL_GATE_RESULT_JSON__'
 if((Get-FileHash -LiteralPath $taskFullGate -Algorithm SHA256).Hash.ToLowerInvariant() -cne '4d9181b82235ef1e579bd97e60a01fa42839f31b346e05f25751f2120e1b6323'){throw 'Current full gate receipt bytes changed or remain unbound.'}
 $taskFullGateResult=Get-Content -LiteralPath $taskFullGate -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskFullGateResult.exitCode -ne 0){throw 'Current full gate did not pass; no native launch.'}
 $taskFullRaw=Join-Path $taskFrozenRepo '__F25_FULL_GATE_RAW_RELATIVE__'
 if((Get-FileHash -LiteralPath $taskFullRaw -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskFullGateResult.sha256.ToLowerInvariant()){throw 'Current full gate raw bytes do not match the checked exit receipt.'}
 if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot '__F25_NATIVE_INPUTS_JSON__') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__F25_NATIVE_INPUTS_SHA256__'){throw 'Final native source/test/build freeze changed or remains unbound.'}
 $taskDriverProvenance=Join-Path $PSScriptRoot '__F25_NATIVE_DRIVER_PROVENANCE_JSON__'
 if((Get-FileHash -LiteralPath $taskDriverProvenance -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__F25_NATIVE_DRIVER_PROVENANCE_SHA256__'){throw 'Current built driver provenance changed or remains unbound.'}
 $taskDrivers=Get-Content -LiteralPath $taskDriverProvenance -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskDrivers.status -cne 'BUILT_NOT_RUN_ESM_PARSER_INLINED' -or @($taskDrivers.drivers).Count -ne 20){throw 'Twenty current built native drivers required.'}
 foreach($taskDriver in $taskDrivers.drivers){$taskBuilt=Join-Path $PSScriptRoot $taskDriver.path;if((Get-Item -LiteralPath $taskBuilt).Length -ne $taskDriver.bytes -or (Get-FileHash -LiteralPath $taskBuilt -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskDriver.sha256){throw 'Current native driver output bytes changed.'}}
 $taskFrozen=Get-Content -LiteralPath (Join-Path $PSScriptRoot '__F25_NATIVE_INPUTS_JSON__') -Raw -Encoding UTF8|ConvertFrom-Json
 $taskFrozenRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 foreach($taskInput in $taskFrozen.records){
  $taskInputPath=Join-Path $taskFrozenRepo $taskInput.path
  if((Get-Item -LiteralPath $taskInputPath).Length -ne $taskInput.bytes -or (Get-FileHash -LiteralPath $taskInputPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInput.sha256){throw 'Frozen scoped source/test/build input changed.'}
 }
 if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot '__F25_HOST_VERSION_REVIEW_JSON__') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__F25_HOST_VERSION_REVIEW_SHA256__'){throw 'Fresh F25 installed-host review changed or remains unbound.'}
 $taskReview=Get-Content -LiteralPath (Join-Path $PSScriptRoot '__F25_HOST_VERSION_REVIEW_JSON__') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReview.status -cne 'REVIEWED_NEW_EDITOR_HOST_STATIC_ONLY_NATIVE_PENDING' -or $taskReview.currentHost.version -cne '1.143.1'){throw 'Explicit reviewed host binding required.'}
 $taskHost=$taskReview.currentHost
 if($taskHost.executable.sha256 -cne '325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6' -or $taskHost.executable.bytes -ne 238249784){throw 'Current reviewed Code1.143.1 executable pin differs; stop for fresh inspection.'}
 if([IO.Path]::GetFullPath($taskHost.executable.path) -ine [IO.Path]::GetFullPath('__F25_EDITOR_EXECUTABLE__')){throw 'Fresh reviewed executable path differs.'}
 if((Get-Variable -Name CodePath -ErrorAction SilentlyContinue) -and [IO.Path]::GetFullPath($CodePath) -ine [IO.Path]::GetFullPath($taskHost.executable.path)){throw 'Requested Code path differs from the current reviewed host.'}
 if([Diagnostics.FileVersionInfo]::GetVersionInfo($taskHost.executable.path).ProductVersion -cne $taskHost.version){throw 'Reviewed editor version changed.'}
 foreach($taskRecord in @($taskHost.executable)+@($taskHost.applicationFiles)){
  if((Get-Item -LiteralPath $taskRecord.path).Length -ne $taskRecord.bytes -or (Get-FileHash -LiteralPath $taskRecord.path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskRecord.sha256){throw 'Reviewed editor application/executable bytes changed.'}
 }
}
