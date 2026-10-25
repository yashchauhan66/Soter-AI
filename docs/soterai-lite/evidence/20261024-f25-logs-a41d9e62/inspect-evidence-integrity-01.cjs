'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const nulFiles=[];
for(const entry of fs.readdirSync(__dirname,{withFileTypes:true})){
 if(!entry.isFile())continue;const file=path.join(__dirname,entry.name),bytes=fs.readFileSync(file);
 if(bytes.length&&bytes.every(value=>value===0))nulFiles.push({name:entry.name,bytes:bytes.length,sha256:sha(bytes)});
}
const frozen=JSON.parse(fs.readFileSync(path.join(__dirname,'full-inputs-01.json'),'utf8'));
const mismatches=[];
for(const row of frozen.records){const bytes=fs.readFileSync(path.join(repo,row.path));if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)mismatches.push({path:row.path,expected:row.sha256,actual:sha(bytes)});}
const value={status:mismatches.length?'SOURCE_INPUT_DRIFT':'CURRENT_FROZEN_SOURCE_BYTES_EXACT',files:frozen.records.length,mismatches,nulFiles,cause:'UNESTABLISHED; no original bytes are reconstructed or regraded',observedAt:new Date().toISOString()};
fs.writeFileSync(path.join(__dirname,'evidence-integrity-01.json'),JSON.stringify(value,null,2),{flag:'wx'});console.log(JSON.stringify(value));
