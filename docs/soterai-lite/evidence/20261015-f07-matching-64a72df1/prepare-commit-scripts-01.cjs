const fs=require('node:fs'),path=require('node:path');
const previous=path.resolve(__dirname,'../20261014-f06-vault-9c361a42');
fs.writeFileSync(path.join(__dirname,'commit-f07.ps1'),fs.readFileSync(path.join(previous,'commit-f06.ps1'),'utf8').replaceAll('f06','f07').replaceAll('F06','F07')
 .replace('feat(lite): add reviewed transactional vault migration and recovery','feat(lite): add bounded shared registered-secret recognition'),{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'commit-transition-01.ps1'),fs.readFileSync(path.join(previous,'commit-transition-01.ps1'),'utf8').replaceAll('f06','f07')
 .replace('docs(lite): verify vault migration bytes and activate value matching','docs(lite): verify registered matching bytes and activate output redactor'),{flag:'wx'});
console.log('Prepared exact scoped local commit scripts, no Git mutation performed.');
