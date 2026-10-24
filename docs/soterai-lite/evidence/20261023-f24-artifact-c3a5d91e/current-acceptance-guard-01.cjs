'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),e=require('./scoped-git-lib-01.cjs'),inputs=require('./input-lib-01.cjs');
function check(){
 const frozen=e.read(e.base+'/source-inputs-02.json');assert.deepEqual(inputs.inventory(),frozen.records.map(row=>row.path));
 for(const row of frozen.records)assert.deepEqual(inputs.fact(row.path),row,'All current feature/full-suite inputs');
 const acceptance=e.read(e.base+'/f24-acceptance-01.json');assert.equal(acceptance.status,'PASS_SCOPED_REQUIRED_F24_GATES_BYTE_BARRIERS_PENDING');
 assert.equal(acceptance.bindingVerification.status,'PASS_EXACT_F24_ACCEPTANCE_BINDINGS');assert.equal(acceptance.bindingVerification.totals.successfulNativeChecks,383);
 const seen=new Set();
 function visit(value){
  if(!value||typeof value!=='object')return;
  if(typeof value.path==='string'&&Number.isSafeInteger(value.bytes)&&typeof value.sha256==='string'&&/^[a-f0-9]{64}$/.test(value.sha256)){
   const absolute=path.resolve(e.repo,value.path),relative=path.relative(e.repo,absolute),inside=relative&&!relative.startsWith('..')&&!path.isAbsolute(relative);
   assert(inside||absolute.toLowerCase().startsWith('d:\\soterai-lite-test-profiles\\f24-'),'Acceptance fact outside owned roots');
   if(!seen.has(absolute)){seen.add(absolute);const stat=fs.lstatSync(absolute);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1);assert.equal(fs.realpathSync(absolute).toLowerCase(),absolute.toLowerCase());const bytes=fs.readFileSync(absolute);assert.equal(bytes.length,value.bytes,value.path);assert.equal(e.sha(bytes),value.sha256,value.path);}
  }
  for(const child of Object.values(value))visit(child);
 }
 visit(acceptance);assert(seen.size>100,'Complete acceptance fact inventory required');
 return {inputs:frozen.records.length,evidenceFacts:seen.size};
}
module.exports={check};
