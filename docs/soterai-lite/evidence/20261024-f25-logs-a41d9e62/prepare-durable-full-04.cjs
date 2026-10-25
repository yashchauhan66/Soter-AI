'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
assert.equal(require('./full-input-lib-02.cjs').check(),932);
for(const [before,after] of [['run-full-gates-03.ps1','run-full-gates-04.ps1'],['run-full-entry-03.ps1','run-full-entry-04.ps1'],['start-durable-full-03.ps1','start-durable-full-04.ps1']]){
 let text=fs.readFileSync(path.join(__dirname,before),'utf8');assert(!text.includes('\0'));
 text=text.replaceAll('check-full-inputs-03.cjs','check-full-inputs-04.cjs').replaceAll('run-full-gates-03.ps1','run-full-gates-04.ps1').replaceAll('run-full-entry-03.ps1','run-full-entry-04.ps1').replaceAll('durable-full-start-03.json','durable-full-start-04.json').replaceAll('durable-full-stdout-03.txt','durable-full-stdout-04.txt').replaceAll('durable-full-stderr-03.txt','durable-full-stderr-04.txt').replaceAll('full-gates-03.txt','full-gates-04.txt').replaceAll("'full-tests-02'","'full-tests-03'");
 if(before==='run-full-gates-03.ps1')text=text.replace(/Invoke-F25Gate 'raw-budget-tests-02'[^\r\n]+\r?\n/,'# raw-budget-tests02 passes with intact receipt on unchanged product/unit inputs.\n');
 if(before==='start-durable-full-03.ps1')text=text.replace("$taskExisting=@(","if(Get-Process -Id 15200 -ErrorAction SilentlyContinue){throw 'Previous owned wrapper is still observed; no duplicate.'}\n$taskExisting=@(");
 fs.writeFileSync(path.join(__dirname,after),text,{flag:'wx'});
}
console.log(JSON.stringify({status:'PREPARED_DOC_ONLY_FULL03_RETRY_SAME_CONCURRENCY1',reason:'free physical memory observed1276228KiB; no parallel heavyweight runs',signalsRequested:0}));
