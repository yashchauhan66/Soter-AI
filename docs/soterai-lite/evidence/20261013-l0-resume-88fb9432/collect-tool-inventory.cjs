// Public installed package metadata/source only. Never opens provider/account configs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const specs=[
 ['clineIde','C:/Users/USER/.vscode/extensions/saoudrizwan.claude-dev-4.1.23/package.json'],
 ['claudeIde','C:/Users/USER/.vscode/extensions/anthropic.claude-code-2.1.296-win32-x64/package.json'],
 ['codexIde','C:/Users/USER/.vscode/extensions/openai.chatgpt-26.51007.21434-win32-x64/package.json'],
 ['codexCli','C:/Users/USER/AppData/Roaming/npm/node_modules/@openai/codex/package.json'],
 ['geminiCli','C:/Users/USER/AppData/Roaming/npm/node_modules/@google/gemini-cli/package.json']
];
const tools=specs.map(([id,file])=>({id,path:file,version:json(file).version,packageSha256:sha(file),status:'STATIC-ONLY; ROUTE_UNVERIFIED'}));
const codexRuntime='C:/Users/USER/.vscode/extensions/openai.chatgpt-26.51007.21434-win32-x64/bin/windows-x86_64/codex-package.json';
tools.push({id:'codexIdeRuntime',path:codexRuntime,version:json(codexRuntime).version,sha256:sha(codexRuntime),status:'STATIC-ONLY; ROUTE_UNVERIFIED'});
const clineBundle='C:/Users/USER/.vscode/extensions/saoudrizwan.claude-dev-4.1.23/dist/extension.js';
const cline=fs.readFileSync(clineBundle,'utf8');
const sources=[{id:'clineInstalledHooks',path:clineBundle,sha256:sha(clineBundle),beforeToolLiteral:cline.includes('beforeTool hook failed'),windowsPowerShellDiscovery:cline.includes('findWindowsHook'),status:'STATIC-ONLY; error/timeout behavior must execute before route support'}];
const root=path.resolve(__dirname,'../../../..');
const pkg=json(path.join(root,'package.json')),lock=json(path.join(root,'package-lock.json'));
require('C:/Program Files/nodejs/node_modules/npm/node_modules/@npmcli/map-workspaces')({cwd:root,pkg}).then(map=>{
 const workspace=[...map.entries()].filter(([name,location])=>name.includes('soterai')&&(location.includes('soterai-lite')||location.includes('soterai-full')||location.endsWith('core')||location.endsWith('sdk'))).map(([name,location])=>({name,path:path.relative(root,location).replace(/\\/g,'/')}));
 if([...map.values()].some(location=>location===path.join(root,'packages/vscode-extension')))throw new Error('Compatibility source still registered');
 if(map.get('soterai-ide-guard')!==path.join(root,'packages/soterai-lite')||lock.packages['node_modules/soterai-ide-guard'].resolved!=='packages/soterai-lite')throw new Error('Lite workspace/lock mismatch');
 const output={status:'PASS_STATIC_INVENTORY_AND_WORKSPACE_MAP',tools,sources,workspace,compatibilitySourceExcluded:true,lockfileInstallReproduction:'NOT-RUN; no install/download performed',scope:'Public metadata only; no provider config/auth/account reads; inventory is not runtime protection evidence.'};
 fs.writeFileSync(path.join(__dirname,'installed-tool-and-workspace-inventory.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:output.status,tools:tools.map(t=>({id:t.id,version:t.version})),workspace}));
}).catch(error=>{console.error(error);process.exitCode=1;});
