const fs=require('node:fs'),path=require('node:path');
const local=fs.readFileSync(path.join(__dirname,'run-final-local-03.ps1'),'utf8')
 .replaceAll('final-focused-03','final-focused-04').replaceAll('typecheck-07','typecheck-08').replaceAll('full-tests-03','full-tests-04')
 .replaceAll("'package-02'","'package-03'").replaceAll('20261017-attempt01','20261017-attempt02').replaceAll('-InspectionName 02','-InspectionName 03')
 +"\nInvoke-F10Local 'host-build-02' @('docs/soterai-lite/evidence/20261015-f10-ps51-3f12ab64/build-native-host-01.cjs','prebuilt-native-host-02')\n";
fs.writeFileSync(path.join(__dirname,'run-final-local-04.ps1'),local,{flag:'wx'});
const hosts=fs.readFileSync(path.join(__dirname,'run-final-hosts-02.ps1'),'utf8')
 .replaceAll('20261017-attempt01','20261017-attempt02').replaceAll('vsix-extracted-02','vsix-extracted-03')
 .replaceAll('prebuilt-native-host-01','prebuilt-native-host-02').replaceAll('native-launch-02','native-launch-03').replaceAll('affected-launch-02','affected-launch-03')
 .replaceAll("'-InspectionName','02'","'-InspectionName','03'");
fs.writeFileSync(path.join(__dirname,'run-final-hosts-03.ps1'),hosts,{flag:'wx'});
