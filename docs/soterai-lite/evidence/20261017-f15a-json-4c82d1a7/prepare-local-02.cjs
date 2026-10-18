const fs=require('node:fs'),path=require('node:path');
let script=fs.readFileSync(path.join(__dirname,'run-local-01.ps1'),'utf8');
script=script.replace("Invoke-F15a 'typecheck-02'", "Invoke-F15a 'typecheck-03'").replace("Invoke-F15a 'focused-01'", "Invoke-F15a 'focused-02'").replace("Invoke-F15a 'broker-typecheck-01'", "Invoke-F15a 'broker-typecheck-02'");
fs.writeFileSync(path.join(__dirname,'run-local-02.ps1'),script,{flag:'wx'});
console.log('Resume gates after type-only CLI callback correction; failed compiler receipt retained.');
