const fs=require('node:fs'),path=require('node:path');
for(const kind of ['functional','security']){
 const source=fs.readFileSync(path.join(__dirname,`run-${kind}-02.ps1`),'utf8').replaceAll('f10-artifact-binding-01.ps1','f10-artifact-binding-02.ps1');
 fs.writeFileSync(path.join(__dirname,`run-${kind}-03.ps1`),source,{flag:'wx'});
}
const hosts=fs.readFileSync(path.join(__dirname,'run-affected-hosts-03.ps1'),'utf8')
 .replaceAll('run-functional-02.ps1','run-functional-03.ps1').replaceAll('run-security-02.ps1','run-security-03.ps1');
fs.writeFileSync(path.join(__dirname,'run-affected-hosts-04.ps1'),hosts,{flag:'wx'});
const wrapper=fs.readFileSync(path.join(__dirname,'run-final-hosts-04.ps1'),'utf8')
 .replaceAll("@{Name='native-launch-04';Script='run-native-01.ps1';Extra=@('-HostTestsPath',$taskHost,'-ExtensionRoot',$taskExtension)},",'')
 .replaceAll('affected-launch-04','affected-launch-05').replaceAll('run-affected-hosts-03.ps1','run-affected-hosts-04.ps1');
fs.writeFileSync(path.join(__dirname,'run-final-affected-05.ps1'),wrapper,{flag:'wx'});
