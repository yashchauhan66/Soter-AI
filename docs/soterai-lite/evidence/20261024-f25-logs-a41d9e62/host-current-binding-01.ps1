if('F25_CURRENT_FACTS_BOUND' -cne 'F25_CURRENT_FACTS_BOUND'){throw 'F25 template is PREPARED_NOT_BOUND; bind current checked facts in a new owned copy before execution.'}
function Assert-F25EditorHost {
 $taskFrozenRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 $taskFullGate=Join-Path $PSScriptRoot 'full-tests-03.txt.result.json'
 if((Get-FileHash -LiteralPath $taskFullGate -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'cbd15f4146d780eb97a125eb2cb32d6c00e84a659710a31884fc5a23a4e4d0eb'){throw 'Current full gate receipt bytes changed or remain unbound.'}
 $taskFullGateResult=Get-Content -LiteralPath $taskFullGate -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskFullGateResult.exitCode -ne 0){throw 'Current full gate did not pass; no native launch.'}
 $taskFullRaw=Join-Path $taskFrozenRepo 'docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62/full-tests-03.txt'
 if((Get-FileHash -LiteralPath $taskFullRaw -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskFullGateResult.sha256.ToLowerInvariant()){throw 'Current full gate raw bytes do not match the checked exit receipt.'}
 if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'native-source-inputs-01.json') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '303128dd11a71f2e9bf204f4772d26390b8813aec90dd1c63eb23f46236be3f8'){throw 'Final native source/test/build freeze changed or remains unbound.'}
 $taskDriverProvenance=Join-Path $PSScriptRoot 'native-driver-provenance-01.json'
 if((Get-FileHash -LiteralPath $taskDriverProvenance -Algorithm SHA256).Hash.ToLowerInvariant() -cne '633d8b88ab0c2fcc4e55ef9ed0c46a20de9ccc63b7814c16f7ab03f95a25cd08'){throw 'Current built driver provenance changed or remains unbound.'}
 $taskDrivers=Get-Content -LiteralPath $taskDriverProvenance -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskDrivers.status -cne 'BUILT_NOT_RUN_ESM_PARSER_INLINED' -or @($taskDrivers.drivers).Count -ne 20){throw 'Twenty current built native drivers required.'}
 foreach($taskDriver in $taskDrivers.drivers){$taskBuilt=Join-Path $PSScriptRoot $taskDriver.path;if((Get-Item -LiteralPath $taskBuilt).Length -ne $taskDriver.bytes -or (Get-FileHash -LiteralPath $taskBuilt -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskDriver.sha256){throw 'Current native driver output bytes changed.'}}
 $taskFrozen=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-source-inputs-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
 $taskFrozenRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 foreach($taskInput in $taskFrozen.records){
  $taskInputPath=Join-Path $taskFrozenRepo $taskInput.path
  if((Get-Item -LiteralPath $taskInputPath).Length -ne $taskInput.bytes -or (Get-FileHash -LiteralPath $taskInputPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInput.sha256){throw 'Frozen scoped source/test/build input changed.'}
 }
 if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'host-version-review-01.json') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '5753c649112077de63fe26fabfb10491b4dc278de4ffc4aa6436b29057a155de'){throw 'Fresh F25 installed-host review changed or remains unbound.'}
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
