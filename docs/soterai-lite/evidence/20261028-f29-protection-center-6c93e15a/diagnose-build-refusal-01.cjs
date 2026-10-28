'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const proof=read(own('full-inputs-03.json')),old=read(own('native-driver-provenance-01.json')),issues=[];
for(const row of [...proof.files,...old.auxiliaryInputs]){const b=fs.readFileSync(path.join(repo,row.path));if(b.length!==row.bytes||sha(b)!==row.sha256)issues.push({path:row.path,expected:row.sha256,actual:sha(b),expectedBytes:row.bytes,actualBytes:b.length});}
for(const row of old.drivers){const b=fs.readFileSync(own(row.path));if(b.length!==row.bytes||sha(b)!==row.sha256)issues.push({driver:row.path});}
const value={status:'READ_ONLY_BUILD_REFUSAL_DIAGNOSTIC',observedAt:new Date().toISOString(),issues,sourceProofSha:sha(fs.readFileSync(own('full-inputs-03.json'))),provenanceSourceSha:old.sourceProofSha256,drivers:old.drivers.length,outExists:fs.existsSync(own('prebuilt-native-hosts-02')),canonical:read(own('native-fixture-typecheck-03.txt.result.json')),close:read(own('native-fixture-typecheck-03-owned-close.json'))};
fs.writeFileSync(own('build-refusal-diagnostic-01.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(value));
