'use strict';
const fs=require('node:fs'),path=require('node:path');
function derive(from,to,transform){const before=fs.readFileSync(path.join(__dirname,from),'utf8'),after=transform(before);if(before===after)throw Error('Missing repair anchor');fs.writeFileSync(path.join(__dirname,to),after,{flag:'wx'});}
derive('product-matrix-02.cjs','product-matrix-03.cjs',s=>s.replace("Object.defineProperty(vscode.env,'openExternal',{configurable:true,writable:true,value:async()=>{records.deniedNativeExecution.push('external-open');return false;}});","records.immutableNativeApis=['env.openExternal']; // Public API is nonconfigurable; no external-open scenario is issued. No OS traffic claim."));
derive('run-product-matrix-diagnostic-03.ps1','run-product-matrix-04.ps1',s=>s.replaceAll('product-matrix-02.cjs','product-matrix-03.cjs'));
derive('run-final-native-01.ps1','run-final-native-02.ps1',s=>s.split('\n').filter(line=>!line.startsWith("Invoke-F18Final 'native-fixture-build-03'")).join('\n').replaceAll('product-matrix-launch-01','product-matrix-launch-03').replaceAll('run-product-matrix-02.ps1','run-product-matrix-04.ps1'));
