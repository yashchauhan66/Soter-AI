'use strict';
const fs=require('node:fs'),path=require('node:path');
let s=fs.readFileSync(path.join(__dirname,'run-product-matrix-02.ps1'),'utf8');
s=s.replaceAll("name:error.name,code:error.code","name:error.name,code:error.code,fixtureMessage:/^(?:Cannot redefine property: |Cannot assign to read only property )/.test(error.message)?error.message:undefined,stack:typeof error.stack==='string'?error.stack.split('\\n').slice(1,5).map(line=>line.replace(/.*[\\\\/]/,'').slice(0,160)):undefined");
fs.writeFileSync(path.join(__dirname,'run-product-matrix-diagnostic-03.ps1'),s,{flag:'wx'});
