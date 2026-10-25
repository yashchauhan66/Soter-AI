'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const prior=path.resolve(__dirname,'../20261023-f24-artifact-c3a5d91e');
let gates=fs.readFileSync(path.join(__dirname,'run-full-gates-01.ps1'),'utf8');
gates=gates.replace("'raw-budget-tests-01'","'raw-budget-tests-02'").replace("'full-tests-01'","'full-tests-02'");
const old="Invoke-F25Gate 'readiness-tests-01' @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/readiness-doc.test.ts')";
assert(gates.includes(old));gates=gates.replace(old,"# readiness-tests-01 has current intact raw/receipt and11PASS; frozen product/unit inputs are unchanged.");
fs.writeFileSync(path.join(__dirname,'run-full-gates-02.ps1'),gates,{flag:'wx'});
const entry=fs.readFileSync(path.join(prior,'run-serial-entry-01.ps1'),'utf8').replaceAll('run-serial-gates-01.ps1','run-full-gates-02.ps1').replaceAll('serial-gates-01.txt','full-gates-02.txt');
fs.writeFileSync(path.join(__dirname,'run-full-entry-02.ps1'),entry,{flag:'wx'});
let start=fs.readFileSync(path.join(prior,'start-durable-serial-01.ps1'),'utf8').replaceAll('durable-serial-start-01.json','durable-full-start-02.json').replaceAll('run-serial-entry-01.ps1','run-full-entry-02.ps1').replaceAll('durable-serial-stdout-01.txt','durable-full-stdout-02.txt').replaceAll('durable-serial-stderr-01.txt','durable-full-stderr-02.txt');
start=start.replace("$taskReceipt=",`$taskExisting=@(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='powershell.exe'" | Where-Object {
 $_.ProcessId -ne $PID -and $_.CommandLine -and ($_.CommandLine.Contains('run-full-gates-01.ps1') -or ($_.Name -eq 'node.exe' -and $_.CommandLine.Contains('--test-concurrency=1') -and $_.CommandLine.Contains('../vscode-extension/src/__tests__/**/*.test.ts')))
})
if($taskExisting.Count -ne 0){throw 'Prior full batch still observed; do not launch duplicate.'}
& node (Join-Path $PSScriptRoot 'check-full-inputs-01.cjs')
if($LASTEXITCODE -ne 0){throw 'Frozen full inputs drifted.'}
$taskReceipt=`);
fs.writeFileSync(path.join(__dirname,'start-durable-full-02.ps1'),start,{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_DURABLE_FULL02_NO_EXECUTION',preserved:'raw-budget-tests01 integrity failure/full01 uncaptured; do not regrade',signalsRequested:0}));
