'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const integrity=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence-integrity-01.json'),'utf8'));
assert.equal(integrity.status,'CURRENT_FROZEN_SOURCE_BYTES_EXACT');assert.equal(integrity.mismatches.length,0);
const mappings=[['run-full-gates-02.ps1','run-full-gates-03.ps1'],['run-full-entry-02.ps1','run-full-entry-03.ps1'],['start-durable-full-02.ps1','start-durable-full-03.ps1']];
for(const [before,after] of mappings){let text=fs.readFileSync(path.join(__dirname,before),'utf8');assert(!text.includes('\0'));
 text=text.replaceAll('check-full-inputs-01.cjs','check-full-inputs-03.cjs').replaceAll('run-full-gates-02.ps1','run-full-gates-03.ps1').replaceAll('run-full-entry-02.ps1','run-full-entry-03.ps1').replaceAll('durable-full-start-02.json','durable-full-start-03.json').replaceAll('durable-full-stdout-02.txt','durable-full-stdout-03.txt').replaceAll('durable-full-stderr-02.txt','durable-full-stderr-03.txt').replaceAll('full-gates-02.txt','full-gates-03.txt');
 fs.writeFileSync(path.join(__dirname,after),text,{flag:'wx'});
}
console.log(JSON.stringify({status:'PREPARED_DISTINCT_FULL03_ENTRY',sourceInputs:932,originalNulFilesRetained:true,cause:'UNESTABLISHED',signalsRequested:0}));
