'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),source=path.resolve(__dirname,'../20261024-f25-logs-prepared-7a4b9d21/logContent.test.ts'),target=path.join(repo,'packages/vscode-extension/src/__tests__/logContent.test.ts');
const bytes=fs.readFileSync(source),sha=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(sha,'9b590e952b66424eab17e3a963bff6cd06511e3f73547a3fc31f49647a217fe4');
assert(!fs.existsSync(path.join(repo,'packages/vscode-extension/src/logs/LogContent.ts')),'Production must remain absent before missing-module baseline.');
fs.writeFileSync(target,bytes,{flag:'wx'});fs.writeFileSync(path.join(__dirname,'content-test-first-01.json'),JSON.stringify({status:'COPIED_FROZEN_PREPARED_TEST_BEFORE_PRODUCTION',source,path:path.relative(repo,target).replaceAll('\\','/'),bytes:bytes.length,sha256:sha,tests:32,productionAbsent:true},null,2),{flag:'wx'});
console.log(JSON.stringify({status:'COPIED_BEFORE_PRODUCTION',tests:32,sha256:sha}));
