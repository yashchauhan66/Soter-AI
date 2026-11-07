'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..');assert(!fs.existsSync(path.join(repo,'packages/vscode-extension/src/history-hooks/PreCommitWire.ts')));
const files=['packages/vscode-extension/src/__tests__/preCommitWire.test.ts',...['design-02-owner-route.md','design-02-review-addendum.md'].map(n=>path.relative(repo,path.join(__dirname,n)).replaceAll('\\','/'))];
const records=files.map(file=>{const b=fs.readFileSync(path.join(repo,file));return {path:file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}});
const count=[...fs.readFileSync(path.join(repo,files[0]),'utf8').matchAll(/^test\(/gm)].length;assert.equal(count,19);
fs.writeFileSync(path.join(__dirname,'wire-test-first-freeze-01.json'),JSON.stringify({status:'FROZEN_TEST_FIRST_NO_WIRE_PRODUCTION',tests:count,records,time:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'FROZEN_TEST_FIRST_NO_WIRE_PRODUCTION',tests:count,records}));
