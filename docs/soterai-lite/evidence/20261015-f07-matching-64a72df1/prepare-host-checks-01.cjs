const fs=require('node:fs'),path=require('node:path');
fs.writeFileSync(path.join(__dirname,'run-affected-hosts-02.ps1'),fs.readFileSync(path.join(__dirname,'run-affected-hosts-01.ps1'),'utf8').replaceAll('vsix-extracted-01','vsix-extracted-02'),{flag:'wx'});
console.log('Prepared affected host launcher for exact final F07 artifact02.');
