const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),repo=path.resolve(__dirname,'../../../..');
const queue=path.join(repo,'docs/soterai-lite/FEATURE-QUEUE.json');fs.writeFileSync(queue,JSON.stringify(JSON.parse(fs.readFileSync(queue,'utf8')),null,2)+'\n');
const names=['docs/soterai-lite/evidence/20261017-f15a-json-4c82d1a7/design-01.md','packages/vscode-extension/src/__tests__/gatewayJsonDecoder.test.ts','packages/vscode-extension/src/__tests__/gatewayJsonWire.test.ts'];
const facts=names.map(n=>{const b=fs.readFileSync(path.join(repo,n));return {path:n,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
fs.writeFileSync(path.join(__dirname,'fixture-freeze-01.json'),JSON.stringify({status:'FROZEN_BEFORE_PRODUCTION',files:facts,observedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});console.log('F15a fixtures frozen; production unchanged.');
