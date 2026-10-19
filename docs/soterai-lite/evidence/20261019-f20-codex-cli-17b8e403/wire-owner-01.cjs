'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),changed=[];
for(const [name,spaces]of[['vscode-extension',4],['soterai-lite',2]]){
 const file=path.join(repo,'packages',name,'package.json'),m=JSON.parse(fs.readFileSync(file,'utf8')),key='soterai.lite.codexCliAdapter';
 assert.equal(m.contributes.configuration.properties[key],undefined);
 m.contributes.configuration.properties[key]={type:'boolean',default:true,scope:'machine',description:'Enable owner-reviewed pinned Codex CLI dedicated safe-read profile setup. Native provider traffic/context and other profiles remain uncovered. Disabling withdraws MCP and preserves the restrictive profile.'};
 m.capabilities.untrustedWorkspaces.restrictedConfigurations.push(key);
 for(const [command,title] of [['configurePinnedCodexCli','Review Pinned Codex CLI Safe-Read Profile'],['restorePinnedCodexCli','Restore Pinned Codex CLI Profile Config'],['codexCliAdapterStatus','Show Pinned Codex CLI Profile Status']]){
  const id='soterai.'+command;assert.equal(m.contributes.commands.some(v=>v.command===id),false);
  m.contributes.commands.push({command:id,title,category:'SoterAI'});m.contributes.menus.commandPalette.push({command:id,when:'soterai.advancedCommands'});
 }
 fs.writeFileSync(file,JSON.stringify(m,null,spaces)+'\n');const bytes=fs.readFileSync(file);changed.push({path:path.relative(repo,file).replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync(path.join(__dirname,'owner-wiring-01.json'),JSON.stringify({status:'REGISTERED_NOT_ACCEPTANCE',changed},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'REGISTERED_NOT_ACCEPTANCE',files:changed.length}));
