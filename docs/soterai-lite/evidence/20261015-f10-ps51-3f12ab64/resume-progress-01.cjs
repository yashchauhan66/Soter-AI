const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const repo = path.resolve(__dirname,'../../../..'), sha = b => crypto.createHash('sha256').update(b).digest('hex');
const files = [...fs.readdirSync(path.join(repo,'packages/vscode-extension/src/terminal')).filter(n=>n.endsWith('.ts')).map(n=>'packages/vscode-extension/src/terminal/'+n),
 ...fs.readdirSync(path.join(repo,'packages/vscode-extension/src/__tests__')).filter(n=>/^(?:checkedPowerShell|powerShell51|checkedGitMetadata|managedOutputFilter).*\.test\.ts$/.test(n)).map(n=>'packages/vscode-extension/src/__tests__/'+n),
 'packages/vscode-extension/src/extension.ts','packages/vscode-extension/src/firewall/commands.ts','packages/vscode-extension/src/project-privacy/commands.ts','packages/vscode-extension/src/ai-boundary/BoundarySnapshot.ts','packages/vscode-extension/package.json','packages/soterai-lite/package.json'];
const facts = files.map(p=>{const b=fs.readFileSync(path.join(repo,p));return{path:p,bytes:b.length,sha256:sha(b)};});
const receipts=fs.readdirSync(__dirname).filter(n=>n.endsWith('.result.json')).map(n=>{const value=JSON.parse(fs.readFileSync(path.join(__dirname,n),'utf8').replace(/^\uFEFF/,''));const file=path.isAbsolute(value.output)?value.output:path.join(repo,value.output);return{path:n,exitCode:value.exitCode,rawSha256:sha(fs.readFileSync(file)),receiptSha256:value.sha256.toLowerCase()};});
if(receipts.some(r=>r.rawSha256!==r.receiptSha256))throw new Error('Raw receipt mismatch');
fs.writeFileSync(path.join(__dirname,'resume-implementation-progress-01.json'),JSON.stringify({observedAt:new Date().toISOString(),status:'INCOMPLETE_F10_ONLY',files:facts,receipts},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'INCOMPLETE_F10_ONLY',sourceFiles:facts.length,rawReceiptsVerified:receipts.length}));
