const fs=require('node:fs'),path=require('node:path');
fs.writeFileSync(path.join(__dirname,'build-host-02.cjs'),fs.readFileSync(path.join(__dirname,'build-host-01.cjs'),'utf8').replaceAll('prebuilt-host-01','prebuilt-host-02'),{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'run-host-checks-02.ps1'),fs.readFileSync(path.join(__dirname,'run-host-checks-01.ps1'),'utf8').replaceAll('prebuilt-host-01','prebuilt-host-02'),{flag:'wx'});
console.log('Prepared fresh test-only fixture build with exact narrowed S08/S10 evidence scope; product runtime unchanged.');
