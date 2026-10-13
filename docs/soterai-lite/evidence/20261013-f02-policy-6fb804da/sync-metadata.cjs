const fs=require('node:fs');
const manifest=JSON.parse(fs.readFileSync('packages/vscode-extension/package.json','utf8'));
const count=Object.values(manifest.contributes.configuration.properties).filter(value=>value.scope==='machine').length;
const file='packages/vscode-extension/README.md';
fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/The \d+ safety-relevant settings are `machine`-scoped/,`The ${count} safety-relevant settings are \`machine\`-scoped`),'utf8');
console.log(JSON.stringify({status:'PASS',machineSettings:count}));
