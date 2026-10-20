'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),rows=[];
for(const [from,to]of[['run-affected-cli-01.ps1','run-affected-cli-02.ps1'],['run-current-retained-01.ps1','run-current-retained-02.ps1'],['run-current-affected-01.ps1','run-current-affected-02.ps1']]){
 const text=fs.readFileSync(path.join(__dirname,from),'utf8').replaceAll('vsix-inspection-01.json','vsix-inspection-02.json').replace("'-InspectionName','01'","'-InspectionName','02'");
 fs.writeFileSync(path.join(__dirname,to),text,{flag:'wx'});rows.push({path:to,sha256:crypto.createHash('sha256').update(text).digest('hex')});
}
const script=fs.readFileSync(path.join(__dirname,'run-final-gates-01.ps1'));rows.push({path:'run-final-gates-01.ps1',sha256:crypto.createHash('sha256').update(script).digest('hex')});
fs.writeFileSync(path.join(__dirname,'final-gates-freeze-01.json'),JSON.stringify({status:'FROZEN_NOT_EXECUTED',files:rows,scope:'Final metadata repairs and affected automated gates only; no fifth IDE run and no F20C transition.'},null,2)+'\n',{flag:'wx'});
