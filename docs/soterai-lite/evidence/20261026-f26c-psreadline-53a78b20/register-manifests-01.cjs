const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),flag='soterai.lite.historyHooks.psReadLine',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cards=[['soterai.installPSReadLineHistoryGuard','Review and Install PowerShell History Exclusion'],['soterai.restorePSReadLineHistoryGuard','Restore Owned PowerShell History Profile'],['soterai.psReadLineHistoryGuardStatus','PowerShell History Exclusion Status']],facts=[];
for(const location of ['packages/vscode-extension/package.json','packages/soterai-lite/package.json']){
 const file=path.join(repo,location),raw=fs.readFileSync(file),text=raw.toString('utf8'),manifest=JSON.parse(text),name=location.includes('/soterai-lite/')?'lite':'canonical';
 fs.writeFileSync(path.join(__dirname,'manifest-'+name+'-before-01.json'),raw,{flag:'wx'});
 const properties=manifest.contributes.configuration.properties;assert(!Object.hasOwn(properties,flag));assert(!manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(flag));
 for(const [id]of cards)assert(!manifest.contributes.commands.some(row=>row.command===id));
 properties[flag]={type:'boolean',default:false,scope:'machine',description:'Opt in to native owner-reviewed credential-command history exclusion for a selected Windows PowerShell 5.1 / PSReadLine 2.0.0 ConsoleHost profile. Only absent, blank or ordinary comment-only originals are supported automatically. Preserves prior handler denies and public history, with conservative extra exclusions. Existing history and unknown values/encodings remain limited. Status stays Uncovered until the selected profile is actually loaded and verified. Disable stops new installs; explicit reviewed restore verifies encrypted recovery and exact owned bytes.'};
 manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.push(flag);
 for(const[command,title]of cards){manifest.contributes.commands.push({command,title,category:'SoterAI'});manifest.contributes.menus.commandPalette.push({command,when:'soterai.advancedCommands'});}
 let next=JSON.stringify(manifest,null,2)+'\n';if(text.includes('\r\n'))next=next.replaceAll('\n','\r\n');fs.writeFileSync(file,next);
 facts.push({path:location,before:{bytes:raw.length,sha256:sha(raw)},after:{bytes:Buffer.byteLength(next),sha256:sha(Buffer.from(next))},machineSettings:Object.entries(properties).filter(([,v])=>v.scope==='machine').length,commands:cards.map(([id])=>id)});
}
fs.writeFileSync(path.join(__dirname,'manifest-registration-01.json'),JSON.stringify({status:'SOURCE_REGISTERED_NOT_BUILT_OR_NATIVE_TESTED',observedAt:new Date().toISOString(),facts},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(facts));
