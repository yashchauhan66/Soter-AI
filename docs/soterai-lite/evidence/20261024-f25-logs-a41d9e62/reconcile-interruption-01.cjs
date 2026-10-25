'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const records=[];
for(const name of ['raw-budget-tests-01','readiness-tests-01','full-tests-01','backend-typecheck-01','backend-tests-01','package-01']){
 const file=path.join(__dirname,name+'.txt'),receipt=file+'.result.json';
 if(!fs.existsSync(file)){records.push({name,status:'RAW_NOT_PRESENT_NO_RESULT_CLAIM',receiptPresent:fs.existsSync(receipt)});continue;}
 const raw=fs.readFileSync(file),sha256=crypto.createHash('sha256').update(raw).digest('hex');
 const row={name,bytes:raw.length,sha256,nulBytes:raw.filter(value=>value===0).length,receiptPresent:fs.existsSync(receipt)};
 if(fs.existsSync(receipt)){try{const result=JSON.parse(fs.readFileSync(receipt,'utf8').replace(/^\uFEFF/,''));row.exitCode=result.exitCode;row.rawHashMatches=sha256===result.sha256.toLowerCase();row.observedAt=result.observedAt;}catch{row.receiptMalformed=true;}}
 row.status=row.rawHashMatches&&row.nulBytes===0?'RECEIPT_AND_RAW_INTEGRITY_PASS':'INCOMPLETE_EVIDENCE_INTEGRITY_NOT_PASS';records.push(row);
}
let inputs;try{inputs={status:'EXACT_INPUTS_PASS',files:require('./full-input-lib-01.cjs').check()};}catch(error){inputs={status:'INPUT_CHECK_FAILED',error:String(error).slice(0,400)};}
const value={status:'READ_ONLY_INTERRUPTED_BATCH_RECONCILIATION',records,inputs,observedAt:new Date().toISOString()};
fs.writeFileSync(path.join(__dirname,'interruption-reconciliation-01.json'),JSON.stringify(value,null,2),{flag:'wx'});console.log(JSON.stringify(value));
