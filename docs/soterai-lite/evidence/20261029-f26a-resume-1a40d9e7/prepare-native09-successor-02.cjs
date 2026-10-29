const fs=require('node:fs'),{own}=require('./storage-current-admission-09.cjs');
const s=fs.readFileSync(own('prepare-native09-packet-01.cjs'),'utf8').replaceAll('native09-candidate-01.ps1.txt','native09-candidate-02.ps1.txt').replaceAll('precommit-offline-owner-09.cjs','precommit-offline-owner-09b.cjs');
fs.writeFileSync(own('prepare-native09-packet-02.cjs'),s,{flag:'wx'});
