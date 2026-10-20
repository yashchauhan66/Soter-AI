const fs=require('node:fs'),path=require('node:path');
const prior=path.resolve(__dirname,'../20261019-f20b-codex-ide-c7a309e2');
let inspect=fs.readFileSync(path.join(prior,'inspect-vsix-01.ps1'),'utf8').replaceAll('F20B','F20C').replaceAll('f20b','f20c').replaceAll('codexIdeAdapter','geminiCliAdapter').replaceAll('PinnedCodexIde','PinnedGeminiCli').replaceAll('codexIdeAdapterStatus','geminiCliAdapterStatus').replaceAll('67','69');
fs.writeFileSync(path.join(__dirname,'inspect-vsix-01.ps1'),inspect,{flag:'wx'});
