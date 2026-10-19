'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const bytes=fs.readFileSync('C:/Users/USER/.vscode/extensions/saoudrizwan.claude-dev-4.1.25/dist/extension.js');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'a3e8eda18b38547df9c614e62d04106cdf3bf2df2cb16241af3f7b3770088022');const source=bytes.toString('utf8');
const terms=['tokenSource','openAiApiKey','settings.apiKey','getProviderSettings','openai-compatible','extraHeaders'];
const results=terms.map(term=>{let cursor=0,offsets=[];while((cursor=source.indexOf(term,cursor))>=0){offsets.push(cursor);cursor+=term.length;}return {term,count:offsets.length,excerpts:offsets.filter(offset=>offset>12000000).slice(-8).map(offset=>({offset,text:source.slice(Math.max(0,offset-350),offset+700)}))};});
fs.writeFileSync(path.join(__dirname,'credential-source-excerpts-06.json'),JSON.stringify(results,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(results,null,2));
