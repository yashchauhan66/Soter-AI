const fs=require('node:fs'),path=require('node:path');
const local=fs.readFileSync(path.join(__dirname,'run-final-local-04.ps1'),'utf8')
 .replaceAll('final-focused-04','final-focused-05').replaceAll('typecheck-08','typecheck-09').replaceAll('full-tests-04','full-tests-05')
 .replaceAll("'package-03'","'package-04'").replaceAll('20261017-attempt02','20261017-attempt03').replaceAll('-InspectionName 03','-InspectionName 04')
 .replace(/\r?\nInvoke-F10Local 'host-build-02'[^\r\n]*\r?\n?$/,'\n');
fs.writeFileSync(path.join(__dirname,'run-final-local-05.ps1'),local,{flag:'wx'});
const hosts=fs.readFileSync(path.join(__dirname,'run-final-hosts-03.ps1'),'utf8')
 .replaceAll('20261017-attempt02','20261017-attempt03').replaceAll('vsix-extracted-03','vsix-extracted-04')
 .replaceAll('native-launch-03','native-launch-04').replaceAll('affected-launch-03','affected-launch-04')
 .replaceAll("'-InspectionName','03'","'-InspectionName','04'");
fs.writeFileSync(path.join(__dirname,'run-final-hosts-04.ps1'),hosts,{flag:'wx'});
