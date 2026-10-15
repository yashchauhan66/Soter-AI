const fs=require('node:fs'),path=require('node:path');
const build=fs.readFileSync(path.join(__dirname,'build-host-01.cjs'),'utf8').replace('prebuilt-host-01','prebuilt-host-04');
fs.writeFileSync(path.join(__dirname,'build-host-04.cjs'),build,{flag:'wx'});
const script=fs.readFileSync(path.join(__dirname,'run-native-04.ps1'),'utf8').replace(/typecheck-05/g,'typecheck-06').replace(/build-host-03/g,'build-host-04').replace(/host-build-03/g,'host-build-04').replace(/prebuilt-host-03/g,'prebuilt-host-04').replace(/native-host-launch-04/g,'native-host-launch-05');
fs.writeFileSync(path.join(__dirname,'run-native-05.ps1'),script,{flag:'wx'});
console.log('Prepared value-filtered local debugger exception metadata; exact packaged runtime unchanged.');
