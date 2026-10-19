'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const save=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'});
const ticketSource=fs.readFileSync(path.resolve(__dirname,'../../../../packages/vscode-extension/src/agent/SealedBridgeTicket.ts'),'utf8');
const script=ticketSource.match(/const script = `([^`]+)`;/)?.[1];if(!script)throw Error('Expected reviewed DPAPI script missing');
const hashes=['Protect','Unprotect'].map(operation=>crypto.createHash('sha256').update(script.replace('${operation}',operation)).digest('hex'));
let guard=read('product-test-guards-05.cjs');
guard=guard.replace(" const originalSpawn=cp.spawn;", ` let spawnPermit=0,privateCanary;records.deniedDirectSpawns=[];
 const spawnPrimitive=cp.ChildProcess.prototype.spawn;patch(cp.ChildProcess.prototype,'spawn',function(...args){if(!spawnPermit){records.deniedDirectSpawns.push('DIRECT_NATIVE_SPAWN_REFUSED');throw Object.assign(Error('Direct native spawn refused'),{code:'EACCES'});}return Reflect.apply(spawnPrimitive,this,args);});
 const originalSpawn=cp.spawn;`);
guard=guard.replace("&&inside(argv[0])&&/[\\\\/]dist[\\\\/](?:local-ai-broker|soterai-mcp-server)[.]js$/.test(argv[0]))allowed=true;", "&&typeof argv[0]==='string'&&['local-ai-broker.js','soterai-mcp-server.js'].some(name=>path.resolve(argv[0]).toLowerCase()===path.resolve(root,'extension/dist',name).toLowerCase())&&(argv.length===1||argv.length===2&&argv[1]==='--cline-hook')&&!options.shell)allowed=true;");
const start=guard.indexOf(" if(['powershell.exe'"),end=guard.indexOf(" if(!allowed)",start);if(start<0||end<0)throw Error('Expected spawn review block missing');
guard=guard.slice(0,start)+` if(['powershell.exe','powershell','pwsh.exe','pwsh'].includes(base)){
  const approvedHashes=new Set(${JSON.stringify(hashes)}),last=argv.at(-1),prefix=argv.slice(0,-2);
  const version=last==='$PSVersionTable.PSVersion'&&argv.at(-2)==='-Command'&&argv.length<=6&&prefix.every(value=>['-NoLogo','-NoProfile','-NonInteractive'].includes(value));
  const dpapi=argv.length===5&&argv.slice(0,4).join('|')==='-NoLogo|-NoProfile|-NonInteractive|-Command'&&approvedHashes.has(require('node:crypto').createHash('sha256').update(String(last)).digest('hex'))&&path.resolve(executable).toLowerCase()===path.resolve(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe').toLowerCase();
  const hook=typeof last==='string'&&['TaskStart.ps1','PreToolUse.ps1'].some(name=>path.resolve(last).toLowerCase()===path.resolve(root,'workspace/.clinerules/hooks',name).toLowerCase())&&argv.at(-2)==='-File'&&argv.length<=9&&prefix.every(value=>['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass'].includes(value));
  allowed=!options.shell&&(version||dpapi||hook);
 }
`+guard.slice(end);
guard=guard.replace("const child=Reflect.apply(originalSpawn,this,args),row={role:", "let child;spawnPermit++;try{child=Reflect.apply(originalSpawn,this,args);}finally{spawnPermit--;}const row={phase:records.phase,role:");
guard=guard.replace("children.push(row);", "children.push(row);if(['TaskStart','PreToolUse'].includes(row.role)){let input='',size=0;const observe=value=>{if(typeof value==='string'||Buffer.isBuffer(value)){size+=Buffer.byteLength(value);if(size<=8192){input+=value.toString();if(privateCanary&&input.includes(privateCanary))row.privateInputSeen=true;}}};for(const method of ['write','end']){const original=child.stdin[method];child.stdin[method]=function(value,...args){observe(value);return Reflect.apply(original,this,[value,...args]);};}}");
guard=guard.replace("return {children};", `records.deniedWorkerLaunches=[];try{const threads=require('node:worker_threads');patch(threads,'Worker',class{constructor(){records.deniedWorkerLaunches.push('WORKER_REFUSED');throw Error('Unreviewed worker refused');}});}catch{}
return {children,setPrivateCanary:value=>{privateCanary=value;}};`);
save('matrix-guards-01.cjs',guard);
let probe=read('product-probe-08.cjs').replaceAll('product-test-guards-05.cjs','matrix-guards-01.cjs');
probe=probe.replace(" if(context!==captured)"," if(context!==captured)");
probe=probe.replace(" guard=require('./matrix-guards-01.cjs').install(root,records);", ` guard=require('./matrix-guards-01.cjs').install(root,records);records.deniedNativeExecution=[];
 for(const [owner,key,label]of [[vscode.window,'createTerminal','terminal'],[vscode.tasks,'executeTask','task'],[vscode.debug,'startDebugging','debug']])Object.defineProperty(owner,key,{configurable:true,writable:true,value:()=>{records.deniedNativeExecution.push(label);throw Error('Unreviewed editor process launch refused');}});
 Object.defineProperty(vscode.env,'openExternal',{configurable:true,writable:true,value:async()=>{records.deniedNativeExecution.push('external-open');return false;}});
 const command=vscode.commands.executeCommand;Object.defineProperty(vscode.commands,'executeCommand',{configurable:true,writable:true,value:function(name,...args){if(/^workbench[.]action[.](?:terminal|tasks|debug)/.test(name)){records.deniedNativeExecution.push('command');throw Error('Unreviewed native editor command refused');}return Reflect.apply(command,this,[name,...args]);}});`);
probe=probe.replace("if(message.startsWith('Review pinned Cline'))return decide==='apply'?'Apply reviewed Cline changes':undefined;", "if(message.startsWith('Review pinned Cline'))return decide==='apply'?actions.find(action=>['Apply reviewed Cline changes','Restore reviewed Cline config'].includes(action)):undefined;");
probe=probe.replace('supportsImages:false','supportsImages:true').replace("capabilities:['streaming','tools']","capabilities:['streaming','tools','images']");
probe=probe.replace("privateValue=canary.token;await manager.stop();", "privateValue=canary.token;guard.setPrivateCanary(privateValue);await manager.stop();");
probe=probe.replace("if(privateValue&&text.includes(privateValue))throw Error('Original private canary reached upstream');", "if(privateValue&&text.includes(privateValue)){records.privateOriginalLeak=true;records.leakScenario=scenario;throw Error('Original private canary reached upstream');}");
probe=probe.replace("records.requests.length>=8", "records.requests.length>=40");
probe=probe.replace("privateOriginal:false,tools:actualTools", "privateOriginal:false,envSchemaSeen:text.includes('F18_TOKEN')&&text.includes('[MASKED]'),tools:actualTools");
probe=probe.replace("   if(scenario==='mcp-public'", `   const workspace=vscode.workspace.workspaceFolders[0].uri.fsPath,safeName=actualTools.find(name=>name.includes('read_project_file_safely'));
   const routes={
    'mcp-env':{name:safeName,args:{path:'.env'}},
    'native-public':{name:'read_files',args:{files:[{path:path.join(workspace,'public.txt'),start_line:1,end_line:null}]}},
    'editor-public':{name:'editor',args:{path:path.join(workspace,'public.txt'),old_text:PUBLIC.trim(),new_text:PUBLIC.trim()+' F18_PUBLIC_EDITOR_DONE',insert_line:null}},
    'editor-private':{name:'editor',args:{path:path.join(workspace,'.env'),old_text:'PORT=1234',new_text:'PORT=1235'}},
    'self-hook':{name:'editor',args:{path:path.join(workspace,'.clinerules/hooks/TaskStart.ps1'),new_text:'DISABLED_SYNTHETIC_HOOK'}},
    'search-private':{name:'search_codebase',args:{queries:['F18_TOKEN']}},
    'terminal-private':{name:'run_commands',args:{commands:['Get-Content .env']}},
    'git-private':{name:'run_commands',args:{commands:['git log --all --oneline']}}
   };const selected=routes[scenario];if(selected&&stageRequests===1){if(!selected.name)throw Error('Expected tool unavailable');response(res,{role:'assistant',tool_calls:[{index:0,id:'f18-matrix-'+scenario,type:'function',function:{name:selected.name,arguments:JSON.stringify(selected.args)}}]},'tool_calls');return;}
   if(scenario==='mcp-public'`);
probe=probe.replace("scenario='mcp-public';", "records.phase=scenario='mcp-public';").replace("scenario='native-private';", "records.phase=scenario='native-private';").replace("scenario='withdrawn';", "records.phase=scenario='withdrawn';");
probe=probe.replace("  const files=()=>", "  let originalFiles;\n  const paths=()=>{const settings=path.join(process.env.USERPROFILE,'.cline/data/settings'),workspace=vscode.workspace.workspaceFolders[0].uri.fsPath;return ['providers.json','cline_mcp_settings.json','global-settings.json'].map(name=>path.join(settings,name)).concat(['PreToolUse.ps1','TaskStart.ps1'].map(name=>path.join(workspace,'.clinerules/hooks',name)));};\n  originalFiles=paths().map(file=>fs.existsSync(file)?digest(fs.readFileSync(file)):null);records.routeFindings=[];\n  const files=()=>");
const marker="  await check('F18-P06',async()=>";if(!probe.includes(marker))throw Error('Expected withdrawal insertion point missing');
probe=probe.replace(marker,`  const waitTask=async(name,prompt='Perform the next synthetic local fixture step.',images=[])=>{records.phase=scenario=name;stageRequests=0;await api.startNewTask(prompt,images);};
  const cancelled=name=>guard.children.some(item=>item.phase===name&&item.role==='PreToolUse'&&item.hookCancel===true&&item.closed);
  const refused=async(id,name)=>{await check(id,async()=>{await waitTask(name);await until(()=>stageRequests>=1);await new Promise(done=>setTimeout(done,1200));if(!cancelled(name))await api.pressPrimaryButton();await until(()=>cancelled(name));records.routeFindings.push({surface:name,result:'VENDOR_HOOK_CANCEL',coverage:'Vendor-controls-only'});});};
  await check('F18-P07',async()=>{await waitTask('mcp-env');await until(()=>records.requests.some(item=>item.scenario==='mcp-env'&&item.envSchemaSeen));records.routeFindings.push({surface:'MCP environment',result:'APPROVED_NAMES_AND_MASKS',coverage:'Scoped managed route'});});
  await check('F18-P08',async()=>{await waitTask('native-public');await until(()=>records.requests.some(item=>item.scenario==='native-public'&&item.publicSeen));records.routeFindings.push({surface:'native file',result:'PUBLIC_CONTROL',coverage:'Vendor-controls-only'});});
  await check('F18-P09',async()=>{await waitTask('editor-public');await until(()=>fs.readFileSync(path.join(workspace,'public.txt'),'utf8').includes('F18_PUBLIC_EDITOR_DONE'));await until(()=>stageRequests>=2);records.routeFindings.push({surface:'native editor',result:'PUBLIC_WRITE',coverage:'Vendor-controls-only'});});
  const envBefore=digest(fs.readFileSync(path.join(workspace,'.env'))),hookBefore=digest(fs.readFileSync(path.join(workspace,'.clinerules/hooks/TaskStart.ps1')));
  await refused('F18-P10','editor-private');if(digest(fs.readFileSync(path.join(workspace,'.env')))!==envBefore)records.privateFileChanged=true;
  await refused('F18-P11','self-hook');if(digest(fs.readFileSync(path.join(workspace,'.clinerules/hooks/TaskStart.ps1')))!==hookBefore)records.ownedHookChanged=true;
  await refused('F18-P12','search-private');await refused('F18-P13','terminal-private');await refused('F18-P14','git-private');
  await check('F18-P15',async()=>{await waitTask('context-public','Review @/public.txt in this synthetic fixture.');await until(()=>records.requests.some(item=>item.scenario==='context-public'&&item.publicSeen));records.routeFindings.push({surface:'file mention/context',result:'PUBLIC_ORIGINAL_CONTEXT',coverage:'Uncovered native read'});});
  await check('F18-P16',async()=>{await waitTask('context-private','Review @/.env in this synthetic fixture.');await until(()=>guard.children.some(item=>item.phase==='context-private'&&item.privateInputSeen===true));await new Promise(done=>setTimeout(done,1500));if(stageRequests!==0)throw Error('Private context forwarded');records.routeFindings.push({surface:'private file mention/context',result:'ORIGINAL_ENTERED_VENDOR_WITH_PROVIDER_WITHHELD',coverage:'Uncovered native read; registered egress withheld'});});
  await check('F18-P17',async()=>{const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1sAAAAASUVORK5CYII=';await waitTask('image-public','Review this synthetic one-pixel attachment.',[image]);await until(()=>guard.children.some(item=>item.phase==='image-public'&&item.role==='TaskStart'&&item.hookCancel===false));await new Promise(done=>setTimeout(done,2000));if(stageRequests!==0)throw Error('Unsupported image forwarded');records.routeFindings.push({surface:'image attachment',result:'WITHHELD_UNSUPPORTED_TEXT_GATEWAY',coverage:'Uncovered; no image functionality claimed'});});
  await check('F18-P18',async()=>{const file=paths()[0],before=fs.readFileSync(file);fs.writeFileSync(file,Buffer.concat([before,Buffer.from(' ')]));try{const result=await vscode.commands.executeCommand('soterai.restorePinnedCline');if(result?.status!=='CHANGED')throw Error('Drift restoration not withheld');}finally{fs.writeFileSync(file,before);}});
`+marker);
probe=probe.replace(" }catch(error){records.driverFailure", `  await config.update('lite.clineAdapter',true,vscode.ConfigurationTarget.Global);
  await check('F18-P19',async()=>{decide='cancel';const before=paths().map(file=>digest(fs.readFileSync(file)));const result=await vscode.commands.executeCommand('soterai.restorePinnedCline');if(result?.status!=='CANCELLED'||JSON.stringify(before)!==JSON.stringify(paths().map(file=>digest(fs.readFileSync(file)))))throw Error('Restoration cancellation failed');});
  await check('F18-P20',async()=>{decide='apply';const result=await vscode.commands.executeCommand('soterai.restorePinnedCline');if(result?.status!=='RESTORED')throw Error('Restoration failed');const after=paths().map(file=>fs.existsSync(file)?digest(fs.readFileSync(file)):null);if(JSON.stringify(after)!==JSON.stringify(originalFiles))throw Error('Exact previous configuration not restored');const backups=fs.readdirSync(path.join(context.globalStorageUri.fsPath,'config-backups'));if(backups.length<5)throw Error('Encrypted backups missing');records.retainedEncryptedBackups=backups.length;});
 }catch(error){records.driverFailure`);
probe=probe.replace("records.checks.length===6", "records.checks.length===20").replace("&&!records.childShutdown?'PASS_SCOPED_PRODUCT_PROBE'", "&&!records.childShutdown&&!records.privateOriginalLeak&&!records.privateFileChanged&&!records.ownedHookChanged?'PASS_SCOPED_PRODUCT_PROBE'");
save('product-matrix-01.cjs',probe);
let launch=read('run-product-probe-14.ps1').replaceAll('product-probe-08.cjs','product-matrix-01.cjs').replaceAll('product-test-guards-05.cjs','matrix-guards-01.cjs').replaceAll('vsix-inspection-07.json','vsix-inspection-08.json');
save('run-product-matrix-01.ps1',launch);
let build=read('build-candidate-11.ps1').replace("'typecheck-13'","'typecheck-14'").replace("'broker-typecheck-04'","'broker-typecheck-05'").replace("'focused-09'","'focused-10'").replace("'package-07'","'package-08'").replace("'clineMcpToolName'","'clineMcpToolName','clineNativePaths'").replaceAll('f18-20261019-attempt07.vsix','f18-20261019-attempt08.vsix').replace("-InspectionName '07'","-InspectionName '08'");
save('build-candidate-12.ps1',build);
