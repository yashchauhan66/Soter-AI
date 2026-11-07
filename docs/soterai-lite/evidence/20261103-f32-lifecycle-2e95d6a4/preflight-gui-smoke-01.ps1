param([Parameter(Mandatory = $true)][string]$Receipt)
$ErrorActionPreference = 'Stop'
# Pre-flight only: proves the pinned Code.exe can start a window at all on this machine, in an isolated synthetic
# profile with updates disabled, then asks that one window to close gracefully (CloseMainWindow, no kill, no signals).
# It never touches the normal profile and loads no product extension. Writes one receipt under the evidence directory.
if (Test-Path -LiteralPath $Receipt) { throw 'Evidence overwrite refused' }
$code = 'C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
if ((Get-Process -Name Code -ErrorAction SilentlyContinue | Measure-Object).Count -ne 0) { throw 'A Code process is already running; refusing so no foreign window is touched.' }
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$root = "D:\SoterAI-Lite-test-profiles\f32-smoke-$stamp-" + ([guid]::NewGuid().ToString('N').Substring(0, 8))
$profile = Join-Path $root 'profile'; $ext = Join-Path $root 'extensions'; $ws = Join-Path $root 'workspace'
foreach ($d in @($root, $profile, (Join-Path $profile 'User'), $ext, $ws)) { New-Item -ItemType Directory -Path $d | Out-Null }
$settings = [ordered]@{ 'update.mode' = 'none'; 'telemetry.telemetryLevel' = 'off'; 'extensions.autoUpdate' = $false; 'extensions.autoCheckUpdates' = $false
    'workbench.enableExperiments' = $false; 'chat.disableAIFeatures' = $true; 'git.enabled' = $false; 'window.dialogStyle' = 'custom'
    'security.workspace.trust.startupPrompt' = 'always'; 'security.workspace.trust.emptyWindow' = $false }
[IO.File]::WriteAllText((Join-Path $profile 'User\settings.json'), ($settings | ConvertTo-Json) + "`n", [Text.UTF8Encoding]::new($false))
$args = @("--user-data-dir=$profile", "--extensions-dir=$ext", '--disable-updates', '--disable-gpu', '--new-window', '--skip-welcome', '--skip-release-notes',
    '--disable-extension=vscode.git', '--disable-extension=vscode.github', '--disable-extension=vscode.typescript-language-features', $ws)
$out = Join-Path $root 'code-stdout.txt'; $err = Join-Path $root 'code-stderr.txt'
$p = Start-Process -FilePath $code -ArgumentList $args -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
$sawWindow = $false; $deadline = [DateTime]::UtcNow.AddSeconds(40)
while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 500; $p.Refresh()
    if ($p.HasExited) { break }
    if ($p.MainWindowHandle -ne 0) { $sawWindow = $true; Start-Sleep -Seconds 4; break }
}
$exitedEarly = $p.HasExited; $earlyExit = if ($exitedEarly) { $p.ExitCode } else { $null }
if (-not $p.HasExited) { [void]$p.CloseMainWindow() }
$closed = $p.WaitForExit(40000)
$left = @(Get-Process -Name Code -ErrorAction SilentlyContinue).Count
$result = [ordered]@{ feature = 'F32'; status = if ($sawWindow -and $closed -and -not $exitedEarly -and $left -eq 0) { 'PASS_GUI_STARTS_AND_CLOSES_GRACEFULLY' } else { 'FAIL_GUI_PREFLIGHT' }
    observedAt = [DateTime]::UtcNow.ToString('o'); syntheticRoot = $root; codeSha256 = (Get-FileHash -LiteralPath $code -Algorithm SHA256).Hash.ToLowerInvariant()
    sawWindow = $sawWindow; exitedBeforeCloseRequest = $exitedEarly; earlyExitCode = $earlyExit; closedGracefully = $closed; exitCode = if ($closed) { $p.ExitCode } else { $null }
    remainingCodeProcesses = $left; stderrBytes = (Get-Item -LiteralPath $err).Length; stderrHead = ((Get-Content -LiteralPath $err -Raw) + '').Substring(0, [Math]::Min(600, ((Get-Content -LiteralPath $err -Raw) + '').Length))
    normalProfileTouched = $false; signalsRequested = 0 }
[IO.File]::WriteAllText($Receipt, ($result | ConvertTo-Json -Depth 5) + "`n", [Text.UTF8Encoding]::new($false))
$result | ConvertTo-Json -Depth 5
