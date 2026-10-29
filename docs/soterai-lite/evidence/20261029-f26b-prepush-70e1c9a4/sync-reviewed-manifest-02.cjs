const fs=require('node:fs'),assert=require('node:assert/strict');
const file='packages/soterai-lite/package.json',before=fs.readFileSync(file,'utf8'),lite=JSON.parse(before),canonical=JSON.parse(fs.readFileSync('packages/vscode-extension/package.json','utf8'));
fs.writeFileSync(__dirname+'/lite-manifest.before-push-02.json.txt',before,{flag:'wx'});
for(const field of ['contributes','activationEvents','capabilities'])lite[field]=canonical[field];
assert.equal(Object.values(lite.contributes.configuration.properties).filter(row=>row.scope==='machine').length,87);
fs.writeFileSync(file,JSON.stringify(lite,null,2)+'\n');
