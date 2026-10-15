const fs=require('node:fs'),path=require('node:path');
let script=fs.readFileSync(path.join(__dirname,'run-host-checks-01.ps1'),'utf8');
script=script.replace("'native-host-launch-01.txt'","'native-host-launch-07.txt'").replace('/prebuilt-host-01/lite-vault-host.js','/prebuilt-host-06/lite-vault-host.js').replace('/vsix-extracted-01/extension','/vsix-extracted-02/extension').replace("/run-native-01.ps1'","/run-native-02.ps1'");
fs.writeFileSync(path.join(__dirname,'run-host-checks-03.ps1'),script,{flag:'wx'});
console.log('Prepared serial native and affected-host checks for exact fresh F06 artifact02.');
