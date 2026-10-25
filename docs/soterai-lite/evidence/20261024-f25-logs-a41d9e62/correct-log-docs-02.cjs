'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),old=require('./full-input-lib-01.cjs');assert.equal(old.check(),932);
const before=path.join(__dirname,'readme-correction-originals-02');fs.mkdirSync(before);
const manifest=JSON.parse(fs.readFileSync(path.join(repo,'packages/vscode-extension/package.json'),'utf8'));
const machine=Object.values(manifest.contributes.configuration.properties).filter(row=>row.scope==='machine').length;assert.equal(machine,81);
for(const file of ['packages/vscode-extension/README.md','packages/soterai-lite/README.md']){
 const target=path.join(repo,file);let text=fs.readFileSync(target,'utf8');fs.copyFileSync(target,path.join(before,file.replaceAll('/','__')),fs.constants.COPYFILE_EXCL);
 if(file.includes('vscode-extension')){assert.equal(text.split('The 80 safety-relevant settings are `machine`-scoped').length,2);text=text.replace('The 80 safety-relevant settings are `machine`-scoped','The '+machine+' safety-relevant settings are `machine`-scoped');}
 assert(text.includes('Structured inputs allow32 strings, depth32,10000 nodes and128 nonempty records.'));
 text=text.replace('Structured inputs allow32 strings, depth32,10000 nodes and128 nonempty records.','Structured inputs allow32 strings, depth32,10000 visited value/container nodes and128 nonempty records; property/key framing is validated separately within the raw-byte and depth caps.')
 .replace('64KiB each,1MiB total and60seconds including review.','64KiB each,1MiB unique raw-content admissions and60seconds including review. Failed decoding consumes the admission budget. Final guarded recapture rereads valid admitted files, so the cap does not describe total physical read I/O.');
 fs.writeFileSync(target,text);
}
let library=fs.readFileSync(path.join(__dirname,'full-input-lib-01.cjs'),'utf8');library=library.replace("'full-inputs-01.json'","'full-inputs-02.json'");
fs.writeFileSync(path.join(__dirname,'full-input-lib-02.cjs'),library,{flag:'wx'});const current=require('./full-input-lib-02.cjs');
const original=JSON.parse(fs.readFileSync(path.join(__dirname,'full-inputs-01.json'),'utf8')),records=current.inventory().map(current.fact);
assert.deepEqual(records.map(row=>row.path),original.records.map(row=>row.path));
const changed=records.filter((row,index)=>JSON.stringify(row)!==JSON.stringify(original.records[index])).map(row=>row.path);
assert.deepEqual(changed,['packages/soterai-lite/README.md','packages/vscode-extension/README.md']);
fs.writeFileSync(path.join(__dirname,'full-inputs-02.json'),JSON.stringify({...original,status:'CURRENT_DOC_CORRECTION_ONLY_FULL_RERUN_PENDING',records,changedFrom01:changed,observedAt:new Date().toISOString()},null,2),{flag:'wx'});
assert.equal(current.check(),932);
console.log(JSON.stringify({status:'README_COUNT_CORRECTED_DOCS_ONLY_FULL_RERUN_REQUIRED',machineSettings:machine,changed,files:records.length,productUnitBytesUnchanged:true}));
