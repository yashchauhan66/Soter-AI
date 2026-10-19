'use strict';
const fs=require('node:fs'),path=require('node:path');const file=path.join(__dirname,'build-candidate-01.ps1');
fs.writeFileSync(path.join(__dirname,'build-candidate-02.ps1'),fs.readFileSync(file,'utf8').replace("'typecheck-03'","'typecheck-04'"),{flag:'wx'});
