'use strict';
const fs=require('node:fs'),path=require('node:path');
let text=fs.readFileSync(path.join(__dirname,'run-final-local-01.ps1'),'utf8');
text=text.replace(/^Invoke-F17 'typecheck-02'.*\r?\n/m,'').replace("Invoke-F17 'focused-01'","Invoke-F17 'focused-02'");
fs.writeFileSync(path.join(__dirname,'run-final-local-02.ps1'),text,{flag:'wx'});
