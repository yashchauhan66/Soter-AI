$taskIndex = Get-Content -LiteralPath 'docs\soterai-lite\evidence-index-20261013-requirements-review.json' -Raw | ConvertFrom-Json
$taskHead = (& git rev-parse HEAD).Trim()
$taskMismatches = 0
foreach ($taskEntry in $taskIndex.files) {
    if ((Get-FileHash -LiteralPath $taskEntry.path -Algorithm SHA256).Hash -ne $taskEntry.sha256) { $taskMismatches++ }
    if ((& git hash-object --no-filters -- $taskEntry.path).Trim() -ne (& git rev-parse "${taskHead}:$($taskEntry.path)").Trim()) { $taskMismatches++ }
}
$taskChangedFiles = @(& git diff-tree --no-commit-id --name-only -r HEAD)
$taskUnexpectedCommitPaths = @($taskChangedFiles | Where-Object { -not $_.StartsWith('docs/soterai-lite/') }).Count
$taskBefore = @(Get-Content -LiteralPath 'docs\soterai-lite\evidence\20261013-l0-disk-gate-51f892d0\git-status-before.txt' | Where-Object {$_ -notmatch 'docs/soterai-lite'})
$taskAfter = @(& git --no-optional-locks status --short | Where-Object {$_ -notmatch 'docs/soterai-lite'})
$taskExistingChanges = @(Compare-Object -ReferenceObject $taskBefore -DifferenceObject $taskAfter).Count
$taskFinalCandidateHash = (Get-FileHash -LiteralPath 'docs\project-privacy\evidence\20261012-final-local\soterai-project-privacy-0.6.3-20261012.vsix' -Algorithm SHA256).Hash
$taskOutput = [ordered]@{verifiedAtUtc=[DateTime]::UtcNow.ToString('o');scope='Review evidence integrity and retained candidate identity; no new product tests';commit=$taskHead;reviewFilesChecked=$taskIndex.fileCount;hashOrCommittedByteMismatches=$taskMismatches;committedFiles=$taskChangedFiles.Count;unexpectedCommitPaths=$taskUnexpectedCommitPaths;existingProjectStatusDifferences=$taskExistingChanges;finalExistingCandidateSha256=$taskFinalCandidateHash;newLiteBundle='NOT-BUILT';freshProductTests='NOT-RUN';result=$(if ($taskMismatches -eq 0 -and $taskUnexpectedCommitPaths -eq 0 -and $taskExistingChanges -eq 0 -and $taskFinalCandidateHash -eq '7B590560325AA46C3519CBF6BF0300C7BF7783D910CBAE7D89E4636010E61C2C') {'PASS'} else {'FAIL'})}
$taskOutput | ConvertTo-Json | Out-File -LiteralPath 'docs\soterai-lite\evidence\20261013-requirements-audit-a816bcf9\post-commit-verification.json' -Encoding utf8 -NoClobber
$taskOutput | ConvertTo-Json
if ($taskOutput.result -ne 'PASS') { exit 1 }
