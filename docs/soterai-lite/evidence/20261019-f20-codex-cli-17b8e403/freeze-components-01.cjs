'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..');
const files=['packages/vscode-extension/src/__tests__/codexCliAdapterPolicy.test.ts','packages/vscode-extension/src/__tests__/codexHttpBridge.test.ts'].map(file=>{const b=fs.readFileSync(path.join(repo,file));return {path:file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
for(const file of['CodexCliAdapterPolicy.ts','CodexHttpBridge.ts'])assert.equal(fs.existsSync(path.join(repo,'packages/vscode-extension/src/adapters',file)),false);
const counts={policy:21,httpBridge:7,expectedTotal:28};
fs.writeFileSync(path.join(__dirname,'components-freeze-01.json'),JSON.stringify({status:'FROZEN_BEFORE_IMPLEMENTATION',files,counts,time:new Date().toISOString(),nativeProbe05:'Actual native MCP call and masked provider result observed; no product acceptance yet. Probe03 only discovery, not tools/call; probe04 correctly fails required MCP call because vendor approval never; probe02 rejects stale documented image config.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'FROZEN_BEFORE_IMPLEMENTATION',counts}));
