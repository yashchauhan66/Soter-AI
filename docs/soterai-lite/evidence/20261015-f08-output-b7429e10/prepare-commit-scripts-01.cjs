// Root may run this preparer before acceptance so the scripts enter its index.
// This only writes new scripts and never invokes Git.
const fs=require('node:fs'),path=require('node:path');
const previous=path.resolve(__dirname,'../20261015-f07-matching-64a72df1');
for(const file of ['commit-f08.ps1','commit-transition-01.ps1'])if(fs.existsSync(path.join(__dirname,file)))throw new Error('Immutable output already exists: '+file);
const commit=fs.readFileSync(path.join(previous,'commit-f07.ps1'),'utf8').replaceAll('f07','f08').replaceAll('F07','F08')
 .replace('feat(lite): add bounded shared registered-secret recognition','feat(lite): add bounded completion-buffered output sanitization');
const transition=fs.readFileSync(path.join(previous,'commit-transition-01.ps1'),'utf8').replaceAll('f07','f08')
 .replace('docs(lite): verify registered matching bytes and activate output redactor','docs(lite): verify buffered output bytes and activate task boundary');
fs.writeFileSync(path.join(__dirname,'commit-f08.ps1'),commit,{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'commit-transition-01.ps1'),transition,{flag:'wx'});
console.log('Prepared exact offline allowlisted F08 source/transition commit scripts; no Git mutation performed.');
