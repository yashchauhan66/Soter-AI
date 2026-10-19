'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const file=path.resolve(__dirname,'../../../../packages/vscode-extension/src/__tests__/codexResponsesWire.test.ts'),before=fs.readFileSync(file),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.writeFileSync(path.join(__dirname,'codexResponsesWire-original-01.ts'),before,{flag:'wx'});
let text=before.toString('utf8');assert(text.includes('const {url}=await broker.start();'));
text=text.replace('const {url}=await broker.start();','// Fixture drain runs only after the broker has finished its decision. It cannot bypass its body reader or scan.\n (broker as any).server.on("request",(req:any,res:any)=>res.once("finish",()=>req.resume()));\n const {url}=await broker.start();');
text=text.replace('"content-type":"application/json","x-client-ignored"','"content-type":"application/json",connection:"close","x-client-ignored"');
fs.writeFileSync(file,text);
fs.writeFileSync(path.join(__dirname,'wire-fixture-review-01.json'),JSON.stringify({status:'FIXTURE_REVIEW_BEFORE_PRODUCTION_CHANGE',before:sha(before),after:sha(Buffer.from(text)),assertionsRemoved:0,originalRun:'responses-before-01 remains pending; no signals sent',reason:'Large rejected route returns before consuming the request. Test-only post-response drain plus explicit connection closure; production unchanged; rerun frozen wire assertions.'},null,2)+'\n',{flag:'wx'});
