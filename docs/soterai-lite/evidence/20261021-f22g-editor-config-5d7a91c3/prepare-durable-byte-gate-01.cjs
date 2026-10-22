'use strict';
const h=require('./evidence-lib-01.cjs'),{fs,assert,own}=h;
const pending=[];
function put(a,b,fn){assert(!fs.existsSync(own(b)));pending.push({name:b,text:fn(fs.readFileSync(own(a),'utf8'))});}
function replace(s,a,b){assert.equal(s.split(a).length-1,1,'Seed mismatch '+a);return s.replace(a,b);}
put('prepare-acceptance-07.cjs','prepare-acceptance-08.cjs',s=>{
 s=replace(s,'const names=[','const names=["durable-final-exit-check-01",');
 const guard="const durable=read(own('durable-final-exit-01.json'));assert.equal(durable.status,'PASS_COMPLETION_RECEIPT_RUNNER_ABSENCE_AND_STABLE_STREAMS');assert.equal(durable.runnerAbsent,true);assert.equal(durable.innerFinalExitCode,0);assert.equal(durable.wrapperExitCodeObserved,null);assert.equal(durable.signalsRequested,0);for(const row of durable.streams){assert.equal(hash(own(row.path)),row.sha256);assert.equal(fs.statSync(own(row.path)).size,row.bytes);}\n";
 s=replace(s,'const inspection=',guard+'const inspection=');
 return replace(s,"hostVersion:'1.143.0',hostReview:","hostVersion:'1.143.0',durableRunner:fact(own('durable-final-exit-01.json')),hostReview:");
});
put('complete-byte-barriers-07.ps1','complete-byte-barriers-08.ps1',s=>{
 s=replace(s,"Invoke-Checked 'snapshot-execution-run-02'", "Invoke-Checked 'durable-final-exit-check-01' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'confirm-durable-final-exit-01.ps1'))\nInvoke-Checked 'snapshot-execution-run-02'");
 return replace(s,'prepare-acceptance-07.cjs','prepare-acceptance-08.cjs');
});
put('run-byte-entry-07.ps1','run-byte-entry-08.ps1',s=>replace(s,'complete-byte-barriers-07.ps1','complete-byte-barriers-08.ps1'));
put('verify-current-helpers-05.ps1','verify-current-helpers-06.ps1',s=>replace(s,'current-helper-validation-05.json','current-helper-validation-06.json'));
for(const row of pending)fs.writeFileSync(own(row.name),row.text,{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',files:pending.map(r=>r.name),productChanges:0}));
