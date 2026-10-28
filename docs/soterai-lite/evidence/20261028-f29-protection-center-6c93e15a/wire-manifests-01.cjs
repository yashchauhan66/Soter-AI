'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const d=__dirname,repo=path.resolve(d,'../../../..');
for(const [name,spaces]of [['vscode-extension',4],['soterai-lite',2]]){
 const file=path.join(repo,'packages',name,'package.json'),raw=fs.readFileSync(file),p=JSON.parse(raw),c=p.contributes;
 fs.writeFileSync(path.join(d,name+'-manifest-before-01.json'),raw,{flag:'wx'});assert(!c.configuration.properties['soterai.lite.protectionCenter']);
 c.configuration.properties['soterai.lite.protectionCenter']={type:'boolean',default:true,scope:'machine',description:'Show native Protected items, Activity and Coverage in one sidebar. Uses saved explicit metadata and existing reviewed setup/restore commands; settings never establish tested protection. Repository overrides are ignored. Disable withdraws this presentation and retains saved denies, audit and recovery records.'};
 p.capabilities.untrustedWorkspaces.restrictedConfigurations.push('soterai.lite.protectionCenter');
 const views=c.views['soterai-explorer'];for(const id of ['soterai-control-panel','soterai-project-risk','soterai-latest-findings','soterai-policy-status']){const v=views.find(v=>v.id===id);assert(v);v.when=v.when?'('+v.when+') && !soterai.protectionCenter':'!soterai.protectionCenter';}
 views.unshift(...[['soterai-protected-items','Protected items'],['soterai-protection-activity','Activity'],['soterai-protection-coverage','Coverage']].map(([id,name])=>({id,name,when:'soterai.protectionCenter'})));
 for(const [command,title,icon]of [['soterai.openProtectionCenter','Open Protection Center','$(shield)'],['soterai.refreshProtectionCenter','Refresh Protection Center','$(refresh)'],['soterai.protectionCenterAction','Protection Center reviewed action','$(list-selection)']]){assert(!c.commands.some(v=>v.command===command));c.commands.push({command,title,category:'SoterAI',icon});}
 const menu=(id,rows)=>{c.menus[id]??=[];c.menus[id].push(...rows);};
 menu('explorer/context',[{command:'soterai.openProtectionCenter',when:'soterai.protectionCenter && resourceScheme == file',group:'soterai@0'}]);
 menu('view/title',[{command:'soterai.refreshProtectionCenter',when:'view == soterai-protected-items || view == soterai-protection-activity || view == soterai-protection-coverage',group:'navigation'}]);
 menu('view/item/context',[{command:'soterai.manageAIRules',when:'view == soterai-protected-items && viewItem == soterai.savedRestriction',group:'inline'}]);
 menu('commandPalette',[{command:'soterai.openProtectionCenter',when:'soterai.protectionCenter'},{command:'soterai.refreshProtectionCenter',when:'soterai.protectionCenter'},{command:'soterai.protectionCenterAction',when:'false'}]);
 fs.writeFileSync(file,JSON.stringify(p,null,spaces)+'\n');
}
console.log('F29 native views, existing action ownership and restricted machine setting wired in both real manifests.');
