$ErrorActionPreference = 'Stop'
$taskPlanPath = 'docs/soterai-lite/IMPLEMENTATION-PLAN.md'
$taskQueuePath = 'docs/soterai-lite/FEATURE-QUEUE.json'
$taskPlan = Get-Content -LiteralPath $taskPlanPath -Raw -Encoding utf8
$taskQueue = Get-Content -LiteralPath $taskQueuePath -Raw -Encoding utf8 | ConvertFrom-Json
$taskExpectedIds = @(1..32 | ForEach-Object {'F{0:D2}' -f $_})
$taskActualIds = @($taskQueue.features | ForEach-Object {$_.id})
$taskIdsDiffer = @(Compare-Object -ReferenceObject $taskExpectedIds -DifferenceObject $taskActualIds).Count
$taskPlanRows = @($taskPlan -split '\r?\n' | Where-Object {$_ -match '^\| F\d\d \|'}).Count
$taskTraceTokens = @('U1','U2','U3','U4','U5','U6','U7','U8','U9','U10','L2','L3','L4','L5','L6','L7')
$taskMissingTrace = @($taskTraceTokens | Where-Object {-not [regex]::IsMatch($taskPlan, '\| ' + [regex]::Escape($_) + '\b')})
$taskCardSubcount = @($taskQueue.features | ForEach-Object {$_.subcards} | Where-Object {$null -ne $_}).Count
$taskMatchingBeforeRedaction = [array]::IndexOf($taskActualIds,'F07') -lt [array]::IndexOf($taskActualIds,'F08')
$taskRedactionBeforeRuntime = [array]::IndexOf($taskActualIds,'F08') -lt [array]::IndexOf($taskActualIds,'F09')
$taskPreviousAudit = Get-Content -LiteralPath 'docs/soterai-lite/evidence/20261013-requirements-audit-a816bcf9/audit-raw-metadata.json' -Raw -Encoding utf8 | ConvertFrom-Json
$taskExistingSourceMismatches = @($taskPreviousAudit.sourceAndEvidenceHashes | Where-Object { (Get-FileHash -LiteralPath $_.path -Algorithm SHA256).Hash -ne $_.sha256 } | ForEach-Object {$_.path})
$taskDrive = [System.IO.DriveInfo]::new('C:\')
$taskChecksPass = $taskQueue.implementationConcurrency -eq 1 -and $null -eq $taskQueue.activeFeature -and $taskQueue.finalRating.allowed -eq $false -and $taskQueue.finalRating.status -eq 'PENDING' -and $taskPlanRows -eq 32 -and $taskIdsDiffer -eq 0 -and $taskMissingTrace.Count -eq 0 -and $taskMatchingBeforeRedaction -and $taskRedactionBeforeRuntime -and $taskExistingSourceMismatches.Count -eq 0
$taskRecord = [ordered]@{
    verifiedAtUtc=[DateTime]::UtcNow.ToString('o')
    result=$(if ($taskChecksPass) {'PASS'} else {'FAIL'})
    scope='Planning document/queue integrity only; not product implementation or tests'
    planStatus='STATIC-ONLY'
    implementationConcurrency=$taskQueue.implementationConcurrency
    activeFeature=$taskQueue.activeFeature
    preparations=$taskQueue.preparations.Count
    featureCards=$taskQueue.features.Count
    planFeatureRows=$taskPlanRows
    subcards=$taskCardSubcount
    finalGates=$taskQueue.finalGates.Count
    featureIdDifferences=$taskIdsDiffer
    missingTraceabilityTokens=$taskMissingTrace
    matchingBeforeRedaction=$taskMatchingBeforeRedaction
    redactionBeforeRuntime=$taskRedactionBeforeRuntime
    previousSourceAndEvidenceHashEntriesChecked=$taskPreviousAudit.sourceAndEvidenceHashes.Count
    existingSourceOrEvidenceMismatches=$taskExistingSourceMismatches
    catalogStatus=$taskQueue.catalog.status
    draftCheckCount=$taskQueue.catalog.draftCheckCount
    minimumCategoryTotal=$taskQueue.catalog.minimumCategoryTotal
    finalRatingStatus=$taskQueue.finalRating.status
    finalRatingAllowed=$taskQueue.finalRating.allowed
    availableDiskBytes=$taskDrive.AvailableFreeSpace
    diskGatePass=$taskDrive.AvailableFreeSpace -ge 20000000000
    planSha256=(Get-FileHash -LiteralPath $taskPlanPath -Algorithm SHA256).Hash
    queueSha256=(Get-FileHash -LiteralPath $taskQueuePath -Algorithm SHA256).Hash
    productImplementation='NOT-RUN'
    productTests='NOT-RUN'
    newLiteBundle='NOT-BUILT'
    independence='LOW'
}
$taskRecord | ConvertTo-Json -Depth 5 | Out-File -LiteralPath (Join-Path $PSScriptRoot 'planning-integrity.json') -Encoding utf8 -NoClobber
$taskRecord | ConvertTo-Json -Depth 5
if (-not $taskChecksPass) { exit 1 }

