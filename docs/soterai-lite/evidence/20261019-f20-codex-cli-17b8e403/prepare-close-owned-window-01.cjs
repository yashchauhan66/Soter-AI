'use strict';
const fs=require('node:fs'),path=require('node:path'),vsce=require('@vscode/vsce'),crypto=require('node:crypto');
const base=path.join(__dirname,'close-owned-window-01');fs.mkdirSync(base);
const manifest={name:'close-owned-f20a-window-20261019',displayName:'Synthetic F20A owned window close fixture',publisher:'soterai-fixture',version:'0.0.1',engines:{vscode:'^1.85.0'},license:'UNLICENSED',activationEvents:['*'],main:'./close.cjs',extensionKind:['workspace']};
const source=[
 "'use strict';const vscode=require('vscode'),fs=require('node:fs'),path=require('node:path');",
 "const expected='D:/SoterAI-Lite-test-profiles/f20a-product-20261019T141643Z-1f629d90';",
 "const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();",
 "exports.activate=async context=>{",
 " if(!same(process.env.SOTERAI_F20A_PRODUCT_ROOT||'/',expected)||vscode.workspace.workspaceFolders?.length!==1||!same(vscode.workspace.workspaceFolders[0].uri.fsPath,path.join(expected,'workspace')))return;",
 " const relative=path.relative(path.join(expected,'extensions'),context.extensionUri.fsPath);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))return;",
 " fs.writeFileSync(path.join(expected,'owned-close-command-01.json'),JSON.stringify({status:'CLOSE_WINDOW_COMMAND_REQUESTED',command:'workbench.action.closeWindow',root:expected,time:new Date().toISOString()})+'\\n',{flag:'wx'});",
 " context.subscriptions.push({dispose:()=>{try{fs.writeFileSync(path.join(expected,'owned-close-disposed-01.json'),JSON.stringify({status:'OWNED_CLOSE_FIXTURE_DISPOSED',time:new Date().toISOString()})+'\\n',{flag:'wx'});}catch{}}});",
 " setTimeout(()=>{void vscode.commands.executeCommand('workbench.action.closeWindow');},100);",
 "};exports.deactivate=()=>{};",""].join('\n');
fs.writeFileSync(path.join(base,'package.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});fs.writeFileSync(path.join(base,'close.cjs'),source,{flag:'wx'});
fs.writeFileSync(path.join(base,'README.md'),'Synthetic fixture: closes only the exact retained F20A test window through the editor closeWindow command. No process signals or normal-profile changes.\n',{flag:'wx'});
fs.writeFileSync(path.join(base,'LICENSE'),'Private synthetic test fixture; not a distributable product.\n',{flag:'wx'});
const output=path.join(__dirname,'close-owned-window-01.vsix');
vsce.createVSIX({cwd:base,packagePath:output,dependencies:false}).then(()=>{const b=fs.readFileSync(output);fs.writeFileSync(path.join(__dirname,'close-owned-window-package-01.json'),JSON.stringify({status:'LOCAL_FIXTURE_PACKAGED_NOT_INSTALLED',bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),scope:'Exact failed isolated profile only; workbench.action.closeWindow, no process killing'},null,2)+'\n',{flag:'wx'});console.log('LOCAL_OWNED_WINDOW_CLOSE_FIXTURE_READY');}).catch(e=>{console.error(e);process.exitCode=1;});
