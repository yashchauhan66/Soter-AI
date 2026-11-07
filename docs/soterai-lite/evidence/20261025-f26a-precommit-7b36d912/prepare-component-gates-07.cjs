const fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'../../../..');
fs.writeFileSync(path.join(__dirname,'checkedOwnerHookContext.before-typecheck-01.test.ts'),fs.readFileSync(path.join(repo,'packages/vscode-extension/src/__tests__/checkedOwnerHookContext.test.ts')),{flag:'wx'});
const old=fs.readFileSync(path.join(__dirname,'run-current-components-06.ps1'),'utf8');fs.writeFileSync(path.join(__dirname,'run-current-components-07.ps1'),old.replaceAll('compiler-06.txt','compiler-07.txt').replaceAll('components-combined-06.txt','components-combined-07.txt'),{flag:'wx'});
console.log('Prepared new compiler07/combined07; compiler06 test-only typing FAIL retained and combined06 NOT_RUN.');
