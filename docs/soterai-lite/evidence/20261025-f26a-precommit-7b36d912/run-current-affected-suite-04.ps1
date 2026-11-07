param(
 [Parameter(Mandatory=$true)][string]$VsixPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256
)
$ErrorActionPreference='Stop'
if('F26A_CURRENT_FACTS_BOUND' -cne 'F26A_CURRENT_FACTS_BOUND'){throw 'F26A affected helper is PREPARED_NOT_BOUND; materialize a new checked owned copy.'}
. (Join-Path $PSScriptRoot 'affected-native-binding-04.ps1')
Assert-F26AAffectedInputs
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskVsix=[IO.Path]::GetFullPath($VsixPath);$taskVsixSha=$ExpectedVsixSha256.ToLowerInvariant();$taskBundleSha=$ExpectedBundleSha256.ToLowerInvariant()
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$taskExtension=Join-Path $PSScriptRoot 'vsix-extracted-02/extension'
. (Join-Path $PSScriptRoot 'artifact-binding-02.ps1')
Assert-F15bRuntimeBinding -VsixPath $taskVsix -ExpectedVsixSha256 $taskVsixSha -ExtensionRoot $taskExtension -ExpectedBundleSha256 $taskBundleSha
. (Join-Path $PSScriptRoot 'host-current-binding-03.ps1')
Assert-F26AEditorHost
$taskRows=@(
 @{name='affected-artifact-run-01';helper='run-artifact-native-04.ps1';driver='lite-artifact-host.js'},
 @{name='affected-streaming-output-run-01';helper='run-affected-streaming-output-04.ps1';driver='lite-streaming-output-host.js'},
 @{name='affected-vault-runtime-run-01';helper='run-affected-vault-runtime-04.ps1';driver='lite-vault-runtime-host.js'},
 @{name='affected-ps51-run-01';helper='run-affected-ps51-04.ps1';driver='lite-ps51-host.js'},
 @{name='affected-cmd-run-01';helper='run-affected-cmd-04.ps1';driver='lite-cmd-host.js'},
 @{name='affected-gitbash-run-01';helper='run-affected-gitbash-04.ps1';driver='lite-gitbash-host.js'},
 @{name='affected-history-run-01';helper='run-affected-history-04.ps1';driver='lite-history-host.js'},
 @{name='affected-mcp-run-01';helper='run-mcp-native-04.ps1';driver='lite-mcp-host.js'},
 @{name='affected-editor-run-01';helper='run-affected-editor-04.ps1';driver='lite-editor-host.js'},
 @{name='affected-ci-run-01';helper='run-affected-ci-04.ps1';driver='lite-ci-host.js'},
 @{name='affected-service-account-run-01';helper='run-affected-service-account-04.ps1';driver='lite-service-account-host.js'},
 @{name='affected-registry-run-01';helper='run-affected-registry-04.ps1';driver='lite-registry-host.js'},
 @{name='affected-terraform-run-01';helper='run-affected-terraform-04.ps1';driver='lite-terraform-host.js'},
 @{name='affected-container-run-01';helper='run-affected-container-04.ps1';driver='lite-container-host.js'},
 @{name='affected-source-run-01';helper='run-affected-source-04.ps1';driver='lite-source-host.js'},
 @{name='affected-hygiene-run-01';helper='run-affected-hygiene-04.ps1';driver='lite-hygiene-host.js'},
 @{name='affected-vault-run-01';helper='run-affected-vault-04.ps1';driver='lite-vault-host.js'},
 @{name='retained-native-run-01';helper='run-retained-native-04.ps1';driver='lite-broker-host.js'},
 @{name='affected-hosts-run-01';helper='run-affected-hosts-04.ps1';driver=$null}
)
$taskResults=@()
foreach($taskRow in $taskRows){
 Assert-F26AEditorHost
 $taskOutput=Join-Path $PSScriptRoot ($taskRow.name+'.txt')
 $taskArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot $taskRow.helper),'-CodePath',$taskCode,'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskVsixSha,'-ExpectedBundleSha256',$taskBundleSha)
 if($taskRow.driver){$taskArgs+=@('-HostTestsPath',(Join-Path $PSScriptRoot ('prebuilt-native-hosts-04/'+$taskRow.driver)),'-ExtensionRoot',$taskExtension)}else{$taskArgs+=@('-InspectionName','02')}
 & $taskRunner -FilePath powershell -ArgumentList $taskArgs -OutputFile $taskOutput -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Affected suite stopped; retained raw evidence: '+$taskRow.name)}
 Assert-F15bRuntimeBinding -VsixPath $taskVsix -ExpectedVsixSha256 $taskVsixSha -ExtensionRoot $taskExtension -ExpectedBundleSha256 $taskBundleSha
 Assert-F26AEditorHost
 $taskResults+=@{name=$taskRow.name;output=$taskOutput;sha256=$taskReceipt.sha256.ToLowerInvariant()}
}
$taskSummary=@{status='PASS_SCOPED';vsixSha256=$taskVsixSha;extensionSha256=$taskBundleSha;runs=$taskResults;scope='Current exact-object affectedArtifact25/F08-13/F09-12/PS51-19/CMD-19/GitBash-19/History25/MCP25/Editor25/CI25/ServiceAccount25/Registry25/Terraform25/container25/source21/hygiene21/vault10/retained106/functional10/security17 unchanged; scripted isolated synthetic native decisions, LOW independence.'}
$taskOutput=Join-Path $PSScriptRoot 'affected-suite-summary-01.json'
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskSummary|ConvertTo-Json -Depth 12)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskSummary|ConvertTo-Json -Depth 12
