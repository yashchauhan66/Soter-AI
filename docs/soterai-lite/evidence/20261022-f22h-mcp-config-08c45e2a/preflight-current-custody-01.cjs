'use strict';
const e=require('./evidence-lib-01.cjs');
e.assert.equal(e.git('rev-parse','HEAD').toString('utf8').trim(),'bcb65d52ae2f63e74a0a5f77edfc583632ddcb57');
e.assert.equal(e.git('branch','--show-current').toString('utf8').trim(),'soterai-lite-f22h-resume-20261023');
e.assert.deepEqual(e.lines(e.git('diff','--cached','--name-only')),[]);
const old=e.read(e.own('source-inputs-04.json')),current=e.read(e.own('source-inputs-05.json')),changed=[];
for(let i=0;i<current.records.length;i++){const row=current.records[i],previous=old.records[i];e.assert.equal(row.path,previous.path);e.current(row);if(row.sha256!==previous.sha256||row.bytes!==previous.bytes)changed.push({before:previous,after:row});}
e.assert.equal(current.records.length,664);e.assert.deepEqual(changed.map(row=>row.after.path),['packages/vscode-extension/src/__tests__/host/liteMcpScanner.host.ts']);
e.assert.equal(e.hash(e.path.join(e.repo,'docs/soterai-lite/LITE-CATALOG.json')),'1ce46192e9f315b5f2142c9f61542f1d513143dc2e19d4def6d95cea38c73ed4');
e.assert.equal(e.hash(e.path.join(e.repo,'docs/soterai-lite/MASTER-PROMPT-20261016.txt')),'2ea0c90b1fe3bdd591e5ae24470dcd8804abfff7a75741ec1f5a1aae7e4679ae');
const catalogBlob=e.git('show','HEAD:docs/soterai-lite/LITE-CATALOG.json');e.assert.deepEqual(JSON.parse(catalogBlob.toString('utf8')),e.read(e.path.join(e.repo,'docs/soterai-lite/LITE-CATALOG.json')));
const report={status:'PASS_CURRENT_CUSTODY_PREFLIGHT_NOT_FEATURE_ACCEPTANCE',inputs:664,changed,unitTestChanges:0,applicationRuntimeChanges:0,catalogDataChanges:0,indexEmpty:true,branch:'soterai-lite-f22h-resume-20261023',head:'bcb65d52ae2f63e74a0a5f77edfc583632ddcb57',currentInputs:e.fact(e.own('source-inputs-05.json')),scope:'Explicitly frozen bytes only. One native fixture cleanup command is the sole post-full input change, with fresh compiler and actual native coverage. Frozen catalog/master exact hashes retain original definitions/request; current HEAD catalog has equal JSON data. No staging or actual feature acceptance.'};
e.write('current-custody-preflight-01.json',report);console.log(JSON.stringify({status:report.status,inputs:664,changed:1,catalogDataChanges:0}));
