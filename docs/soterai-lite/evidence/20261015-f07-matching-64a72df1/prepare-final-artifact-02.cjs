const fs=require('node:fs'),path=require('node:path');
fs.writeFileSync(path.join(__dirname,'inspect-vsix-02.ps1'),fs.readFileSync(path.join(__dirname,'inspect-vsix-01.ps1'),'utf8')
 .replaceAll('f07-20261015-attempt01','f07-20261015-attempt02').replaceAll('extracted-01','extracted-02').replaceAll('inspection-01','inspection-02'),{flag:'wx'});
console.log('Prepared final F07 artifact inspection without overwriting historical artifacts.');
