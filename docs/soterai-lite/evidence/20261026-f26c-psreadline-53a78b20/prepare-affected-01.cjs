// Rebind only the 25 reviewed pipe-owning F26a affected controls. Never select
// precommit34/native06, and never read a prior result as a current result.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),prior=path.join(repo,'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const fact=file=>{const raw=fs.readFileSync(file);return{path:path.relative(repo,file).replace(/\\/g,'/'),bytes:raw.length,sha256:sha(raw)}};
const template=read(path.join(prior,'affected-native-template-manifest-04.json'));assert.equal(template.records.length,25);
const outputs=[];
for(const record of template.records){
 const source=path.join(repo,record.target.path);assert.deepEqual(fact(source),record.target);let text=fs.readFileSync(source,'utf8');
 assert(text.includes('__F26A_AFFECTED04_BOUND__'));text=text.replaceAll('__F26A_AFFECTED04_BOUND__','__F26C_AFFECTED_BOUND__');
 for(const[from,to]of [['affected-native-binding-04.ps1','affected-native-binding-01.ps1'],['host-current-binding-03.ps1','affected-native-binding-01.ps1'],['artifact-binding-02.ps1','affected-native-binding-01.ps1'],['vsix-extracted-02','vsix-extracted-03'],['prebuilt-native-hosts-04','prebuilt-native-hosts-03'],["@('-InspectionName','02')","@('-InspectionName','03')"],["[string]$InspectionName='01'","[string]$InspectionName='03'"]])text=text.replaceAll(from,to);
 assert(!/precommit/i.test(text),'No precommit native driver allowed');
 const name=path.basename(source);fs.writeFileSync(own(name),text,{flag:'wx'});outputs.push({source:record.target,target:fact(own(name)),timeouts:record.timeouts});
}
for(const name of ['native-pipe-ownership-02.ps1','retained-functional10-driver-01.js','retained-security17-driver-01.js']){const source=path.join(prior,name);fs.copyFileSync(source,own(name),fs.constants.COPYFILE_EXCL);outputs.push({source:fact(source),target:fact(own(name))});}
fs.writeFileSync(own('affected-template-provenance-01.json'),JSON.stringify({status:'PREPARED_UNBOUND_NOT_EXECUTED',observedAt:new Date().toISOString(),upstream:fact(path.join(prior,'affected-native-template-manifest-04.json')),outputs,native06:'EXCLUDED_USER_DEFERRED_NOT_RUN',scope:'25 accepted pipe-owning affected controls; same timeouts and behavior oracles, new exact artifact/source/host guards required. No old native PASS transfer.'},null,2)+'\n',{flag:'wx'});
console.log('Prepared25 affected templates plus3 retained ownership/functional/security inputs; no native launch.');
