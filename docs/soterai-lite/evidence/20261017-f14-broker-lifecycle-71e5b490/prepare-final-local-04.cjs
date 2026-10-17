const fs=require('node:fs'),path=require('node:path');let text=fs.readFileSync(path.join(__dirname,'run-final-local-03.ps1'),'utf8').replaceAll("'typecheck-05'","'typecheck-06'");
text=text.split(/\r?\n/).filter(line=>!line.startsWith("Invoke-F14 'final-focused-03'")).join('\n');fs.writeFileSync(path.join(__dirname,'run-final-local-04.ps1'),text,{flag:'wx'});
for(const name of ['create-final-bindings-01.cjs','record-source-review-02.cjs']){const f=path.join(__dirname,name);fs.writeFileSync(f,fs.readFileSync(f,'utf8').replaceAll('typecheck-05','typecheck-06'));}
console.log('Continue after fixture-only generic array typing fix. Focused03 all171PASS; no assertion/production change. Full03/package02 outputs absent.');
