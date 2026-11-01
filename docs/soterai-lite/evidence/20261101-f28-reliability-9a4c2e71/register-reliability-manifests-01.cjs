'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const repo=path.resolve(__dirname,'../../../..');
const flag='soterai.lite.reliability',command='soterai.readReliabilityStatus';
for(const [name,indent]of [['packages/vscode-extension/package.json',4],['packages/soterai-lite/package.json',2]]){
 const p=path.join(repo,name),m=JSON.parse(fs.readFileSync(p,'utf8'));assert(!Object.hasOwn(m.contributes.configuration.properties,flag));assert(!m.contributes.commands.some(c=>c.command===command));
 m.contributes.configuration.properties[flag]={type:'boolean',default:true,scope:'machine',description:'Keep bounded managed reader identity checks enabled. File/parent changes, cancellation, size/time limits or resource failures withhold reads. Turning this off withdraws shared managed reads; it does not restore unchecked originals. SoterAI cannot prevent arbitrary same-user filesystem access or every path race.'};
 m.capabilities.untrustedWorkspaces.restrictedConfigurations.push(flag);m.contributes.commands.push({command,title:'Managed Read Reliability Status',category:'SoterAI'});
 m.contributes.menus.commandPalette.push({command,when:'soterai.advancedCommands'});fs.writeFileSync(p,JSON.stringify(m,null,indent)+'\n');
}
console.log(JSON.stringify({status:'F28_RESTRICTED_DEFAULT_TRUE_FLAG_AND_STATUS_MANIFESTS_UPDATED',manifests:2}));
