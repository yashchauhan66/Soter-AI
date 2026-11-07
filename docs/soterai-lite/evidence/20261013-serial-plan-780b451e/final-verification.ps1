$ErrorActionPreference = 'Stop'
$taskIndexPath = 'docs/soterai-lite/evidence-index-20261013-serial-plan.json'
$taskIndex = Get-Content -LiteralPath $taskIndexPath -Raw -Encoding utf8 | ConvertFrom-Json
$taskHead = (& git rev-parse HEAD).Trim()
$taskMismatches = 0
foreach ($taskEntry in $taskIndex.files) {
    if ((Get-FileHash -LiteralPath $taskEntry.path -Algorithm SHA256).Hash -ne $taskEntry.sha256) { $taskMismatches++ }
    if ((& git hash-object --no-filters -- $taskEntry.path).Trim() -ne (& git rev-parse "${taskHead}:$($taskEntry.path)").Trim()) { $taskMismatches++ }
}
if ((& git hash-object --no-filters -- $taskIndexPath).Trim() -ne (& git rev-parse "${taskHead}:$taskIndexPath").Trim()) { $taskMismatches++ }
$taskCommitted = @(& git diff-tree --no-commit-id --name-only -r HEAD)
$taskUnexpected = @($taskCommitted | Where-Object {-not $_.StartsWith('docs/soterai-lite/')}).Count
$taskBefore = @(Get-Content -LiteralPath 'docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/git-status-before.txt' -Encoding utf8 | Where-Object {$_ -notmatch 'docs/soterai-lite'})
$taskAfter = @(& git --no-optional-locks status --short | Where-Object {$_ -notmatch 'docs/soterai-lite'})
$taskStatusDifferences = @(Compare-Object -ReferenceObject $taskBefore -DifferenceObject $taskAfter).Count
$taskFinalExistingVsixHash = (Get-FileHash -LiteralPath 'docs/project-privacy/evidence/20261012-final-local/soterai-project-privacy-0.6.3-20261012.vsix' -Algorithm SHA256).Hash
$taskRecord = [ordered]@{
    verifiedAtUtc=[DateTime]::UtcNow.ToString('o')
    result=$(if ($taskMismatches -eq 0 -and $taskUnexpected -eq 0 -and $taskStatusDifferences -eq 0 -and $taskFinalExistingVsixHash -eq '7B590560325AA46C3519CBF6BF0300C7BF7783D910CBAE7D89E4636010E61C2C') {'PASS'} else {'FAIL'})
    scope='Planning integrity/local commit/unchanged existing candidate identity only'
    commit=$taskHead
    indexedFilesChecked=$taskIndex.fileCount
    committedByteObjectsChecked=$taskIndex.fileCount + 1
    committedFileCount=$taskCommitted.Count
    hashOrCommittedByteMismatches=$taskMismatches
    unexpectedCommittedPaths=$taskUnexpected
    existingProjectStatusDifferences=$taskStatusDifferences
    finalExistingCandidateSha256=$taskFinalExistingVsixHash
    newLiteBundle='NOT-BUILT'
    productImplementation='NOT-RUN'
    productTests='NOT-RUN'
    finalRating='PENDING'
}
$taskRecord | ConvertTo-Json -Depth 4 | Out-File -LiteralPath (Join-Path $PSScriptRoot 'post-commit-verification.json') -Encoding utf8 -NoClobber
$taskRecord | ConvertTo-Json -Depth 4
if ($taskRecord.result -ne 'PASS') { exit 1 }

