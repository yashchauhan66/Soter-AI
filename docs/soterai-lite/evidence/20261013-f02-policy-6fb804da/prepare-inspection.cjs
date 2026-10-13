const fs=require('node:fs'),path=require('node:path');
const prior=path.resolve(__dirname,'../20261013-f01-restrictions-914f6b6e/inspect-vsix-attempt02.ps1');
const source=fs.readFileSync(prior,'utf8').replaceAll('soterai-lite-0.7.0-f01-20261013-attempt02.vsix','soterai-lite-0.7.0-f02-20261013-attempt02.vsix');
fs.writeFileSync(path.join(__dirname,'inspect-vsix-attempt02.ps1'),source,{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_NOT_RUN',artifact:'F02 attempt02',inspection:'Explicit 14-entry inventory plus fresh three-runtime provenance.'}));
