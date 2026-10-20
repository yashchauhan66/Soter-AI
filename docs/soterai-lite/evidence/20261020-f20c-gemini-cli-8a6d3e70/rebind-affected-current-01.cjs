const fs=require('node:fs'),path=require('node:path');
for(const [from,to]of [['run-current-affected-04.ps1','run-current-affected-05.ps1'],['run-current-retained-03.ps1','run-current-retained-04.ps1'],['run-affected-cli-03.ps1','run-affected-cli-04.ps1'],['run-ide-product-matrix-02.ps1','run-ide-product-matrix-03.ps1']]){
 let text=fs.readFileSync(path.join(__dirname,from),'utf8').replaceAll('vsix-inspection-02.json','vsix-inspection-03.json').replaceAll("'-InspectionName','02'","'-InspectionName','03'");
 fs.writeFileSync(path.join(__dirname,to),text,{flag:'wx'});
}
