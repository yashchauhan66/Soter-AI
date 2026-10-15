const fs=require('node:fs'),path=require('node:path');
fs.writeFileSync(path.join(__dirname,'run-native-06.ps1'),fs.readFileSync(path.join(__dirname,'run-native-05.ps1'),'utf8').replace(/typecheck-06/g,'typecheck-07'),{flag:'wx'});
console.log('Fixed test-only inspector unknown data typing; assertions unchanged.');
