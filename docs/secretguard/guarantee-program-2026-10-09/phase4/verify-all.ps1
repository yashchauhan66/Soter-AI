<# User-owned verification wrapper. Default: checks and compile only. -RunHost requires closed VS Code.
Existing harness observations are not independent G1-G6 security grading. No normal profile is used.
#>
param(
    [switch]$RunHost,
    [string]$CodePath,
    [ValidateSet('Both','SecurityReview','NativeBaseline')][string]$HostHarness='Both',
    [string]$OutputRoot,
    [switch]$DisableUniqueEvidence
)
$ErrorActionPreference='Stop'
$wrapperSourceSha256=(Get-FileHash -LiteralPath $PSCommandPath).Hash.ToLowerInvariant()
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
if ($DisableUniqueEvidence) { throw 'Unique recording disabled; verification unavailable.' }
if (!$OutputRoot) { $OutputRoot=Join-Path $PSScriptRoot 'evidence/user-verification' }
$OutputRoot=[IO.Path]::GetFullPath($OutputRoot)
if (!$OutputRoot.StartsWith($repoRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Output must remain inside this repository.' }
$cursor=$OutputRoot
while ($cursor -and $cursor.Length -gt $repoRoot.Length) {
    if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Linked output directory refused.' }
    $cursor=Split-Path -Parent $cursor
}
if ($RunHost) {
    if (!$CodePath -or !(Test-Path -LiteralPath $CodePath -PathType Leaf)) { throw 'Provide an existing isolated test Code.exe via -CodePath.' }
    $CodePath=[IO.Path]::GetFullPath($CodePath)
    if (Get-Process -Name Code -ErrorAction SilentlyContinue) { throw 'Close VS Code first. This wrapper never closes another process or uses its profile.' }
}
$runId='verify-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N')
$runRoot=Join-Path $OutputRoot $runId
if (Test-Path -LiteralPath $runRoot) { throw 'Output exists; refusing overwrite.' }
[void][IO.Directory]::CreateDirectory($runRoot)
function Write-NewText([string]$file,[string]$value) {
    $stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $bytes=[Text.UTF8Encoding]::new($false).GetBytes($value);$stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
}
$oldTemp=$env:TEMP;$oldTmp=$env:TMP;$oldResults=$env:SOTERAI_TEST_RESULTS_DIR;$oldNonce=$env:SOTERAI_P2_NONCE;$oldGoWorkers=$env:GOMAXPROCS
$scratchParent=Join-Path $repoRoot '.tmp'
if ((Test-Path -LiteralPath $scratchParent) -and ((Get-Item -LiteralPath $scratchParent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Linked scratch directory refused.' }
$scratchRoot=Join-Path $scratchParent ('sgv-'+[Guid]::NewGuid().ToString('N').Substring(0,12))
if (Test-Path -LiteralPath $scratchRoot) { throw 'Scratch output exists; refusing reuse.' }
$results=@();$harnesses=@();$failures=@()
function Invoke-Recorded([string]$name,[string]$executable,[string[]]$arguments,[string]$workingDirectory) {
    $previousPreference=$ErrorActionPreference
    try {
        $ErrorActionPreference='Continue'
        if ($workingDirectory) { Push-Location $workingDirectory }
        try {
            $global:LASTEXITCODE=$null
            $output=@(& $executable @arguments 2>&1)
            $exitCode=if ($null -eq $global:LASTEXITCODE) {127} else {$global:LASTEXITCODE}
        }
        finally { if ($workingDirectory) { Pop-Location } }
    } finally { $ErrorActionPreference=$previousPreference }
    Write-NewText (Join-Path $runRoot ($name+'.log')) (($output | ForEach-Object { $_.ToString() }) -join "`r`n")
    $script:results += @{name=$name;exitCode=$exitCode;scope='command result only'}
    return $exitCode
}
try {
    # Keep existing Git fixtures below Windows path limits without using the user's Temp.
    [void][IO.Directory]::CreateDirectory($scratchRoot)
    $env:TEMP=$scratchRoot;$env:TMP=$scratchRoot;$env:GOMAXPROCS='2'
    $env:SOTERAI_TEST_RESULTS_DIR=Join-Path $runRoot 'diagnostic-results';$env:SOTERAI_P2_NONCE='synthetic-'+$runId
    Push-Location $repoRoot
    try {
        foreach ($package in @('apps/local-ai-broker','packages/vscode-extension')) {
            $prefix=if ($package -like 'apps/*') {'broker'} else {'extension'}
            foreach ($task in @('typecheck','build','test')) {
                if ($task -eq 'test') {
                    # Same existing suite, two file workers: avoid the observed default-concurrency memory failures.
                    $code=Invoke-Recorded ($prefix+'-'+$task) 'node.exe' @('--import','tsx','--test','--test-concurrency=2','src/__tests__/**/*.test.ts') (Join-Path $repoRoot $package)
                } else { $code=Invoke-Recorded ($prefix+'-'+$task) 'npm.cmd' @('--prefix',$package,'run',$task) }
                if ($code -ne 0) { throw "Check failed: $prefix-$task. Raw evidence retained; no host run." }
            }
        }
        foreach ($item in @(
            @{name='security-review';source='packages/vscode-extension/src/__tests__/host/securityReview.host.ts'},
            @{name='native-baseline';source='docs/secretguard/guarantee-program-2026-10-09/phase1/native-host/native-baseline.host.ts'}
        )) {
            $compiled=Join-Path $runRoot ($item.name+'.js')
            if ((Invoke-Recorded ($item.name+'-compile') 'node.exe' @('node_modules/esbuild/bin/esbuild',$item.source,'--bundle','--platform=node','--external:vscode',"--outfile=$compiled")) -ne 0) { throw 'Existing harness compile failed.' }
            $harnesses += @{name=$item.name;status='PREPARED_NOT_RUN';sha256=(Get-FileHash -LiteralPath $compiled).Hash.ToLowerInvariant();hashScope='prepared compile, not a launch observation'}
        }
        if ($RunHost -and $HostHarness -in @('Both','SecurityReview')) {
            $hostOutput=Join-Path $runRoot 'security-review-runs'
            if ((Invoke-Recorded 'security-review-user-host' 'powershell.exe' @('-NoProfile','-File',(Join-Path $repoRoot 'packages/vscode-extension/scripts/run-security-review-host.ps1'),'-CodePath',$CodePath,'-OutputRoot',$hostOutput)) -ne 0) { $failures+='SecurityReview host command failed; inspect raw results.' }
            ($harnesses | Where-Object { $_.name -eq 'security-review' }).status='USER_HOST_ATTEMPTED_RESULTS_REQUIRED'
            $launchFiles=@(Get-ChildItem -LiteralPath $hostOutput -Filter 'launch.json' -File -Recurse -ErrorAction SilentlyContinue)
            if ($launchFiles.Count -eq 1) {
                $launch=Get-Content -LiteralPath $launchFiles[0].FullName -Raw | ConvertFrom-Json
                $entry=$harnesses | Where-Object { $_.name -eq 'security-review' }
                $entry.launchRecord=$launchFiles[0].FullName;$entry.launchedHarnessSha256=$launch.hostProbeSha256;$entry.preparedExtensionSha256=$launch.extensionBundleSha256
            } else { $failures+='SecurityReview launch identity unavailable; no matching-launch claim.' }
        }
        if ($RunHost -and $HostHarness -in @('Both','NativeBaseline')) {
            # Existing preparer freezes rebuilt bundles and creates synthetic inputs; no new scenario.
            $nativeOutput=Join-Path $runRoot 'native-baseline-runs'
            [void][IO.Directory]::CreateDirectory($nativeOutput)
            $prepScript=Join-Path $repoRoot 'docs/secretguard/guarantee-program-2026-10-09/phase1/native-host/prepare-host.mjs'
            if ((Invoke-Recorded 'native-prepare' 'node.exe' @($prepScript,'--output-root',$nativeOutput)) -ne 0) { throw 'Existing native preparation failed.' }
            $nativeRun=(Get-Content -LiteralPath (Join-Path $runRoot 'native-prepare.log') -Raw | ConvertFrom-Json).run
            if (!$nativeRun) { throw 'Native preparation returned no run directory.' }
            $nativeRun=[IO.Path]::GetFullPath($nativeRun)
            if (!$nativeRun.StartsWith($nativeOutput+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Native run escaped its owned output.' }
            $nativeCursor=$nativeRun
            while ($nativeCursor.Length -gt $repoRoot.Length) {
                if ((Get-Item -LiteralPath $nativeCursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked native run refused.' }
                $nativeCursor=Split-Path -Parent $nativeCursor
            }
            $nativeBundle=Join-Path $nativeRun 'native-baseline.js'
            if ((Invoke-Recorded 'native-frozen-compile' 'node.exe' @('node_modules/esbuild/bin/esbuild','docs/secretguard/guarantee-program-2026-10-09/phase1/native-host/native-baseline.host.ts','--bundle','--platform=node','--external:vscode',"--outfile=$nativeBundle")) -ne 0) { throw 'Existing native compile failed.' }
            $workspace=Join-Path $nativeRun 'workspace';$profile=Join-Path $nativeRun 'profile'
            $settings=@{'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.openAIProviderUrl'='';'soterai.broker.anthropicProviderUrl'=''}
            Write-NewText (Join-Path $profile 'User/settings.json') ($settings|ConvertTo-Json)
            $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=[IO.Path]::GetFullPath($CodePath)
            $launchArgs=@("--extensionDevelopmentPath=$(Join-Path $nativeRun 'snapshot')","--extensionTestsPath=$nativeBundle","--user-data-dir=$profile","--extensions-dir=$(Join-Path $nativeRun 'extensions')",'--disable-extensions','--disable-workspace-trust','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes',$workspace)
            $start.Arguments=(($launchArgs | ForEach-Object { if ($_ -match '"') { throw 'Invalid launch argument.' };'"'+$_+'"' }) -join ' ')
            $start.WorkingDirectory=$workspace;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
            $start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.EnvironmentVariables.Clear()
            foreach ($name in @('SystemRoot','WINDIR','TEMP','TMP','COMSPEC')) { $value=[Environment]::GetEnvironmentVariable($name);if($value){$start.EnvironmentVariables[$name]=$value} }
            $start.EnvironmentVariables['USERPROFILE']=$profile;$start.EnvironmentVariables['APPDATA']=Join-Path $profile 'AppData/Roaming';$start.EnvironmentVariables['LOCALAPPDATA']=Join-Path $profile 'AppData/Local'
            $start.EnvironmentVariables['SOTERAI_PHASE1_RUN']=$nativeRun
            $git=Get-Command git.exe -ErrorAction SilentlyContinue;if($git){$start.EnvironmentVariables['SOTERAI_PHASE1_GIT']=$git.Source}
            $nativeLaunch=Join-Path $nativeRun 'user-launch.json'
            $nativeLaunchHash=(Get-FileHash -LiteralPath $nativeBundle).Hash.ToLowerInvariant()
            Write-NewText $nativeLaunch (@{status='PREPARED_NOT_RUN';runId=$runId;codeSha256=(Get-FileHash -LiteralPath $CodePath).Hash.ToLowerInvariant();harnessSha256=$nativeLaunchHash;syntheticOnly=$true;normalProfile=$false}|ConvertTo-Json)
            $process=[Diagnostics.Process]::new();$process.StartInfo=$start
            try {
                [void]$process.Start();$stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
                if (!$process.WaitForExit(60000)) { $process.Kill();$failures+='NativeBaseline host timeout; no PASS.' }
                [void]$process.WaitForExit(5000)
                $stdoutText=if($stdout.IsCompleted){$stdout.GetAwaiter().GetResult()}else{'INCOMPLETE: stdout drain did not finish.'}
                $stderrText=if($stderr.IsCompleted){$stderr.GetAwaiter().GetResult()}else{'INCOMPLETE: stderr drain did not finish.'}
                Write-NewText (Join-Path $nativeRun 'stdout.txt') $stdoutText
                Write-NewText (Join-Path $nativeRun 'stderr.txt') $stderrText
                $exitCode=if($process.HasExited){$process.ExitCode}else{-1}
                $results+=@{name='native-user-host';exitCode=$exitCode;scope='harness only; inspect findings'}
                ($harnesses | Where-Object { $_.name -eq 'native-baseline' }).status='USER_HOST_ATTEMPTED_RESULTS_REQUIRED'
                $entry=$harnesses | Where-Object { $_.name -eq 'native-baseline' };$entry.launchRecord=$nativeLaunch;$entry.launchedHarnessSha256=$nativeLaunchHash
                if ($exitCode -ne 0) { $failures+='NativeBaseline host failed; inspect retained findings.' }
            } finally { $process.Dispose() }
        }
    } finally { Pop-Location }
} catch { $failures+=$_.Exception.Message }
finally {
    $env:TEMP=$oldTemp;$env:TMP=$oldTmp;$env:SOTERAI_TEST_RESULTS_DIR=$oldResults;$env:SOTERAI_P2_NONCE=$oldNonce;$env:GOMAXPROCS=$oldGoWorkers
    $diagnosticFindings=@()
    $diagnosticFile=Join-Path $runRoot 'diagnostic-results/results.jsonl'
    if(Test-Path -LiteralPath $diagnosticFile) {
        try { $diagnosticFindings=@(Get-Content -LiteralPath $diagnosticFile | ForEach-Object { $_|ConvertFrom-Json } | Where-Object { $_.status -in @('FAIL','SKIP','ERROR') } | ForEach-Object { @{id=$_.id;status=$_.status} }) }
        catch { $failures+='Diagnostic parsing INCOMPLETE: '+$_.Exception.Message }
    }
    $summary=@{schemaVersion=1;runId=$runId;atUtc=[DateTime]::UtcNow.ToString('o');wrapperSha256=$wrapperSourceSha256;scratchPath=$scratchRoot;fileWorkers=2;runHostRequested=[bool]$RunHost;commands=$results;harnesses=$harnesses;failures=$failures;diagnosticFindings=$diagnosticFindings;architecture='UNTESTED';independentVerification='NOT_PERFORMED';sameUserAuthority='OUTSIDE_COVERAGE';limitation='Command success is not confidentiality success. Read observation files; preserve failures.'}
    Write-NewText (Join-Path $runRoot 'summary.json') ($summary|ConvertTo-Json -Depth 10)
    $hashes=@(Get-ChildItem -LiteralPath $runRoot -Recurse -File | Where-Object { $_.FullName -notmatch '[\\/]tmp[\\/]' } | ForEach-Object { (Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()+'  '+$_.FullName.Substring($runRoot.Length+1).Replace('\','/') })
    foreach($bundle in @('extension.js','local-ai-broker.js','soterai-mcp-server.js')) { $p=Join-Path $repoRoot ('packages/vscode-extension/dist/'+$bundle);if(Test-Path -LiteralPath $p){$hashes+=(Get-FileHash -LiteralPath $p).Hash.ToLowerInvariant()+'  loaded-candidate/'+$bundle} }
    Write-NewText (Join-Path $runRoot 'SHA256SUMS.txt') ($hashes -join "`r`n")
    Write-Output ('Evidence: '+$runRoot);Write-Output ('Architecture: UNTESTED; independent verification NOT_PERFORMED.');$hashes
}
if ($failures.Count) { exit 1 }
exit 0
