'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const bytes=fs.readFileSync('C:/Users/USER/.vscode/extensions/saoudrizwan.claude-dev-4.1.25/dist/extension.js');
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'a3e8eda18b38547df9c614e62d04106cdf3bf2df2cb16241af3f7b3770088022');const source=bytes.toString('utf8');
const terms=['providers.json','tokenSource:"migration"','TaskStart.ps1','PreToolUse.ps1','name:"read_files"','name:"search_codebase"','name:"editor"','name:"run_commands"','mcp__','getGlobalSettingsKey("hooksEnabled")','getGlobalStateKey("hooksEnabled")'];
const result=terms.map(term=>{let cursor=0,offsets=[];while((cursor=source.indexOf(term,cursor))>=0){offsets.push(cursor);cursor+=term.length;}return {term,count:offsets.length,excerpts:offsets.slice(0,3).map(offset=>({offset,text:source.slice(Math.max(0,offset-300),offset+1200)}))};});
fs.writeFileSync(path.join(__dirname,'routing-source-excerpts-05.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result,null,2));
