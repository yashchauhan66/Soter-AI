Set-Location "c:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard"
gh run view 34020751361 --repo yashchauhan66/Soter-AI --json jobs > ci-jobs.json
$jobs = (Get-Content ci-jobs.json | ConvertFrom-Json).jobs
foreach ($j in $jobs) {
  "$($j.name) => status=$($j.status) concl=$($j.conclusion)"
  $active = $j.steps | Where-Object { $_.status -eq "in_progress" }
  if ($active) { $active | ForEach-Object { "    RUNNING: $($_.name)" } }
}