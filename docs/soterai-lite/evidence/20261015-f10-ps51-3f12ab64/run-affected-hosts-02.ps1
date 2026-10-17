param(
    [Parameter(Mandatory=$true)][string]$VsixPath,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
    [ValidatePattern('^[0-9]{2}$')][string]$InspectionName='01',
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256,
    [string]$CodePath='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
)
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskSource=Join-Path $PSScriptRoot ('vsix-extracted-'+$InspectionName+'/extension')
. (Join-Path $PSScriptRoot 'f10-artifact-binding-01.ps1')
Assert-F10RuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $taskSource -ExpectedBundleSha256 $ExpectedBundleSha256
$taskBundle=Join-Path $taskSource 'dist/extension.js'
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskFunctionalDriver=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-prebuilt-hosts/privacy-host.js'
$taskSecurityDriver=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-prebuilt-hosts/security-host.js'
$taskBaseline=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/security-comparison-01.json'
foreach($taskInput in @($CodePath,$taskRunner,$taskFunctionalDriver,$taskSecurityDriver,$taskBaseline,$taskBundle,(Join-Path $taskSource 'package.json'))){
    if(-not(Test-Path -LiteralPath $taskInput -PathType Leaf)){throw 'A required existing input is missing; nothing was launched.'}
}
$taskExpected=$ExpectedBundleSha256.ToLowerInvariant()
$taskVsixFull=[IO.Path]::GetFullPath($VsixPath)
$taskExpectedVsix=$ExpectedVsixSha256.ToLowerInvariant()
if((Get-FileHash -LiteralPath $taskBundle -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpected){throw 'F10 extracted runtime differs from the explicitly approved artifact bytes.'}
$taskRunName='affected-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N')
$taskRunRoot=Join-Path $PSScriptRoot $taskRunName
if(Test-Path -LiteralPath $taskRunRoot){throw 'Existing run evidence refused.'}
[void][IO.Directory]::CreateDirectory($taskRunRoot)
function Write-F10NewJson([string]$Path,[object]$Value){
    $taskStream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try{$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 12)+[Environment]::NewLine);$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
}
function Invoke-F10Affected([string]$Name,[string[]]$Arguments){
    Assert-F10RuntimeBinding -VsixPath $taskVsixFull -ExpectedVsixSha256 $taskExpectedVsix -ExtensionRoot $taskSource -ExpectedBundleSha256 $taskExpected
    $taskOutput=Join-Path $taskRunRoot $Name
    & $taskRunner -FilePath powershell -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $taskRepo
    $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
    if($taskReceipt.exitCode -ne 0){throw ('Affected native host failed or is incomplete; raw evidence retained: '+$Name)}
    Assert-F10RuntimeBinding -VsixPath $taskVsixFull -ExpectedVsixSha256 $taskExpectedVsix -ExtensionRoot $taskSource -ExpectedBundleSha256 $taskExpected
    if((Get-FileHash -LiteralPath $taskBundle -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpected){throw 'F10 source runtime changed during the affected host run.'}
}
$taskCodeSha=(Get-FileHash -LiteralPath $CodePath -Algorithm SHA256).Hash.ToLowerInvariant()
$taskBaselineSha=(Get-FileHash -LiteralPath $taskBaseline -Algorithm SHA256).Hash.ToLowerInvariant()
Write-F10NewJson (Join-Path $taskRunRoot 'freeze.json') @{
    schemaVersion=1;createdAt=[DateTime]::UtcNow.ToString('o');syntheticOnly=$true;status='PREPARED_NOT_RUN';
    vsixPath=$taskVsixFull;vsixSha256=$taskExpectedVsix;sourceExtension=$taskSource;extensionBundleSha256=$taskExpected;codePath=$CodePath;codeSha256=$taskCodeSha;
    functionalHostSha256=(Get-FileHash -LiteralPath $taskFunctionalDriver -Algorithm SHA256).Hash.ToLowerInvariant();
    securityHostSha256=(Get-FileHash -LiteralPath $taskSecurityDriver -Algorithm SHA256).Hash.ToLowerInvariant();
    baselinePath=$taskBaseline;baselineSha256=$taskBaselineSha;
    scope='Existing functional10 and security17 drivers, sequential, fresh D: profiles. F05/F06 native results remain attributed to their historical artifact.'
}
$taskPriorTemp=$env:TEMP;$taskPriorTmp=$env:TMP
try{
    $env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
    if(-not(Test-Path -LiteralPath $env:TEMP -PathType Container)){throw 'The existing owned D: temporary directory is missing.'}
    $taskFunctionalRoot=Join-Path $taskRunRoot 'functional'
    Invoke-F10Affected 'functional-launch-01.txt' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-functional-02.ps1'),'-CodePath',$CodePath,'-HostTestsPath',$taskFunctionalDriver,'-OutputRoot',$taskFunctionalRoot,'-ExtensionRoot',$taskSource,'-VsixPath',$taskVsixFull,'-ExpectedVsixSha256',$taskExpectedVsix,'-ExpectedBundleSha256',$taskExpected)
    $taskFunctionalFiles=@(Get-ChildItem -LiteralPath $taskFunctionalRoot -Recurse -File -Filter 'functional-results.json')
    if($taskFunctionalFiles.Count -ne 1){throw 'Exactly one complete functional result is required.'}
    $taskFunctional=Get-Content -LiteralPath $taskFunctionalFiles[0].FullName -Raw -Encoding UTF8|ConvertFrom-Json
    if($taskFunctional.extensionBundleSha256 -ne $taskExpected -or $taskFunctional.passed -ne 10 -or $taskFunctional.failed -ne 0 -or @($taskFunctional.observations).Count -ne 10 -or @($taskFunctional.observations|Where-Object{$_.status -ne 'PASS'}).Count -ne 0){throw 'Functional10 acceptance failed; result bytes retained.'}
    $taskSecurityRoot=Join-Path $taskRunRoot 'security'
    Invoke-F10Affected 'security-launch-01.txt' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-security-02.ps1'),'-CodePath',$CodePath,'-UsePrebuilt','-HostTestsPath',$taskSecurityDriver,'-OutputRoot',$taskSecurityRoot,'-ExtensionRoot',$taskSource,'-VsixPath',$taskVsixFull,'-ExpectedVsixSha256',$taskExpectedVsix,'-ExpectedBundleSha256',$taskExpected)
    $taskSecurityFiles=@(Get-ChildItem -LiteralPath $taskSecurityRoot -Recurse -File -Filter 'live-host.json')
    if($taskSecurityFiles.Count -ne 1){throw 'Exactly one complete security result is required.'}
    $taskSecurity=Get-Content -LiteralPath $taskSecurityFiles[0].FullName -Raw -Encoding UTF8|ConvertFrom-Json
    $taskPrevious=Get-Content -LiteralPath $taskBaseline -Raw -Encoding UTF8|ConvertFrom-Json
    if($taskSecurity.extensionBundleSha256 -ne $taskExpected -or @($taskSecurity.results).Count -ne 17 -or @($taskPrevious.rows).Count -ne 17){throw 'Security17 byte identity or row count is incomplete.'}
    $taskCompared=@();$taskChanged=0
    foreach($taskPrior in $taskPrevious.rows){
        $taskMatches=@($taskSecurity.results|Where-Object{$_.attack -ceq $taskPrior.attack})
        if($taskMatches.Count -ne 1){throw 'Security case identity is missing or duplicated.'}
        $taskCurrent=$taskMatches[0].status
        if($taskCurrent -cne $taskPrior.current){$taskChanged++}
        $taskCompared+=@{attack=$taskPrior.attack;previous=$taskPrior.current;current=$taskCurrent}
    }
    $taskComparison=@{status=$(if($taskChanged -eq 0){'PASS_NO_REGRESSION'}else{'CHANGED_REQUIRES_REVIEW'});comparedRows=17;changed=$taskChanged;
        extensionBundleSha256=$taskExpected;baselineSha256=$taskBaselineSha;rows=$taskCompared;
        limitation='Eight BLOCKED_SCOPED and nine LEAK_CONFIRMED unmanaged routes remain in the unchanged baseline; no universal protection claim.'}
    Write-F10NewJson (Join-Path $taskRunRoot 'security-comparison-01.json') $taskComparison
    if($taskChanged -ne 0){throw 'Security baseline changed; retained comparison requires review.'}
    if((Get-FileHash -LiteralPath $CodePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskCodeSha){throw 'Code executable changed during this run.'}
    if((Get-FileHash -LiteralPath $taskBaseline -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskBaselineSha){throw 'Historical security baseline changed during this run.'}
    Write-F10NewJson (Join-Path $taskRunRoot 'affected-summary-01.json') @{
        schemaVersion=1;status='PASS_SCOPED';vsixPath=$taskVsixFull;vsixSha256=$taskExpectedVsix;extensionBundleSha256=$taskExpected;functionalPassed=10;securityCompared=17;changed=0;
        functionalResult=$taskFunctionalFiles[0].FullName;securityResult=$taskSecurityFiles[0].FullName;
        securityResiduals='8 BLOCKED_SCOPED;9 LEAK_CONFIRMED';independence='LOW';externalAgents='NOT_TESTED'
    }
    Write-Output ('F10 affected host evidence: '+$taskRunRoot)
}finally{$env:TEMP=$taskPriorTemp;$env:TMP=$taskPriorTmp}

