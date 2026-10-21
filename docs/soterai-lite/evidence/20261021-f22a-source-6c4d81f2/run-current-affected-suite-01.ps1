$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f22a-20261021-attempt01.vsix'
$taskVsixSha='793c750bcbff547fff816f5ed135b78ec8b4d754874a74308df0385880b46d18'
$taskBundleSha='8ae64574fb9d829d43cc6d2445d2216c4d74a9f146f0331a91329405d373091a'
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$taskExtension=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'
$taskRows=@(
 @{name='affected-hygiene-run-01';helper='run-affected-hygiene-01.ps1';driver='lite-hygiene-host.js'},
 @{name='affected-vault-run-01';helper='run-affected-vault-01.ps1';driver='lite-vault-host.js'},
 @{name='retained-native-run-01';helper='run-retained-native-01.ps1';driver='lite-broker-host.js'},
 @{name='affected-hosts-run-01';helper='run-affected-hosts-03.ps1';driver=$null}
)
$taskResults=@()
foreach($taskRow in $taskRows){
 $taskOutput=Join-Path $PSScriptRoot ($taskRow.name+'.txt')
 $taskArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot $taskRow.helper),'-CodePath',$taskCode,'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskVsixSha,'-ExpectedBundleSha256',$taskBundleSha)
 if($taskRow.driver){$taskArgs+=@('-HostTestsPath',(Join-Path $PSScriptRoot ('prebuilt-native-hosts-02/'+$taskRow.driver)),'-ExtensionRoot',$taskExtension)}else{$taskArgs+=@('-InspectionName','01')}
 & $taskRunner -FilePath powershell -ArgumentList $taskArgs -OutputFile $taskOutput -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Affected suite stopped; retained raw evidence: '+$taskRow.name)}
 if((Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskVsixSha){throw 'Current artifact changed.'}
 $taskResults+=@{name=$taskRow.name;output=$taskOutput;sha256=$taskReceipt.sha256.ToLowerInvariant()}
}
$taskSummary=@{status='PASS_SCOPED';vsixSha256=$taskVsixSha;extensionSha256=$taskBundleSha;runs=$taskResults;scope='Current exact-object affected hygiene21/vault10/retained106/functional10/security17 unchanged; scripted isolated synthetic native decisions, LOW independence.'}
$taskOutput=Join-Path $PSScriptRoot 'affected-suite-summary-01.json'
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskSummary|ConvertTo-Json -Depth 12)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskSummary|ConvertTo-Json -Depth 12
