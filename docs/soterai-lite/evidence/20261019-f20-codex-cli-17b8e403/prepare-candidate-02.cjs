'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let s=fs.readFileSync(path.join(__dirname,'build-candidate-02.ps1'),'utf8');
s=s.replaceAll("'typecheck-03'","'typecheck-04'").replaceAll("'generate-readiness-02'","'generate-readiness-03'").replaceAll("'focused-02'","'focused-03'").replaceAll("'readme-readiness-02'","'readme-readiness-03'").replaceAll("'package-01'","'package-02'").replaceAll('attempt01.vsix','attempt02.vsix').replace("-InspectionName '01'","-InspectionName '02'");
const anchor="'packages/vscode-extension/src/__tests__/codexNativeMetadata.review.test.ts')";assert.equal(s.split(anchor).length,2);s=s.replace(anchor,"'packages/vscode-extension/src/__tests__/codexNativeMetadata.review.test.ts','packages/vscode-extension/src/__tests__/codexStorageUri.review.test.ts')");
fs.writeFileSync(path.join(__dirname,'build-candidate-03.ps1'),s,{flag:'wx'});
const launcher=fs.readFileSync(path.join(__dirname,'run-product-matrix-04.ps1'),'utf8').replaceAll('vsix-inspection-01.json','vsix-inspection-02.json');fs.writeFileSync(path.join(__dirname,'run-product-matrix-05.ps1'),launcher,{flag:'wx'});
console.log('PREPARED_NEW_CANDIDATE02_FOCUSED53_AND_ACTUAL_MATRIX05');
