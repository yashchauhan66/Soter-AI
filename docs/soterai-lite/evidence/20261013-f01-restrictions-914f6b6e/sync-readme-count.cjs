const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../../..');
const file='packages/vscode-extension/README.md';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'packages/vscode-extension/package.json'),'utf8'));
const count=Object.values(manifest.contributes.configuration.properties).filter(p=>p.scope==='machine').length;
// Recover the prior UTF-8 bytes; a Windows PowerShell default-encoding read
// would otherwise re-encode non-ASCII punctuation during the count-only edit.
const before=cp.execFileSync('git',['show','edf015a4:'+file],{cwd:root,encoding:'utf8'});
const after=before.replace(/The \d+ safety-relevant settings are `machine`-scoped/,'The '+count+' safety-relevant settings are `machine`-scoped');
fs.writeFileSync(path.join(root,file),after,'utf8');
console.log(JSON.stringify({status:'COUNT_SYNCED_UTF8',machineSettings:count}));
