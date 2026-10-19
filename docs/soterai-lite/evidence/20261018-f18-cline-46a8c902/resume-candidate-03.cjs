'use strict';
const fs=require('node:fs'),path=require('node:path');
let text=fs.readFileSync(path.join(__dirname,'build-candidate-01.ps1'),'utf8').replace("'typecheck-03'","'typecheck-05'").replace("'focused-01'","'focused-02'");
fs.writeFileSync(path.join(__dirname,'build-candidate-03.ps1'),text,{flag:'wx'});
