'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let s=fs.readFileSync(path.join(__dirname,'build-candidate-03.ps1'),'utf8').replaceAll("'typecheck-04'","'typecheck-05'").replaceAll("'generate-readiness-03'","'generate-readiness-04'").replaceAll("'focused-03'","'focused-04'").replaceAll("'readme-readiness-03'","'readme-readiness-04'").replaceAll("'package-02'","'package-03'").replaceAll('attempt02.vsix','attempt03.vsix').replace("-InspectionName '02'","-InspectionName '03'");
const anchor="'packages/vscode-extension/src/__tests__/codexStorageUri.review.test.ts')";assert.equal(s.split(anchor).length,2);s=s.replace(anchor,"'packages/vscode-extension/src/__tests__/codexStorageUri.review.test.ts','packages/vscode-extension/src/__tests__/codexDeleteOwnership.review.test.ts')");
fs.writeFileSync(path.join(__dirname,'build-candidate-04.ps1'),s,{flag:'wx'});
const launcher=fs.readFileSync(path.join(__dirname,'run-product-matrix-05.ps1'),'utf8').replaceAll('vsix-inspection-02.json','vsix-inspection-03.json');fs.writeFileSync(path.join(__dirname,'run-product-matrix-06.ps1'),launcher,{flag:'wx'});
for(const name of['run-current-retained-01.ps1','run-current-affected-01.ps1']){
 assert.equal(fs.existsSync(path.join(__dirname,name==='run-current-retained-01.ps1'?'retained-native-01.txt':'affected-hosts-01.txt')),false);
 let script=fs.readFileSync(path.join(__dirname,name),'utf8').replaceAll('vsix-inspection-01.json','vsix-inspection-03.json').replace("-InspectionName','01'","-InspectionName','03'");
 fs.writeFileSync(path.join(__dirname,name),script);
}
console.log('PREPARED_CANDIDATE03_FOCUSED55_NATIVE_MATRIX06_AND_CURRENT_AFFECTED_GATES');
