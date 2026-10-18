const fs=require('node:fs'),path=require('node:path');
const old=path.join(__dirname,'../20261017-f14-broker-lifecycle-71e5b490/artifact-binding-01.ps1');
fs.writeFileSync(path.join(__dirname,'artifact-binding-01.ps1'),fs.readFileSync(old,'utf8').replaceAll('F14','F15a').replaceAll('f14','f15a'),{flag:'wx'});
console.log('Prepared remaining exact artifact binding helper.');
