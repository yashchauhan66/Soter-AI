const fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'../../../..'),canonical=JSON.parse(fs.readFileSync(path.join(repo,'packages/vscode-extension/package.json'),'utf8'));
const litePath=path.join(repo,'packages/soterai-lite/package.json'),lite=JSON.parse(fs.readFileSync(litePath,'utf8'));
for(const key of ['contributes','activationEvents','capabilities'])lite[key]=canonical[key];
fs.writeFileSync(litePath,JSON.stringify(lite,null,4)+'\n');
console.log(JSON.stringify({status:'METADATA_SYNCED_NOT_TESTED',settings:Object.keys(canonical.contributes.configuration.properties).filter(key=>canonical.contributes.configuration.properties[key].scope==='machine').length}));
