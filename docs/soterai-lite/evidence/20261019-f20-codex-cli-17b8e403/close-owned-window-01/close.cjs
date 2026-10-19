'use strict';const vscode=require('vscode'),fs=require('node:fs'),path=require('node:path');
const expected='D:/SoterAI-Lite-test-profiles/f20a-product-20261019T141643Z-1f629d90';
const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
exports.activate=async context=>{
 if(!same(process.env.SOTERAI_F20A_PRODUCT_ROOT||'/',expected)||vscode.workspace.workspaceFolders?.length!==1||!same(vscode.workspace.workspaceFolders[0].uri.fsPath,path.join(expected,'workspace')))return;
 const relative=path.relative(path.join(expected,'extensions'),context.extensionUri.fsPath);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))return;
 fs.writeFileSync(path.join(expected,'owned-close-command-01.json'),JSON.stringify({status:'CLOSE_WINDOW_COMMAND_REQUESTED',command:'workbench.action.closeWindow',root:expected,time:new Date().toISOString()})+'\n',{flag:'wx'});
 context.subscriptions.push({dispose:()=>{try{fs.writeFileSync(path.join(expected,'owned-close-disposed-01.json'),JSON.stringify({status:'OWNED_CLOSE_FIXTURE_DISPOSED',time:new Date().toISOString()})+'\n',{flag:'wx'});}catch{}}});
 setTimeout(()=>{void vscode.commands.executeCommand('workbench.action.closeWindow');},100);
};exports.deactivate=()=>{};
