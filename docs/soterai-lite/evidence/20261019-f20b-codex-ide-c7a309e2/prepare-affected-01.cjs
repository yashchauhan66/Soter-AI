'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),prior=path.resolve(__dirname,'../20261019-f20a-responses-45ae291c');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),rows=[];
function copy(from,to=from,change=s=>s){const data=change(fs.readFileSync(path.join(prior,from),'utf8'));fs.writeFileSync(path.join(__dirname,to),data,{flag:'wx'});rows.push({path:to,sha256:sha(data)});}
for(const name of['responses-matrix-01.cjs','matrix-guards-01.cjs','build-native-hosts-01.cjs','run-retained-native-01.ps1','run-current-retained-01.ps1','run-affected-hosts-02.ps1','run-current-affected-01.ps1'])copy(name);
copy('installed-public-inputs-01.json','installed-cli-public-inputs-01.json');
copy('run-product-matrix-01.ps1','run-affected-cli-01.ps1',s=>s.replaceAll('installed-public-inputs-01.json','installed-cli-public-inputs-01.json'));
fs.writeFileSync(path.join(__dirname,'affected-freeze-01.json'),JSON.stringify({status:'FROZEN_NOT_EXECUTED',scope:'Current exact F20B VSIX affected previous CLI20/retained106/functional10/security17 only. These do not satisfy the missing IDE product-native route. Existing passing fixture bytes copied, no new IDE improvement round.',files:rows},null,2)+'\n',{flag:'wx'});
let reconcile=fs.readFileSync(path.join(__dirname,'reconcile-feasibility-02.ps1'),'utf8').replaceAll('f20b-feasibility-20261020T031542Z-e2260a35','f20b-feasibility-20261020T033216Z-984f1f0a').replaceAll('20261020T084652','20261020T090326').replaceAll('reconcile-02','reconcile-04');
// Logs use their actual generated directory; resolve only below this exact synthetic root.
reconcile=reconcile.replace("'profile/logs/20261020T090326/main.log','profile/logs/20261020T090326/window1/exthost/exthost.log','profile/logs/20261020T090326/window1/exthost/openai.chatgpt/Codex.log'","'LOG_MAIN','LOG_EXTHOST','LOG_CODEX'");
reconcile=reconcile.replace("$taskRows=@()","$taskLogRoot=Get-ChildItem -LiteralPath (Join-Path $taskRoot 'profile/logs') -Directory; if(@($taskLogRoot).Count -ne 1){throw 'One exact isolated log root required'}; $taskLogPrefix='profile/logs/'+$taskLogRoot.Name; $taskFiles=@('ide-result.json',($taskLogPrefix+'/main.log'),($taskLogPrefix+'/window1/exthost/exthost.log'),($taskLogPrefix+'/window1/exthost/openai.chatgpt/Codex.log'));\n$taskRows=@()");
reconcile=reconcile.replace('Vendor log successful native exit and stdout/stderr EOF; vendor removed child close listeners, so fixture close observation remains incomplete, not regraded','Actual native closed with code0/signalnull and stdout/stderr EOF; original-manifest vendor activation deadline failed, not regraded');
fs.writeFileSync(path.join(__dirname,'reconcile-feasibility-04.ps1'),reconcile,{flag:'wx'});
