const fs=require('node:fs'),path=require('node:path');
const inspection=fs.readFileSync(path.join(__dirname,'inspect-vsix-01.ps1'),'utf8').replace(/f06-20261014-attempt01/g,'f06-20261015-attempt02').replace(/extracted-01/g,'extracted-02').replace(/inspection-01/g,'inspection-02');
fs.writeFileSync(path.join(__dirname,'inspect-vsix-02.ps1'),inspection,{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'build-host-06.cjs'),fs.readFileSync(path.join(__dirname,'build-host-01.cjs'),'utf8').replace('prebuilt-host-01','prebuilt-host-06'),{flag:'wx'});
console.log('Prepared new exact artifact inspection and final native fixture build; historical artifacts retained.');
