'use strict';
const fs=require('node:fs'),path=require('node:path');const code=fs.readFileSync('C:/Users/USER/.vscode/extensions/openai.chatgpt-26.51007.21434-win32-x64/out/extension.js','utf8'),rows=[];
for(const needle of['function oze(','"app-server"','startCodexProcess(){','stopCodexProcess(){','sendInternalAppServerRequest(','dispose(){this.codex','async function z3(','async function TNe(']){let cursor=0;for(let i=0;i<3;i++){const at=code.indexOf(needle,cursor);if(at<0)break;rows.push({needle,offset:at,code:code.slice(Math.max(0,at-150),at+1500)});cursor=at+needle.length;}}
fs.writeFileSync(path.join(__dirname,'public-process-lifecycle-03.json'),JSON.stringify({status:'STATIC_ONLY',rows},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS_STATIC',rows:rows.length}));
