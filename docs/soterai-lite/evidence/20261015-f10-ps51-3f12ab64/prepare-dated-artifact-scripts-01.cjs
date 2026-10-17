const fs=require('node:fs'),path=require('node:path');
for(const [from,to] of [['inspect-vsix-02.ps1','inspect-vsix-03.ps1'],['f10-artifact-binding-01.ps1','f10-artifact-binding-02.ps1'],['run-affected-hosts-02.ps1','run-affected-hosts-03.ps1']]){
 const original=fs.readFileSync(path.join(__dirname,from),'utf8');
 const next=original.replaceAll('f10-20261016-attempt','f10-[0-9]{8}-attempt').replaceAll('f10-artifact-binding-01.ps1','f10-artifact-binding-02.ps1');
 fs.writeFileSync(path.join(__dirname,to),next,{flag:'wx'});
}
