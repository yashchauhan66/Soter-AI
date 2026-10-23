'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),out=path.join(__dirname,'ui-original-inputs-01');fs.mkdirSync(out);
const files=['packages/vscode-extension/src/extension.ts','packages/vscode-extension/package.json','packages/soterai-lite/package.json','packages/vscode-extension/README.md','packages/soterai-lite/README.md','packages/soterai-lite/CHANGELOG.md'];
const rows=files.map(file=>{const bytes=fs.readFileSync(path.join(repo,file)),target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});return {path:file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
fs.writeFileSync(path.join(__dirname,'ui-original-inputs-01.json'),JSON.stringify({status:'ORIGINAL_BYTES_BEFORE_F23_UI',files:rows},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'SAVED',files:rows.length}));
