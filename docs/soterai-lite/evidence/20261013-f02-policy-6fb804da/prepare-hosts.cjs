const fs=require('node:fs'),path=require('node:path');
const prior=path.resolve(__dirname,'../20261013-f01-restrictions-914f6b6e/run-f01-native-host.ps1');
const source=fs.readFileSync(prior,'utf8');
fs.writeFileSync(path.join(__dirname,'run-f02-native-host.ps1'),source.replaceAll('F01','F02').replaceAll('f01','f02'),{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'run-f01-retained-native-host.ps1'),source.replace("('native-host-'","('f01-native-host-'"),{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_NOT_RUN',scope:'New immutable launcher copies; original F01 driver preserved.'}));
