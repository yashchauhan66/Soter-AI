# New F26a helper: retain actual process/read ownership on every uncertain exit.
# This function has no kill, cancellation, pipe destruction or second deadline.
function Complete-F26AOwnedProcess {
 param([Parameter(Mandatory=$true)][Diagnostics.Process]$OwnedProcess,[object]$StdoutTask,[object]$StderrTask,[Parameter(Mandatory=$true)][string]$RecordPath)
 $taskOwnedPid=$null
 try{$taskOwnedPid=$OwnedProcess.Id}catch{}
 if($null -eq $taskOwnedPid){$OwnedProcess.Dispose();return}
 $taskReaderFailure=$false;$taskMetadataFailure=$false
 if($null -eq $StdoutTask){try{$StdoutTask=$OwnedProcess.StandardOutput.ReadToEndAsync()}catch{$taskReaderFailure=$true}}
 if($null -eq $StderrTask){try{$StderrTask=$OwnedProcess.StandardError.ReadToEndAsync()}catch{$taskReaderFailure=$true}}
 function Write-F26APipeOwnership([string]$Suffix,[object]$Value){
  try{
   $taskPipeFile=$RecordPath+$Suffix
   $taskPipeRaw=[Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 8)+[Environment]::NewLine)
   $taskPipeStream=[IO.File]::Open($taskPipeFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
   try{$taskPipeStream.Write($taskPipeRaw,0,$taskPipeRaw.Length)}finally{$taskPipeStream.Dispose()}
  }catch{$script:taskF26PipeMetadataFailed=$true}
 }
 $script:taskF26PipeMetadataFailed=$false
 $taskHeld=$false;$taskPendingWritten=$false;$taskClosed=$false;$taskOutEOF=$false;$taskErrEOF=$false
 while($true){
  try{$taskClosed=$OwnedProcess.WaitForExit(1000)}catch{$taskClosed=$false}
  $taskOutEOF=$null -ne $StdoutTask -and $StdoutTask.IsCompleted -and -not $StdoutTask.IsFaulted -and -not $StdoutTask.IsCanceled
  $taskErrEOF=$null -ne $StderrTask -and $StderrTask.IsCompleted -and -not $StderrTask.IsFaulted -and -not $StderrTask.IsCanceled
  if($taskClosed -and $taskOutEOF -and $taskErrEOF){break}
  $taskHeld=$true
  if(-not $taskPendingWritten){
   $taskPendingWritten=$true
   Write-F26APipeOwnership '-pending.json' @{schemaVersion=1;status='STOP_UNCONFIRMED_OWNERSHIP_RETAINED';pid=$taskOwnedPid;observedExit=$taskClosed;stdoutEOF=$taskOutEOF;stderrEOF=$taskErrEOF;signalsRequested=0;readerSetupFailure=$taskReaderFailure;time=[DateTime]::UtcNow.ToString('o');scope='No later phase or helper exit while actual close and both EOF remain unconfirmed; no signal, reader cancellation, destruction or disposal.'}
  }
  # WaitForExit returns immediately once the process is gone but inherited
  # writers can still own a pipe. Keep readers/process alive without spinning.
  if($taskClosed){Start-Sleep -Milliseconds 50}
 }
 $taskActualExit=$OwnedProcess.ExitCode
 $taskLateStreams=@()
 if($taskHeld){
  foreach($taskChannel in @('stdout','stderr')){
   try{
    $taskReadTask=if($taskChannel -ceq 'stdout'){$StdoutTask}else{$StderrTask}
    $taskLateText=$taskReadTask.GetAwaiter().GetResult();$taskLateBytes=[Text.UTF8Encoding]::new($false).GetBytes($taskLateText)
    $taskLatePath=$RecordPath+'-actual-'+$taskChannel+'.txt'
    $taskLateStream=[IO.File]::Open($taskLatePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try{$taskLateStream.Write($taskLateBytes,0,$taskLateBytes.Length)}finally{$taskLateStream.Dispose()}
    $taskLateStreams+=@{channel=$taskChannel;path=$taskLatePath;bytes=$taskLateBytes.Length;sha256=(Get-FileHash -LiteralPath $taskLatePath -Algorithm SHA256).Hash.ToLowerInvariant()}
   }catch{$script:taskF26PipeMetadataFailed=$true}
  }
 }
 Write-F26APipeOwnership '.json' @{schemaVersion=1;status='ACTUAL_CLOSE_AND_BOTH_EOF_BEFORE_DISPOSE';pid=$taskOwnedPid;observedExit=$true;exitCode=$taskActualExit;stdoutEOF=$true;stderrEOF=$true;signalsRequested=0;ownershipHeldAfterUncertainty=$taskHeld;readerSetupFailure=$taskReaderFailure;lateStreams=$taskLateStreams;time=[DateTime]::UtcNow.ToString('o');scope='Closure observation only; prior timeout/assertion failure is retained and is never regraded PASS.'}
 $taskMetadataFailure=$script:taskF26PipeMetadataFailed
 # Dispose is reachable only after actual exit and successful EOF tasks.
 $OwnedProcess.Dispose()
 if($taskMetadataFailure -or $taskReaderFailure){throw 'INCOMPLETE: pipe ownership metadata/reader setup failed; no acceptance.'}
}
