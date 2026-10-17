const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'run-final-local-05.ps1'),'utf8')
 .replaceAll('final-focused-05','final-focused-06').replaceAll('typecheck-09','typecheck-10');
fs.writeFileSync(path.join(__dirname,'run-final-local-06.ps1'),source,{flag:'wx'});
