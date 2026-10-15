const fs=require('node:fs'),path=require('node:path');
const previous=path.resolve(__dirname,'../20261014-f06-vault-9c361a42/inspect-vsix-02.ps1');
fs.writeFileSync(path.join(__dirname,'inspect-vsix-01.ps1'),fs.readFileSync(previous,'utf8')
 .replaceAll('f06-20261015-attempt02','f07-20261015-attempt01').replaceAll('extracted-02','extracted-01').replaceAll('inspection-02','inspection-01'),{flag:'wx'});
console.log('Prepared exact F07 artifact inspection, historical artifacts retained.');
