'use strict';
const fs=require('node:fs'),path=require('node:path'),repo=path.resolve(__dirname,'../../../..');
for(const name of['vscode-extension','soterai-lite']){const file=path.join(repo,'packages',name,'package.json'),m=JSON.parse(fs.readFileSync(file,'utf8'));for(const entry of m.contributes.menus.commandPalette)if(['soterai.configurePinnedCodexIde','soterai.restorePinnedCodexIde','soterai.codexIdeAdapterStatus'].includes(entry.command))entry.when='soterai.advancedCommands';fs.writeFileSync(file,JSON.stringify(m,null,name==='vscode-extension'?4:2)+'\n');}
let inspection=fs.readFileSync(path.join(__dirname,'../20261019-f20a-responses-45ae291c/inspect-vsix-01.ps1'),'utf8');
inspection=inspection.replaceAll('F20A','F20B').replaceAll('f20a','f20b').replaceAll('codexCliAdapter','codexIdeAdapter').replaceAll('PinnedCodexCli','PinnedCodexIde').replaceAll('66','67');
fs.writeFileSync(path.join(__dirname,'inspect-vsix-01.ps1'),inspection,{flag:'wx'});
