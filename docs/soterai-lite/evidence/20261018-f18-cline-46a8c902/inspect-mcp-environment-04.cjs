'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const data=fs.readFileSync('C:/Users/USER/.vscode/extensions/saoudrizwan.claude-dev-4.1.25/dist/extension.js');assert.equal(crypto.createHash('sha256').update(data).digest('hex'),'a3e8eda18b38547df9c614e62d04106cdf3bf2df2cb16241af3f7b3770088022');const text=data.toString('utf8');
const terms=['${env:','getDefaultEnvironment','INHERITED_ENV_VARS','env:{...process.env','...process.env,...','expandEnv','resolveEnvVariables'];
const result=terms.map(term=>{let cursor=0,offsets=[];while((cursor=text.indexOf(term,cursor))>=0){offsets.push(cursor);cursor+=term.length;}return{term,count:offsets.length,excerpts:offsets.slice(0,2).map(offset=>({offset,text:text.slice(Math.max(0,offset-130),offset+900).replace(/[A-Za-z0-9_-]{65,}/g,'[LONG_LITERAL_OMITTED]')}))};});
fs.writeFileSync(path.join(__dirname,'mcp-environment-excerpts-04.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result,null,2));
