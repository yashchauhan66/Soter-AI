const fs=require('node:fs'),path=require('node:path');
fs.writeFileSync(path.join(__dirname,'build-host-05.cjs'),fs.readFileSync(path.join(__dirname,'build-host-01.cjs'),'utf8').replace('prebuilt-host-01','prebuilt-host-05'),{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'run-native-07.ps1'),fs.readFileSync(path.join(__dirname,'run-native-06.ps1'),'utf8').replace(/typecheck-07/g,'typecheck-08').replace(/build-host-04/g,'build-host-05').replace(/host-build-04/g,'host-build-05').replace(/prebuilt-host-04/g,'prebuilt-host-05').replace(/native-host-launch-05/g,'native-host-launch-06'),{flag:'wx'});
console.log('Prepared primitive native availability guard metadata; acceptance assertions unchanged.');
