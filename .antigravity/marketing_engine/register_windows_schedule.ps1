$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$PythonExe = (Get-Command python).Source
$ScriptPath = Join-Path $PSScriptRoot "daily_autopilot.py"

Write-Host "Project Root: $ProjectRoot"
Write-Host "Python Path:  $PythonExe"

# Create Morning 10:00 AM Task
$MorningCmd = "`"$PythonExe`" `"$ScriptPath`" --slot MORNING_10AM"
schtasks /Create /F /SC DAILY /TN "SoterAI_Autopilot_Morning_10AM" /TR $MorningCmd /ST 10:00

# Create Evening 07:00 PM (19:00) Task
$EveningCmd = "`"$PythonExe`" `"$ScriptPath`" --slot EVENING_7PM"
schtasks /Create /F /SC DAILY /TN "SoterAI_Autopilot_Evening_7PM" /TR $EveningCmd /ST 19:00

Write-Host ""
Write-Host "[OK] BOTH DAILY SCHEDULES REGISTERED IN WINDOWS TASK SCHEDULER!" -ForegroundColor Green
Write-Host "   - Morning Run: 10:00 AM Daily (SoterAI_Autopilot_Morning_10AM)"
Write-Host "   - Evening Run: 07:00 PM Daily (SoterAI_Autopilot_Evening_7PM)"
