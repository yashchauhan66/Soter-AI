'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const file='C:/Users/USER/AppData/Local/Temp/soterai-f20a-owner-8aKfWc/profile/globalStorage/adapter-sessions/codex-cli-4de928d1-6d3e-4d19-a8f7-7bb8d6ff6115/recovery.json';
const fact=s=>({dev:s.dev,ino:s.ino,nlink:s.nlink,size:s.size,isFile:s.isFile(),symbolic:s.isSymbolicLink()});
(async()=>{assert.ok(file.includes('/soterai-f20a-owner-'));const h=await fs.open(file,'r');try{const result={file,opened:fact(await h.stat()),named:fact(await fs.lstat(file)),realpath:await fs.realpath(file),resolved:path.resolve(file)};await fs.writeFile(path.join(__dirname,'owned-file-diagnostic-01.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));}finally{await h.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
