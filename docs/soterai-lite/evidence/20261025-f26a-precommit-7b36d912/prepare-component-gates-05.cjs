const fs=require('node:fs'),path=require('node:path');
const src=path.resolve(__dirname,'../../../../packages/vscode-extension/src/history-hooks/PreCommitOwnerService.ts');
fs.writeFileSync(path.join(__dirname,'PreCommitOwnerService.before-typecheck-02.ts'),fs.readFileSync(src),{flag:'wx'});
const old=fs.readFileSync(path.join(__dirname,'run-current-components-04.ps1'),'utf8');
fs.writeFileSync(path.join(__dirname,'run-current-components-05.ps1'),old.replaceAll('compiler-04.txt','compiler-05.txt').replaceAll('components-combined-04.txt','components-combined-05.txt'),{flag:'wx'});
console.log('Prepared distinct compiler05/combined05; compiler04 failure retained, combined04 NOT_RUN.');
