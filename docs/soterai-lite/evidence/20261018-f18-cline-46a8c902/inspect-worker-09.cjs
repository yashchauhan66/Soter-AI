'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const bytes=fs.readFileSync('C:/Users/USER/.vscode/extensions/saoudrizwan.claude-dev-4.1.25/dist/extension.js');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'a3e8eda18b38547df9c614e62d04106cdf3bf2df2cb16241af3f7b3770088022');const source=bytes.toString('utf8');
const terms=['worker_threads','new Worker(','new WorkerThread','CLINE_RIPGREP_PATH','getRgPath','rgPath','startNewTask:','registerCommand("cline.addToChat"'];
const rows=terms.map(term=>{let cursor=0,positions=[];while((cursor=source.indexOf(term,cursor))>=0){positions.push(cursor);cursor+=term.length;}return {term,count:positions.length,excerpts:positions.slice(-3).map(offset=>({offset,text:source.slice(Math.max(0,offset-200),offset+800)}))};});
fs.writeFileSync(path.join(__dirname,'worker-source-excerpts-09.json'),JSON.stringify(rows,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(rows,null,2));
