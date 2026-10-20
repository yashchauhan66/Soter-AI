'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),read=name=>fs.readFileSync(path.join(__dirname,name),'utf8'),write=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'}),sha=text=>crypto.createHash('sha256').update(text).digest('hex'),rows=[];
function create(from,to,changes){let text=read(from);for(const[a,b]of changes)text=text.replaceAll(a,b);write(to,text);rows.push({path:to,sha256:sha(text)});}
create('run-affected-cli-02.ps1','run-affected-cli-03.ps1',[['vsix-inspection-02.json','vsix-inspection-03.json']]);
create('run-current-retained-02.ps1','run-current-retained-03.ps1',[['vsix-inspection-02.json','vsix-inspection-03.json'],['prebuilt-native-hosts-01','prebuilt-native-hosts-02'],['retained-native-build-01','retained-native-build-02'],['retained-native-01.txt','retained-native-02.txt']]);
create('run-current-affected-03.ps1','run-current-affected-04.ps1',[['vsix-inspection-02.json','vsix-inspection-03.json'],["'-InspectionName','02'","'-InspectionName','03'"],['affected-hosts-02.txt','affected-hosts-03.txt']]);
let script=read('run-final-gates-01.ps1');
for(const[a,b]of[
 ["'combined-after-02'","'combined-after-03'"],["'typecheck-02'","'typecheck-03'"],["'package-03'","'package-04'"],['20261020-attempt03.vsix','20261020-attempt04.vsix'],["'inspection-02'","'inspection-03'"],["'-InspectionName','02'","'-InspectionName','03'"],["'full-tests-02'","'full-tests-03'"],
 ["'current-affected-cli-launch-01'","'current-affected-cli-launch-02'"],['run-affected-cli-02.ps1','run-affected-cli-03.ps1'],["'current-retained-launch-01'","'current-retained-launch-02'"],['run-current-retained-02.ps1','run-current-retained-03.ps1'],["'current-affected-launch-01'","'current-affected-launch-03'"],['run-current-affected-02.ps1','run-current-affected-04.ps1'],['final-automated-gates-01.json','final-automated-gates-02.json']
])script=script.replaceAll(a,b);
const marker="@{status='AUTOMATED_AFFECTED_GATES_PASSED_IDE_PRODUCT_NATIVE_GATE_STILL_INCOMPLETE'";
if(!script.includes(marker))throw Error('Final marker missing');
script=script.replace(marker,"Invoke-F20BCheck 'ide-product-matrix-launch-02' 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-ide-product-matrix-02.ps1'))\n@{status='CURRENT_AUTOMATED_GATES_PASSED_PENDING_EXACT_ACCEPTANCE_AND_BYTE_BARRIERS'");
write('run-final-gates-02.ps1',script);rows.push({path:'run-final-gates-02.ps1',sha256:sha(script)});
write('final-gates-freeze-02.json',JSON.stringify({status:'FROZEN_NOT_EXECUTED',scope:'Shared independent CLI/IDE capability fix. Frozen six flags controls baseline4PASS2FAIL; actual IDE21 with CLI disabled, plus rerun all affected gates on new candidate04. No sixth feasibility run.',files:rows},null,2)+'\n');
