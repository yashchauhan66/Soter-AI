const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const file=path.resolve(__dirname,'../../../../packages/vscode-extension/src/__tests__/prePushShellReplay.test.ts'),old=fs.readFileSync(file,'utf8');
assert.equal(old.split('process.argv[5]').length,2);fs.writeFileSync(path.join(__dirname,'prePushShellReplay.before-02.test.ts.txt'),old,{flag:'wx'});fs.writeFileSync(file,old.replace('process.argv[5]','process.argv[4]'));
