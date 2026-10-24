$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskAcceptance=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'acceptance-gates-01.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskAcceptance.exitCode -ne 0){throw 'Actual passing acceptance required before local byte barriers.'}
$taskRows=@(
 @{name='prepare-source-commit-run-03';helper='prepare-source-commit-03.cjs'},
 @{name='source-commit-run-04';helper='commit-source-04.cjs'},
 @{name='prepare-transition-run-02';helper='prepare-transition-02.cjs'},
 @{name='transition-commit-run-04';helper='commit-transition-04.cjs'}
)
foreach($taskRow in $taskRows){
 $taskOutput=Join-Path $PSScriptRoot ($taskRow.name+'.txt')
 if(Test-Path -LiteralPath $taskOutput){throw 'Existing byte barrier raw output refused.'}
 & $taskRunner -FilePath node -ArgumentList @((Join-Path $PSScriptRoot $taskRow.helper)) -OutputFile $taskOutput -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Byte barrier stopped with retained evidence: '+$taskRow.name)}
}
$taskSource=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f24-source-byte-verification-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskTransition=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f24-transition-byte-verification-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskSource.status -cne 'PASS' -or $taskTransition.status -cne 'PASS' -or $taskSource.revision -cne $taskTransition.parent -or $taskSource.mismatches.Count -ne 0 -or $taskTransition.mismatches.Count -ne 0){throw 'Actual source and transition byte proofs incomplete.'}
@{status='PASS_F24_SOURCE_AND_TRANSITION_BYTES';source=$taskSource.revision;transition=$taskTransition.revision;sourcePaths=$taskSource.verifiedMembershipPaths;transitionPaths=$taskTransition.verifiedMembershipPaths;vsixSha256=$taskSource.retainedArtifact.sha256}|ConvertTo-Json
exit 0
