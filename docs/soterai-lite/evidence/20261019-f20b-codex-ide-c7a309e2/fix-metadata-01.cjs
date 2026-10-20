'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),repo=path.resolve(__dirname,'../../../..');
for(const name of['vscode-extension','soterai-lite']){
 const file=path.join(repo,'packages',name,'package.json'),m=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const command of m.contributes.commands)if(['soterai.configurePinnedCodexIde','soterai.restorePinnedCodexIde','soterai.codexIdeAdapterStatus'].includes(command.command)){command.category='SoterAI';command.title=command.title.replace(/^SoterAI: /,'');}
 fs.writeFileSync(file,JSON.stringify(m,null,name==='vscode-extension'?4:2)+'\n');
 const readme=path.join(repo,'packages',name,'README.md');let text=fs.readFileSync(readme,'utf8');assert(/66/.test(text));
 text=text.replace(/66(?= machine-scoped)/g,'67');fs.writeFileSync(readme,text);
}
