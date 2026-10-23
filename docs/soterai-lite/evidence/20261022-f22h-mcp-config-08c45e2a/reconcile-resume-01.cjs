'use strict';
const e=require('./evidence-lib-01.cjs');
const input=e.read(e.own('source-inputs-04.json'));
const observed=[],mismatches=[];
for(const row of input.records){
 const file=e.path.join(e.repo,row.path);
 if(!e.fs.existsSync(file)){mismatches.push({expected:row,status:'MISSING'});continue;}
 const current=e.fact(file);observed.push(current);
 if(current.sha256!==row.sha256||current.bytes!==row.bytes)mismatches.push({expected:row,current,status:'CHANGED'});
}
const head=e.git('rev-parse','HEAD').toString('utf8').trim();
const branch=e.git('branch','--show-current').toString('utf8').trim();
const report={status:mismatches.length?'FROZEN_INPUT_DRIFT_NATIVE_NOT_STARTED':'PASS_EXACT_FROZEN_BYTES',observedAt:new Date().toISOString(),head,branch,expectedParent:input.parent,inputs:e.fact(e.own('source-inputs-04.json')),total:input.records.length,matched:input.records.length-mismatches.length,mismatches,observed,scope:'Read-only hashes of explicitly frozen source/runtime/test/config files only. No normal profile, secret scan, network, process signals or history changes. Existing commits preserved; old acceptance is not transferred to changed files.'};
e.write('resume-reconciliation-01.json',report);
console.log(JSON.stringify({status:report.status,head,branch,total:report.total,matched:report.matched,mismatches}));
