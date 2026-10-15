const fs=require('node:fs'),path=require('node:path');
let text=fs.readFileSync(path.join(__dirname,'run-host-checks-01.ps1'),'utf8').replace("'native-host-launch-01.txt'","'native-host-launch-02.txt'");
fs.writeFileSync(path.join(__dirname,'run-host-checks-02.ps1'),text,{flag:'wx'});
console.log('Prepared fresh native launch attempt, keeping failed updater-gated evidence.');
