const fs=require('node:fs'),path=require('node:path');
const text=fs.readFileSync(path.join(__dirname,'inspect-vsix-attempt03.ps1'),'utf8').replaceAll('attempt03.vsix','attempt04.vsix').replaceAll('vsix-extracted-03','vsix-extracted-04').replaceAll('vsix-inspection-03.json','vsix-inspection-04.json');
fs.writeFileSync(path.join(__dirname,'inspect-vsix-attempt04.ps1'),text,{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_NOT_RUN',scope:'Canonical byte-budget fix exact artifact'}));
