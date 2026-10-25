'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),sha=raw=>crypto.createHash('sha256').update(raw).digest('hex'),base=path.relative(repo,__dirname).replaceAll('\\','/');
assert.equal(require('./full-input-lib-02.cjs').check(),932);
const materialized=JSON.parse(fs.readFileSync(path.join(__dirname,'native-materialization-01.json'),'utf8')),built=JSON.parse(fs.readFileSync(path.join(__dirname,'native-driver-provenance-01.json'),'utf8'));
assert.equal(materialized.files.length,28);assert.equal(built.drivers.length,20);
const directory=path.join(__dirname,'pre-native-execution-snapshots-01');fs.mkdirSync(directory);
const records=[];
for(const row of [...materialized.files,...built.drivers]){
 const original=path.join(__dirname,row.path),raw=fs.readFileSync(original);assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);
 const name=row.path.replaceAll('/','__').replaceAll('\\','__');fs.writeFileSync(path.join(directory,name),raw,{flag:'wx'});
 records.push({path:base+'/'+row.path,bytes:raw.length,sha256:sha(raw),snapshot:{path:base+'/pre-native-execution-snapshots-01/'+name,bytes:raw.length,sha256:sha(raw)}});
}
const frozen=JSON.parse(fs.readFileSync(path.join(__dirname,'native-source-inputs-01.json'),'utf8'));
for(const row of frozen.records){const raw=fs.readFileSync(path.join(repo,row.path));assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);}
const receipt={status:'PRE_NATIVE_EXACT_FIXTURE_SNAPSHOTS_NO_EXECUTION_CLAIM',records,sourceInputs:934,currentFullInputs:932,scope:'28 materialized PS helpers and20 compiled JS drivers byte-snapshotted before native launch. Actual execution and successful closure are separate future phase receipts.',observedAt:new Date().toISOString()};
fs.writeFileSync(path.join(__dirname,'pre-native-snapshots-01.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify({status:receipt.status,records:records.length}));
