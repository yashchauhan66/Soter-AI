// Fixture-only round1: retain03; allow tool-input latency and record cancellation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const own=n=>path.join(__dirname,n);
let ps=fs.readFileSync(own('probe-console-03.ps1'),'utf8').replaceAll('probe-v3','probe-v4').replaceAll('_03','_04');
assert.equal(ps.split('CancellationTokenSource]::new(45000)').length-1,1);ps=ps.replace('CancellationTokenSource]::new(45000)','CancellationTokenSource]::new(120000)');
const needle=" if($taskReadPublic -cne $taskPublic)";assert.equal(ps.split(needle).length-1,1);
const addition=" [IO.File]::WriteAllText((Join-Path $taskRoot 'read-observation.json'),(@{stage='public-return';returnedChars=$taskReadPublic.Length;cancellationRequested=$taskTimeout.IsCancellationRequested;observedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))\n";
ps=ps.replace(needle,()=>addition+needle);fs.writeFileSync(own('probe-console-04.ps1'),ps,{flag:'wx'});
let runner=fs.readFileSync(own('run-console-probe-03.cjs'),'utf8').replaceAll('-03','-04').replaceAll('probe-v3','probe-v4').replace('},65000);','},140000);').replace("['api-metadata.json','console-result.json']","['api-metadata.json','console-result.json','read-observation.json']");
fs.writeFileSync(own('run-console-probe-04.cjs'),runner,{flag:'wx'});console.log(JSON.stringify({status:'PREPARED_NOT_RUN',sameProductAndEightAssertions:true,previous03:'FAIL_RETAINED',reason:'Public ReadLine returned without any observed typed characters around45s cancellation deadline; tooling input latency inferred, new observation will distinguish cancellation',signalsRequested:0}));
