$ErrorActionPreference='Stop'
$taskNode='C:\Program Files\nodejs\node.exe'
if ((Get-FileHash -LiteralPath $taskNode -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'c5ff4c736112dd483c750fd4149d30c8a116db1a49b8b3ec88be4b65e6c86c19') { throw 'Pinned Node changed' }
$taskPipeHelper=Join-Path (Split-Path -Parent $PSScriptRoot) 'affected-preparation-pipe-ownership-01.ps1'
if ((Get-FileHash -LiteralPath $taskPipeHelper -Algorithm SHA256).Hash.ToLowerInvariant() -cne '246b0ccdb2457fd80f560770b129a1fde67d5d4212e8eae200f965dffd69698c') { throw 'Owned pipe helper changed' }
. $taskPipeHelper
$taskInfo=[Diagnostics.ProcessStartInfo]::new()
$taskInfo.FileName=$taskNode
$taskArgs=@((Join-Path $PSScriptRoot 'codexcli-route-current-02.cjs'),'--validate-prepared',(Join-Path $PSScriptRoot 'codexcli-admission-02.json'),'130b9ee2694ecbef00e9e075f8813ae27dc1bbbb717d5e01f1b68903807fa97e')
$taskInfo.Arguments=($taskArgs | ForEach-Object { if ($_ -match '["\r\n]') { throw 'Unsafe argument' }; '"'+$_+'"' }) -join ' '
$taskInfo.WorkingDirectory=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../../..'))
$taskInfo.UseShellExecute=$false
$taskInfo.CreateNoWindow=$true
$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
$taskInfo.RedirectStandardOutput=$true
$taskInfo.RedirectStandardError=$true
$taskProcess=[Diagnostics.Process]::new()
$taskProcess.StartInfo=$taskInfo
$taskOut=$null
$taskErr=$null
$taskTimedOut=$false
$taskPrefix=Join-Path $PSScriptRoot 'codexcli-owned-admission-control-04'
try {
 [void]$taskProcess.Start()
 $taskOut=$taskProcess.StandardOutput.ReadToEndAsync()
 $taskErr=$taskProcess.StandardError.ReadToEndAsync()
 $taskTimedOut=-not $taskProcess.WaitForExit(60000)
} finally {
 Complete-F26AOwnedProcess -OwnedProcess $taskProcess -StdoutTask $taskOut -StderrTask $taskErr -RecordPath $taskPrefix
}
$taskClose=Get-Content -LiteralPath ($taskPrefix+'.json') -Raw | ConvertFrom-Json
$taskStdout=$taskOut.GetAwaiter().GetResult()
$taskStderr=$taskErr.GetAwaiter().GetResult()
$taskExact=$taskStdout.Trim() -ceq 'PASS_READ_ONLY_ADMISSION_NATIVE_NOT_RUN'
@{status='READ_ONLY_EXPLICIT_NODE_OWNER_CONTROL';exitCode=$taskClose.exitCode;actualClose=$taskClose.observedExit;stdoutEOF=$taskClose.stdoutEOF;stderrEOF=$taskClose.stderrEOF;exactAdmissionMarker=$taskExact;stderrCharacters=$taskStderr.Length;timedOut=$taskTimedOut;nativeCodeLaunches=0;vendorClientLaunches=0;signalsRequested=0} | ConvertTo-Json
if ($taskTimedOut -or $taskClose.exitCode -ne 0 -or -not $taskExact -or $taskStderr.Length -ne 0) { throw 'Read-only explicit admission control failed' }
