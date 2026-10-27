const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const own=n=>path.join(__dirname,n);
let ps=fs.readFileSync(own('probe-console-02.ps1'),'utf8');
const swap=(old,next)=>{assert.equal(ps.split(old).length-1,1);ps=ps.replace(old,()=>next)};
ps=ps.replaceAll('probe-v2','probe-v3').replaceAll('_02','_03');
swap("Set-PSReadLineOption -AddToHistoryHandler {param([string]$line) $line -cne 'soterai_token=FAKE_ONLY_F26C_SECRET_VALUE_97aa31'}",`Set-PSReadLineOption -AddToHistoryHandler {param([string]$line) if($line -ceq 'Write-Output memory_only_public_03'){return [Microsoft.PowerShell.AddToHistoryOption]::MemoryOnly}; return $true}
. (Join-Path $taskRoot 'generated-history.ps1')`);
ps=ps.replaceAll("soterai_token=FAKE_ONLY_F26C_SECRET_VALUE_97aa31","Write-Output ghp_A9b8C7d6E5f4G3h2I1j0K9l8M7n6O5p4");
swap(" $taskMemory=@([Microsoft.PowerShell.PSConsoleReadLine]::GetHistoryItems())",` Write-Host 'F26C_READY_MEMORY_ONLY_03'
 $taskReadMemory=[Microsoft.PowerShell.PSConsoleReadLine]::ReadLine($Host.Runspace,$ExecutionContext,$taskTimeout.Token)
 if($taskReadMemory -cne 'Write-Output memory_only_public_03'){throw 'Exact memory-only public fixture required.'}
 $taskMemory=@([Microsoft.PowerShell.PSConsoleReadLine]::GetHistoryItems())`);
swap("historyBytes=$taskStat.Length;commandsExecuted=0;", "memoryOnlyPresent=(@($taskMemory|Where-Object{$_.CommandLine -ceq 'Write-Output memory_only_public_03'}).Count -eq 1);memoryOnlyFileAbsent=(-not $taskHistory.Contains('Write-Output memory_only_public_03'));historyBytes=$taskStat.Length;commandsExecuted=0;");
swap("'publicReturned','secretReturned','publicMemoryPresent','secretMemoryAbsent','publicFilePresent','secretFileAbsent'", "'publicReturned','secretReturned','publicMemoryPresent','secretMemoryAbsent','publicFilePresent','secretFileAbsent','memoryOnlyPresent','memoryOnlyFileAbsent'");
ps=ps.replaceAll('ACTUAL_PUBLIC_READLINE_CONSOLE_MECHANISM_ONLY','ACTUAL_GENERATED_HISTORY_CALLBACK_PUBLIC_READLINE_PERSISTENCE_COMPONENT_ONLY');
fs.writeFileSync(own('probe-console-03.ps1'),ps,{flag:'wx'});
let runner=fs.readFileSync(own('run-console-probe-02.cjs'),'utf8').replaceAll('-02','-03').replaceAll('probe-v2','probe-v3');
const needle="const exe='C:";assert.equal(runner.split(needle).length-1,1);
const insert="const binding=read('generated-text-inputs-01.json');for(const pin of [...binding.sources,binding.output]){const raw=fs.readFileSync(path.join(repo,pin.path));assert.equal(raw.length,pin.bytes);assert.equal(sha(raw),pin.sha256);}fs.writeFileSync(path.join(profile,'generated-history.ps1'),fs.readFileSync(path.join(repo,binding.output.path)),{flag:'wx'});\n";
runner=runner.replace(needle,()=>insert+needle);fs.writeFileSync(own('run-console-probe-03.cjs'),runner,{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_NOT_RUN',files:['probe-console-03.ps1','run-console-probe-03.cjs'],checks:8,previousMechanismFixtureUnchanged:true}));
