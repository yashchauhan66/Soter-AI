'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),prepared=path.resolve(__dirname,'../20261024-f25-logs-prepared-7a4b9d21'),snapshots=path.join(__dirname,'prepared-test-originals-01');fs.mkdirSync(snapshots);
for(const name of ['ManagedLogCollector','LogController','commands'])assert(!fs.existsSync(path.join(repo,'packages/vscode-extension/src/logs',name+'.ts')),'New component production remains absent before baseline.');
const records=[];
for(const name of ['logContent.test.ts','managedLogCollector.test.ts','logController.test.ts','logCommands.test.ts']){
 const bytes=fs.readFileSync(path.join(prepared,name)),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 if(name==='logContent.test.ts')assert.equal(sha256,'9b590e952b66424eab17e3a963bff6cd06511e3f73547a3fc31f49647a217fe4');
 if(name==='managedLogCollector.test.ts')assert.equal(sha256,'6b617d2ff814d99d666f44a7af3e4befbb6cd266aea8bed5416242bb61d41ef0');
 const target=path.join(repo,'packages/vscode-extension/src/__tests__',name);
 if(name!=='logContent.test.ts')fs.writeFileSync(target,bytes,{flag:'wx'});else assert(fs.readFileSync(target).equals(bytes));
 fs.writeFileSync(path.join(snapshots,name),bytes,{flag:'wx'});records.push({name,bytes:bytes.length,sha256,path:path.relative(repo,target).replaceAll('\\','/')});
}
fs.writeFileSync(path.join(__dirname,'prepared-test-freeze-01.json'),JSON.stringify({status:'EXACT_PREPARED_TEST_BYTES_BEFORE_COMPONENT_PRODUCTION',records,productionAbsent:['ManagedLogCollector','LogController','commands'],scope:'Parallel test authors were instructed to stop same-file changes; these exact snapshots and canonical copies define the baseline regardless of later proposals.'},null,2),{flag:'wx'});
console.log(JSON.stringify({status:'COPIED_COMPONENT_TESTS_BEFORE_PRODUCTION',records}));
