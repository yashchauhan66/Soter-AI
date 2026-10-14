const fs=require('node:fs'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'run-f03-compat-native-host-03.ps1'),'utf8').replace("('compat-native-host-'+","('current-native-host-'+");
fs.writeFileSync(path.join(__dirname,'run-f03-current-native-host-04.ps1'),script,{flag:'wx'});
const queueFile=path.resolve(__dirname,'../../FEATURE-QUEUE.json');
const queue=JSON.parse(fs.readFileSync(queueFile,'utf8').replace(/^\uFEFF/,''));
queue.scope='F01/F02 DONE; F03 alone VERIFYING:61focusedPASS,915fulltests912PASS0FAIL3SKIP, exact VSIX built. Current updated Code1.141.1 native acceptance pending. No F04 production.';
Object.assign(queue.features.find(feature=>feature.id==='F03'),{status:'VERIFYING',result:'INCOMPLETE'});
fs.writeFileSync(queueFile,JSON.stringify(queue,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'host-resume-01.json'),JSON.stringify({status:'PREPARED_NOT_RUN',observedAt:new Date().toISOString(),currentCodeVersion:'1.141.1',
 currentCodeSha256:'ca4e2dc5a28b1ed7c443baba989dea6b8e02c2b36bc5bc9bf4b9eb5dff781c9a',updaterProcesses:0,
 compatibility:{status:'INCOMPLETE',tests:'NOT-RUN',reason:'Cached1.104 renderer oom(-536870904), extensionHost134/fileWatchercrashed; retained process/stdout handles, no kill.',
 path:'compat-native-host-20261014T034005Z-c7a3d36a',scope:'Not current editor evidence'},normalProfileTouched:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_NOT_RUN',currentEditor:'1.141.1',next:'Native tests on exact unchanged final F03 VSIX runtime'}));
