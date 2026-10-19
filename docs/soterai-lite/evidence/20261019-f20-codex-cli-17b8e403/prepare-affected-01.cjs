'use strict';
const fs=require('node:fs'),path=require('node:path');const prior=path.resolve(__dirname,'../20261019-f19-claude-89c1e602');
for(const name of['build-native-hosts-01.cjs','run-retained-native-01.ps1','run-affected-hosts-02.ps1','run-functional-02.ps1','run-security-02.ps1','artifact-binding-02.ps1']){
 const source=fs.readFileSync(path.join(prior,name),'utf8').replaceAll('f19-','f20a-').replaceAll('F19','F20A');
 fs.writeFileSync(path.join(__dirname,name),source,{flag:'wx'});
}
let retained=fs.readFileSync(path.join(prior,'run-current-retained-03.ps1'),'utf8').replaceAll('vsix-inspection-04','vsix-inspection-01').replaceAll('prebuilt-native-hosts-02','prebuilt-native-hosts-01').replaceAll('retained-native-build-02','retained-native-build-01').replaceAll('retained-native-02.txt','retained-native-01.txt');
fs.writeFileSync(path.join(__dirname,'run-current-retained-01.ps1'),retained,{flag:'wx'});
let affected=fs.readFileSync(path.join(prior,'run-current-affected-04.ps1'),'utf8').replaceAll('vsix-inspection-04','vsix-inspection-01').replaceAll('affected-hosts-04.txt','affected-hosts-01.txt').replace("-InspectionName','04'","-InspectionName','01'");
fs.writeFileSync(path.join(__dirname,'run-current-affected-01.ps1'),affected,{flag:'wx'});console.log('PREPARED_NOT_RUN_CURRENT_NATIVE106_FUNCTIONAL10_SECURITY17_HELPERS');
