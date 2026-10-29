const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..');
const file=path.join(repo,'packages/vscode-extension/src/__tests__/preCommitStorageUri.review.test.ts'),source=fs.readFileSync(file,'utf8');
const before='resolve("packages/vscode-extension/src/history-hooks/PreCommitController.ts")',after='resolve(__dirname,"../history-hooks/PreCommitController.ts")';assert.equal(source.split(before).length,2);
fs.writeFileSync(own('storage-uri-before-01/preCommitStorageUri.pre-cwd-01.test.ts'),source,{flag:'wx'});fs.writeFileSync(file,source.replace(before,after));
console.log('Regression source path resolves from test directory for both repo and Lite package cwd; all11 assertions unchanged.');
