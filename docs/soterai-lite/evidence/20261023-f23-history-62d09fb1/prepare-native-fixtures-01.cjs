'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),prior=path.join(repo,'docs/soterai-lite/evidence/20261022-f22h-mcp-config-08c45e2a'),snap=path.join(__dirname,'native-template-originals-01');fs.mkdirSync(snap);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),rows=[];
const files=['host-current-binding-03.ps1','host-version-review-01.json','artifact-binding-01.ps1','inspect-vsix-01.ps1','run-mcp-native-03.ps1','run-affected-editor-03.ps1','run-affected-ci-03.ps1','run-affected-service-account-03.ps1','run-affected-registry-03.ps1','run-affected-terraform-03.ps1','run-affected-container-03.ps1','run-affected-source-03.ps1','run-affected-hygiene-03.ps1','run-affected-vault-03.ps1','run-retained-native-03.ps1','run-affected-hosts-05.ps1','run-functional-05.ps1','run-security-05.ps1','run-current-affected-suite-03.ps1','build-native-hosts-02.cjs'];
for(const file of files){const bytes=fs.readFileSync(path.join(prior,file));fs.writeFileSync(path.join(snap,file),bytes,{flag:'wx'});rows.push({file,bytes:bytes.length,sha256:sha(bytes)});let text=bytes.toString('utf8');
 if(file.endsWith('.json')){fs.writeFileSync(path.join(__dirname,file),bytes,{flag:'wx'});continue;}
 text=text.replaceAll('F22h','F23').replaceAll('F22H','F23').replaceAll('f22h','f23');
 if(file==='host-current-binding-03.ps1')text=text.replaceAll('source-inputs-05.json','source-inputs-01.json');
 if(file==='inspect-vsix-01.ps1'){
  text=text.replaceAll("'soterai.lite.configScanner.mcp'","'soterai.lite.historyScanner'").replaceAll('Count -ne 78','Count -ne 79').replaceAll('requires 78 machine','requires 79 machine');
  const marker="@('soterai.reviewWorkspaceHygiene',";assert.equal(text.split(marker).length,3);text=text.replaceAll(marker,"@('soterai.reviewGitHistory','soterai.historyScannerStatus','soterai.reviewWorkspaceHygiene',");
 }
 if(file==='build-native-hosts-02.cjs'){
  const marker="entryPoints:{'lite-broker-host':";assert(text.includes(marker));text=text.replace(marker,"entryPoints:{'lite-history-host':path.join(repo,'packages/vscode-extension/src/__tests__/host/liteHistoryScanner.host.ts'),'lite-broker-host':");
 }
 fs.writeFileSync(path.join(__dirname,file),text,{flag:'wx'});
 if(file==='run-mcp-native-03.ps1')fs.writeFileSync(path.join(__dirname,'run-history-native-01.ps1'),text.replaceAll('f23-mcp-native-','f23-history-native-'),{flag:'wx'});
}
fs.writeFileSync(path.join(__dirname,'native-template-inputs-01.json'),JSON.stringify({status:'PREPARED_NOT_EXECUTED',originals:rows,scope:'Only feature/evidence labels, current source guard, new machine flag/commands and added history driver; installed Code1.143.0 pins/timings/assertions/no-signals controls retained. History21primary+4restart prepared; no native PASS claim.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',templates:rows.length,historyNativeChecks:25}));
