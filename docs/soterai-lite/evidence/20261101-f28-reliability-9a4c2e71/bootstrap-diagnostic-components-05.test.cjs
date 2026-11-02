'use strict';const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
for(const [name,existing]of [['first immutable error',false],['second framed error',true]])test('Actual bootstrap diagnostic: '+name,async()=>{
 const source=fs.readFileSync(path.join(__dirname,process.env.F28_BOOTSTRAP_SOURCE||'native-bootstrap-05.cjs'),'utf8'),appends=[],writes=[];let present=existing;
 const io={writeFile:async(file,text)=>{if(present){const e=Error('exists');e.code='EEXIST';throw e;}present=true;writes.push({file,text});},stat:async()=>({size:0}),appendFile:async(file,text)=>{appends.push({file,text});}};
 const exports={},context={exports,require:name=>{if(name==='vscode')return{commands:{executeCommand:async()=>undefined}};if(name==='node:fs/promises')return io;return require(name);},process:{env:{SOTERAI_LITE_F28_EVIDENCE:'D:\\Synthetic-unused\\primary-results.json'}},Buffer,setTimeout:()=>{throw Error('No native activation allowed.');}};
 vm.runInNewContext(source+'\nglobalThis.diagnosticComponent=failure;',context);await context.diagnosticComponent('run',Error('synthetic-only'));
 if(existing){assert.equal(writes.length,0);assert.equal(appends.length,1);assert.equal(appends[0].text.charCodeAt(appends[0].text.length-1),10);assert.equal(JSON.parse(appends[0].text.trimEnd()).status,'FAIL');}else{assert.equal(writes.length,1);assert.equal(appends.length,0);assert.equal(JSON.parse(writes[0].text).status,'FAIL');}
});
