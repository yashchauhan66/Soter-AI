"use strict";
// Docs-only successor authoring. No process/native/Git/test/build is launched.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../../.."), base = path.relative(root, __dirname).replaceAll("\\", "/");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const read = name => fs.readFileSync(path.join(__dirname, name));
const fact = name => { const value = read(name); return { path: base + "/" + name, bytes: value.length, sha256: sha(value) }; };
const materialized = JSON.parse(read("affected-native-materialization-01.json"));
assert.equal(materialized.status, "MATERIALIZED_NOT_EXECUTED");
const names = materialized.outputs.filter(item => path.posix.basename(item.path).startsWith("run-")).map(item => path.posix.basename(item.path));
assert.equal(names.length, 25);
const outputs = [], records = [], archive = "affected-pipe-before-02";
const helper = String.raw`# New F26a helper: retain actual process/read ownership on every uncertain exit.
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
`;
outputs.push({ name: "native-pipe-ownership-02.ps1", bytes: Buffer.from(helper) });
for (const name of names) {
    const source = materialized.outputs.find(item => path.posix.basename(item.path) === name), before = read(name);
    assert.equal(before.length, source.bytes); assert.equal(sha(before), source.sha256, "Materialized beforebytes changed.");
    let value = before.toString("utf8"), processCount = 0;
    const family = value.includes("}finally{$taskProcess.Dispose()}");
    if (family) {
        assert.equal(value.split("}finally{$taskProcess.Dispose()}").length - 1, 1);
        assert.equal(value.split("$taskProcess.StartInfo=$taskInfo").length - 1, 1);
        value = value.replace("$taskProcess.StartInfo=$taskInfo", "$taskProcess.StartInfo=$taskInfo;$taskOut=$null;$taskErr=$null");
        value = value.replace("}finally{$taskProcess.Dispose()}", "}finally{Complete-F26AOwnedProcess -OwnedProcess $taskProcess -StdoutTask $taskOut -StderrTask $taskErr -RecordPath (Join-Path $taskRun ($taskPhase+'-helper-pipe-ownership'))}");
        processCount++;
    } else if (["run-functional-01.ps1", "run-security-01.ps1"].includes(name)) {
        assert.equal(value.split("} finally { $process.Dispose() }").length - 1, 1);
        let starts = 0;
        value = value.replace(/\$process\.StartInfo\s*=\s*\$(?:info|startInfo)/g, matched => { starts++; return matched + ";$stdout=$null;$stderr=$null"; });
        assert.equal(starts, 1);
        value = value.replace("} finally { $process.Dispose() }", "} finally { Complete-F26AOwnedProcess -OwnedProcess $process -StdoutTask $stdout -StderrTask $stderr -RecordPath (Join-Path $runRoot 'helper-pipe-ownership') }");
        processCount++;
    }
    if (processCount) {
        assert.equal(value.split("Assert-F26AAffectedInputs").length - 1 >= 1, true);
        value = value.replace("Assert-F26AAffectedInputs", "Assert-F26AAffectedInputs\n. (Join-Path $PSScriptRoot 'native-pipe-ownership-02.ps1')");
    }
    // New aggregate copies point only at the corrected successor launchers.
    for (const original of names) value = value.replaceAll("'" + original + "'", "'" + original.replace(/-01[.]ps1$/, "-02.ps1") + "'");
    const beforeTimeouts = [...before.toString("utf8").matchAll(/(?:TotalSeconds -lt |WaitForExit\()([0-9]+)/g)].map(item => item[0]);
    const afterTimeouts = [...value.matchAll(/(?:TotalSeconds -lt |WaitForExit\()([0-9]+)/g)].map(item => item[0]);
    assert.deepEqual(afterTimeouts, beforeTimeouts, "No timeout or polling bound may change.");
    assert.equal(value.includes("$taskCount=if($taskPhase -eq 'primary'){21}else{4}"), before.toString("utf8").includes("$taskCount=if($taskPhase -eq 'primary'){21}else{4}"));
    const target = name.replace(/-01[.]ps1$/, "-02.ps1"), after = Buffer.from(value);
    outputs.push({ name: archive + "/" + name, bytes: before }, { name: target, bytes: after });
    records.push({ source: fact(name), beforeSnapshot: { path: base + "/" + archive + "/" + name, bytes: before.length, sha256: sha(before) },
        target: { path: base + "/" + target, bytes: after.length, sha256: sha(after) }, correctedOwnedProcessSites: processCount, timeoutExpressionsUnchanged: beforeTimeouts });
}
assert.equal(records.filter(item => item.correctedOwnedProcessSites === 1).length, 22);
assert.equal(records.filter(item => item.correctedOwnedProcessSites === 0).length, 3);
const result = { status: "PREPARED_CORRECTED_SUCCESSORS_NOT_EXECUTED", createdAt: new Date().toISOString(), generator: fact(path.basename(__filename)),
    priorMaterialization: fact("affected-native-materialization-01.json"), correction: "Unconditional finally disposal replaced by exact owned Process+read-task retention until actual exit and both successful EOF observations; failures remain failures.",
    correctedLaunchers: 22, aggregateRedirects: 3, helper: { path: base + "/native-pipe-ownership-02.ps1", bytes: outputs[0].bytes.length, sha256: sha(outputs[0].bytes) },
    records, nativeTestsBuildGit: "NOT_RUN", syntax: "SEPARATE_PARSE_REQUIRED", scope: "No count/timeout/artifact/runtime/driver/fixture change; no signals, cancellation or destruction; no old materialized file overwritten." };
outputs.push({ name: "affected-pipe-ownership-correction-02.json", bytes: Buffer.from(JSON.stringify(result, null, 2) + "\n") });
assert(!fs.existsSync(path.join(__dirname, archive)));
for (const item of outputs) assert(!fs.existsSync(path.join(__dirname, item.name)), "Existing successor evidence refused.");
fs.mkdirSync(path.join(__dirname, archive));
for (const item of outputs) fs.writeFileSync(path.join(__dirname, item.name), item.bytes, { flag: "wx" });
console.log(JSON.stringify({ status: result.status, launchers: 22, redirects: 3, receipt: fact("affected-pipe-ownership-correction-02.json") }));
