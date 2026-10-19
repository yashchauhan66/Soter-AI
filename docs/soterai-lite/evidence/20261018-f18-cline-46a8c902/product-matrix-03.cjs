'use strict';
// Actual product/vendor fixture, scripted native APIs, LOW independence.
const vscode=require('vscode'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),cp=require('node:child_process');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const PUBLIC='F18_NATIVE_PUBLIC_CONTROL_20261018\n',UPSTREAM='TEST_ONLY_F18_UPSTREAM_KEY',ORIGINAL='TEST_ONLY_F18_ORIGINAL_PROVIDER_KEY';
let captured,api,vendorActual,permit,server,vendorActivation,ownedCredential,privateValue='',scenario='idle',stageRequests=0,root,records,guard,decide='apply';
const until=async(fn,ms=15000)=>{const deadline=Date.now()+ms;while(Date.now()<deadline){if(await fn())return;await new Promise(done=>setTimeout(done,25));}throw Error('Native fixture deadline');};
const safeError=error=>({name:error?.name||'Error',code:typeof error?.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:undefined});
exports.beforeActivate=async context=>{
 captured=context;root=process.env.SOTERAI_F18_PRODUCT_ROOT;
 if(!root||!path.resolve(root).toLowerCase().startsWith('d:\\soterai-lite-test-profiles\\f18-product-'))throw Error('Explicit isolated product root required');
 records={scope:'ACTUAL_PACKAGED_PRODUCT_AND_PINNED_CLINE_SCRIPTED_APIS',independence:'LOW',checks:[],modals:[],requests:[],phase:'setup'};
 guard=require('./matrix-guards-01.cjs').install(root,records);records.deniedNativeExecution=[];
 for(const [owner,key,label]of [[vscode.window,'createTerminal','terminal'],[vscode.tasks,'executeTask','task'],[vscode.debug,'startDebugging','debug']])Object.defineProperty(owner,key,{configurable:true,writable:true,value:()=>{records.deniedNativeExecution.push(label);throw Error('Unreviewed editor process launch refused');}});
 records.immutableNativeApis=['env.openExternal']; // Public API is nonconfigurable; no external-open scenario is issued. No OS traffic claim.
 const command=vscode.commands.executeCommand;Object.defineProperty(vscode.commands,'executeCommand',{configurable:true,writable:true,value:function(name,...args){if(/^workbench[.]action[.](?:terminal|tasks|debug)/.test(name)){records.deniedNativeExecution.push('command');throw Error('Unreviewed native editor command refused');}return Reflect.apply(command,this,[name,...args]);}});
 for(const name of ['showInformationMessage','showErrorMessage'])Object.defineProperty(vscode.window,name,{configurable:true,writable:true,value:async()=>undefined});
 Object.defineProperty(vscode.window,'showWarningMessage',{configurable:true,writable:true,value:async(message,options,...actions)=>{
  if(options?.modal){const detail=String(options.detail||'');if(privateValue&&detail.includes(privateValue))throw Error('Private canary entered native preview');
   records.modals.push({kind:message.startsWith('Allow one safe read')?'read':message.startsWith('Review pinned Cline')?'config':'other',bytes:Buffer.byteLength(detail),digest:digest(detail)});
   if(message.startsWith('Review pinned Cline'))return decide==='apply'?actions.find(action=>['Apply reviewed Cline changes','Restore reviewed Cline config'].includes(action)):undefined;
   if(message.startsWith('Allow one safe read'))return 'Allow safe read once';
  }return undefined;
 }});
 let release;permit=new Promise(done=>{release=done;});globalThis.__SOTERAI_F18_RELEASE_VENDOR__=release;
 globalThis.__SOTERAI_F18_ACTIVATE_VENDOR__=async vendorContext=>{
  const info={maxTokens:4096,contextWindow:128000,supportsImages:true,supportsPromptCache:false,inputPrice:0,outputPrice:0};
  const settings={apiProvider:'openai',planModeApiProvider:'openai',actModeApiProvider:'openai',openAiBaseUrl:records.providerUrl,openAiModelId:'f18-loopback',planModeOpenAiModelId:'f18-loopback',actModeOpenAiModelId:'f18-loopback',openAiModelInfo:info,planModeOpenAiModelInfo:info,actModeOpenAiModelInfo:info,mode:'act',telemetrySetting:'disabled',optOutOfRemoteConfig:true,openTelemetryEnabled:false,mcpMarketplaceEnabled:false,enableCheckpointsSetting:false,subagentsEnabled:false,worktreesEnabled:false,cloudSessionsEnabled:false,welcomeViewCompleted:true,isNewUser:false,hooksEnabled:true,autoApprovalSettings:{enabled:true,version:1,maxRequests:10,enableNotifications:false,actions:{readFiles:true,readFilesExternally:false,editFiles:false,executeSafeCommands:false,executeAllCommands:false,useBrowser:false,useMcp:true}}};
  for(const[key,value]of Object.entries(settings))await vendorContext.globalState.update(key,value);
  await vendorContext.secrets.store('openAiApiKey',ORIGINAL);
  const data=path.join(process.env.USERPROFILE,'.cline/data/settings');fs.mkdirSync(data,{recursive:true});
  fs.writeFileSync(path.join(data,'global-settings.json'),JSON.stringify({autoUpdateEnabled:false,telemetryOptOut:true}));
  fs.writeFileSync(path.join(data,'../globalState.json'),JSON.stringify(settings));
  fs.writeFileSync(path.join(data,'providers.json'),JSON.stringify({version:1,lastUsedProvider:'openai-compatible',modes:{},providers:{'openai-compatible':{settings:{provider:'openai-compatible',apiKey:ORIGINAL,model:'f18-loopback',baseUrl:records.providerUrl},updatedAt:new Date().toISOString(),tokenSource:'migration'}}}));
  fs.writeFileSync(path.join(data,'models.json'),JSON.stringify({version:1,providers:{'openai-compatible':{provider:{name:'OpenAI Compatible',baseUrl:records.providerUrl,defaultModelId:'f18-loopback'},models:{'f18-loopback':{id:'f18-loopback',name:'f18-loopback',maxTokens:4096,contextWindow:128000,maxInputTokens:128000,capabilities:['streaming','tools','images']}}}}}));
  fs.writeFileSync(path.join(data,'cline_mcp_settings.json'),JSON.stringify({mcpServers:{}}));
  // Preserve the original package bytes on disk for the product's exact-artifact
  // gate. Loaded bootstrap instrumentation is disclosed by the launch receipt.
  const original=fs.readFileSync(path.join(vendorContext.extensionUri.fsPath,'.f18-original-package.json'));fs.writeFileSync(path.join(vendorContext.extensionUri.fsPath,'package.json'),original);
  records.vendorPrepared=true;await permit;
  vendorActual=require(path.join(vendorContext.extensionUri.fsPath,'dist/extension.js'));
  api=await vendorActual.activate(vendorContext);return api;
 };
};
function response(res,delta,reason='stop'){
 res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store'});
 res.end('data: '+JSON.stringify({id:'f18',object:'chat.completion.chunk',created:1,model:'f18-loopback',choices:[{index:0,delta,finish_reason:null}]})+'\n\ndata: '+JSON.stringify({id:'f18',object:'chat.completion.chunk',created:1,model:'f18-loopback',choices:[{index:0,delta:{},finish_reason:reason}]})+'\n\ndata: [DONE]\n\n');
}
exports.run=async context=>{
 if(context!==captured)throw Error('Context binding changed');
 const check=async(id,fn)=>{try{await fn();records.checks.push({id,status:'PASS'});}catch(error){records.checks.push({id,status:'FAIL',error:safeError(error)});}};
 let manager,approvalTimer;
 try{
  manager=context.subscriptions.find(item=>typeof item.ownedSnapshot==='function');if(!manager)throw Error('Packaged owner unavailable');
  records.brokerStages=[];const tokenMethod=manager.getClientToken;manager.getClientToken=async function(){try{const value=await Reflect.apply(tokenMethod,this,[]);ownedCredential=value;records.tokenShape={type:typeof value,length:value?.length,whitespace:typeof value==='string'&&/[\x00-\x20\x7f]/.test(value)};return value;}catch(error){records.tokenFailure={error:safeError(error),state:this.ownedSnapshot().state};throw error;}};for(const method of ['start','stop']){const original=manager[method];manager[method]=async function(...args){try{const result=await Reflect.apply(original,this,args);records.brokerStages.push({method,state:this.ownedSnapshot().state,running:result?.running,urlShape:result?.url?new URL(result.url).pathname:undefined});return result;}catch(error){records.brokerStages.push({method,state:this.ownedSnapshot().state,error:safeError(error)});throw error;}};}
  records.clientRequests=[];const parentFetch=globalThis.fetch;globalThis.fetch=async function(input,init){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);let row;if(url.pathname.startsWith('/v1/ai/openai-compatible')&&records.clientRequests.length<16){const headers=new Headers(init?.headers??input?.headers);row={path:url.pathname,authCurrent:headers.get('authorization')==='Bearer '+ownedCredential,authOriginal:headers.get('authorization')==='Bearer '+ORIGINAL};records.clientRequests.push(row);}try{const result=await parentFetch(input,init);if(row)row.status=result.status;return result;}catch(error){if(row)row.error=safeError(error);throw error;}};
  const adapter=context.subscriptions.find(item=>typeof item.configure==='function'&&typeof item.undo==='function');records.controllerStages=[];
  if(adapter)for(const name of ['artifact','eligible','read','write','configuredFiles']){const original=adapter[name];if(typeof original==='function')adapter[name]=async function(...args){try{const value=await Reflect.apply(original,this,args);if(records.controllerStages.length<256)records.controllerStages.push({stage:name,file:name==='read'||name==='write'?path.basename(args[0]):undefined,status:'RETURNED',...(typeof value==='boolean'?{value}:{}),...(typeof value==='string'?{bytes:Buffer.byteLength(value)}:{})});return value;}catch(error){if(records.controllerStages.length<128)records.controllerStages.push({stage:name,file:name==='read'||name==='write'?path.basename(args[0]):undefined,status:'FAILED',error:safeError(error)});throw error;}};}
  server=http.createServer(async(req,res)=>{try{
   if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({object:'list',data:[{id:'f18-loopback',object:'model',owned_by:'fixture'}]}));return;}
   let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>262144)throw Error('Too large');chunks.push(chunk);}const body=JSON.parse(Buffer.concat(chunks).toString('utf8')),text=JSON.stringify(body),tools=body.tools||[];
   if(privateValue&&text.includes(privateValue)){records.privateOriginalLeak=true;records.leakScenario=scenario;throw Error('Original private canary reached upstream');}
   const actualTools=tools.map(item=>item.function?.name).filter(Boolean),publicSeen=text.includes(PUBLIC.trim()),upstreamAuth=req.headers.authorization==='Bearer '+UPSTREAM;
   if(records.requests.length>=40){records.fixtureRequestBudget=true;res.writeHead(429);res.end('{}');return;}
   records.requests.push({scenario,route:req.url,bytes:size,upstreamAuth,publicSeen,privateOriginal:false,envSchemaSeen:text.includes('F18_TOKEN')&&text.includes('[MASKED]'),tools:actualTools});stageRequests++;
   if(!upstreamAuth){response(res,{role:'assistant',content:'Unverified route refused.'});return;}
   const schema=JSON.stringify(tools);if(!schema.includes(privateValue||'__never__')&&!schema.includes(UPSTREAM)&&!schema.includes(ORIGINAL)){
    const file=path.join(root,'tool-schemas.json');if(!fs.existsSync(file))fs.writeFileSync(file,schema+'\n',{flag:'wx'});
   }
   const workspace=vscode.workspace.workspaceFolders[0].uri.fsPath,safeName=actualTools.find(name=>name.includes('read_project_file_safely'));
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
   if(scenario==='mcp-public'&&stageRequests===1){const name=actualTools.find(item=>item.includes('read_project_file_safely'));if(!name){records.missingSafeTool=true;response(res,{role:'assistant',content:'Safe tool unavailable.'});return;}
    response(res,{role:'assistant',tool_calls:[{index:0,id:'f18-public',type:'function',function:{name,arguments:JSON.stringify({path:'public.txt'})}}]},'tool_calls');return;}
   if(scenario==='native-private'&&stageRequests===1){response(res,{role:'assistant',tool_calls:[{index:0,id:'f18-private',type:'function',function:{name:'read_files',arguments:JSON.stringify({path:'.env'})}}]},'tool_calls');return;}
   response(res,{role:'assistant',content:'<attempt_completion><result>Synthetic local route probe complete.</result></attempt_completion>'});
  }catch{records.providerFailure=true;res.writeHead(400,{'content-type':'application/json'});res.end('{"error":{"message":"Synthetic route refused"}}');}});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));records.providerUrl='http://127.0.0.1:'+server.address().port+'/v1';
  const config=vscode.workspace.getConfiguration('soterai');await config.update('broker.openAIProviderUrl',records.providerUrl,vscode.ConfigurationTarget.Global);await context.secrets.store('soterai.providerApiKey',UPSTREAM);
  const canaries=Reflect.get(manager,'canaries'),canary=await canaries.create();privateValue=canary.token;guard.setPrivateCanary(privateValue);await manager.stop();
  const workspace=vscode.workspace.workspaceFolders[0].uri.fsPath;fs.writeFileSync(path.join(workspace,'public.txt'),PUBLIC);fs.writeFileSync(path.join(workspace,'.env'),'F18_TOKEN='+privateValue+'\nPORT=1234\n');
  const extension=vscode.extensions.getExtension('saoudrizwan.claude-dev');if(!extension)throw Error('Pinned vendor missing');vendorActivation=extension.activate();await until(()=>records.vendorPrepared===true);records.vendorVersion=extension.packageJSON.version;
  if(adapter){const original=adapter.withdraw;adapter.withdraw=function(...args){records.withdrawals??=[];records.withdrawals.push({state:manager.ownedSnapshot().state,stack:new Error().stack.split('\n').slice(2,5).map(line=>line.replace(/.*[\\/]/,'').replace(/:[0-9]+:[0-9]+\)?$/,''))});return Reflect.apply(original,this,args);};}
  let originalFiles;
  const paths=()=>{const settings=path.join(process.env.USERPROFILE,'.cline/data/settings'),workspace=vscode.workspace.workspaceFolders[0].uri.fsPath;return ['providers.json','cline_mcp_settings.json','global-settings.json'].map(name=>path.join(settings,name)).concat(['PreToolUse.ps1','TaskStart.ps1'].map(name=>path.join(workspace,'.clinerules/hooks',name)));};
  originalFiles=paths().map(file=>fs.existsSync(file)?digest(fs.readFileSync(file)):null);records.routeFindings=[];
  const files=()=>{const settings=path.join(process.env.USERPROFILE,'.cline/data/settings');return['providers.json','cline_mcp_settings.json','global-settings.json'].map(name=>digest(fs.readFileSync(path.join(settings,name))));};
  await check('F18-P02',async()=>{const before=files();decide='cancel';const result=await vscode.commands.executeCommand('soterai.configurePinnedCline');records.cancelStatus=result?.status;if(result?.status!=='CANCELLED')throw Error('Cancel status unavailable');if(JSON.stringify(files())!==JSON.stringify(before))throw Error('Cancel changed vendor files');});
  await check('F18-P03',async()=>{decide='apply';const result=await vscode.commands.executeCommand('soterai.configurePinnedCline');records.configureStatus=result?.status;if(result?.status!=='APPLIED')throw Error('Current product configuration unavailable');
   records.directHook=await new Promise(resolve=>{
    const child=cp.spawn(process.execPath,[path.join(context.extensionUri.fsPath,'dist/soterai-mcp-server.js'),'--cline-hook'],{cwd:workspace,windowsHide:true,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,USERPROFILE:process.env.USERPROFILE,APPDATA:process.env.APPDATA,LOCALAPPDATA:process.env.LOCALAPPDATA,TEMP:process.env.TEMP,TMP:process.env.TMP,ELECTRON_RUN_AS_NODE:'1',SOTERAI_SAFE_READ_TICKET_PATH:path.join(context.globalStorageUri.fsPath,'adapter-sessions/cline-session.ticket'),SOTERAI_CLINE_WORKSPACE:workspace},stdio:['pipe','pipe','pipe']});
    let chunks=[],size=0,errBytes=0;const timer=setTimeout(()=>resolve({status:'INCOMPLETE_TIMEOUT'}),10000);timer.unref();child.stdout.on('data',chunk=>{size+=chunk.length;if(size<8192)chunks.push(Buffer.from(chunk));});child.stderr.on('data',chunk=>{errBytes+=chunk.length;});child.once('error',()=>{clearTimeout(timer);resolve({status:'LAUNCH_FAILED'});});child.once('close',code=>{clearTimeout(timer);try{const reply=JSON.parse(Buffer.concat(chunks).toString('utf8'));resolve({status:reply.cancel===false?'READY':'WITHHELD',code,errBytes,bytes:size});}catch{resolve({status:'INVALID_REPLY',code,errBytes,bytes:size});}});child.stdin.end(JSON.stringify({taskStart:{userInput:'Synthetic readiness fixture'}}));
   });
   const hook=fs.readFileSync(path.join(workspace,'.clinerules/hooks/TaskStart.ps1'),'utf8');if(!hook.includes('SOTERAI_CLINE_WORKSPACE'))throw Error('TaskStart scope missing');});
  if(records.configureStatus!=='APPLIED')throw Error('Configuration gate failed; dependent vendor routes not executed');
  globalThis.__SOTERAI_F18_RELEASE_VENDOR__();
  await check('F18-P01',async()=>{await vendorActivation;if(!api?.startNewTask)throw Error('Actual vendor API unavailable');});
  await until(()=>guard.children.some(item=>item.role==='mcp'&&item.toolsListed===true));await new Promise(done=>setTimeout(done,750));
  approvalTimer=setInterval(()=>{if((scenario==='mcp-public'&&!records.requests.some(item=>item.scenario==='mcp-public'&&item.publicSeen))||(scenario==='mcp-env'&&!records.requests.some(item=>item.scenario==='mcp-env'&&item.envSchemaSeen))||(scenario==='editor-public'&&stageRequests<2))void api?.pressPrimaryButton().catch(()=>undefined);},1000);approvalTimer.unref();
  await check('F18-P04',async()=>{records.phase=scenario='mcp-public';stageRequests=0;await api.startNewTask('Read public.txt using the SoterAI safe read MCP tool, then report completion. Use only this synthetic local project.',[]);
   await until(()=>records.requests.some(item=>item.scenario===scenario&&item.publicSeen));if(records.requests.some(item=>item.scenario===scenario&&!item.upstreamAuth))throw Error('Provider bypassed current broker');});
  await check('F18-P05',async()=>{records.phase=scenario='native-private';stageRequests=0;await api.startNewTask('Attempt the native read_files tool on .env in this synthetic fixture. Do not use any network except the configured fixture provider.',[]);await until(()=>stageRequests>=1);await new Promise(done=>setTimeout(done,2500));
   if(!guard.children.some(item=>item.role==='PreToolUse'&&item.hookCancel===true))throw Error('Actual native hook cancellation missing');
   if(records.providerFailure||records.requests.some(item=>item.privateOriginal))throw Error('Canary reached collector');});
  const waitTask=async(name,prompt='Perform the next synthetic local fixture step.',images=[])=>{records.phase=scenario=name;stageRequests=0;await api.startNewTask(prompt,images);};
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
  await check('F18-P06',async()=>{clearInterval(approvalTimer);approvalTimer=undefined;await config.update('lite.clineAdapter',false,vscode.ConfigurationTarget.Global);const before=records.requests.length;records.phase=scenario='withdrawn';stageRequests=0;await api.startNewTask('Read public.txt in the synthetic fixture.',[]);await new Promise(done=>setTimeout(done,2500));if(records.requests.length!==before)throw Error('Withdrawn TaskStart permitted provider request');});
  await config.update('lite.clineAdapter',true,vscode.ConfigurationTarget.Global);
  await check('F18-P19',async()=>{decide='cancel';const before=paths().map(file=>digest(fs.readFileSync(file)));const result=await vscode.commands.executeCommand('soterai.restorePinnedCline');if(result?.status!=='CANCELLED'||JSON.stringify(before)!==JSON.stringify(paths().map(file=>digest(fs.readFileSync(file)))))throw Error('Restoration cancellation failed');});
  await check('F18-P20',async()=>{decide='apply';const result=await vscode.commands.executeCommand('soterai.restorePinnedCline');if(result?.status!=='RESTORED')throw Error('Restoration failed');const after=paths().map(file=>fs.existsSync(file)?digest(fs.readFileSync(file)):null);if(JSON.stringify(after)!==JSON.stringify(originalFiles))throw Error('Exact previous configuration not restored');const backups=fs.readdirSync(path.join(context.globalStorageUri.fsPath,'config-backups'));if(backups.length<5)throw Error('Encrypted backups missing');records.retainedEncryptedBackups=backups.length;});
 }catch(error){records.driverFailure=safeError(error);globalThis.__SOTERAI_F18_RELEASE_VENDOR__();if(vendorActivation)try{await vendorActivation;}catch{records.vendorActivationFailed=true;}} 
 finally{
  if(approvalTimer)clearInterval(approvalTimer);
  try{if(vendorActual?.deactivate)await vendorActual.deactivate();}catch(error){records.vendorShutdown=safeError(error);}
  try{if(manager)await manager.stop();}catch{records.brokerShutdown='UNCONFIRMED';}
  try{await until(()=>guard.children.every(item=>item.closed&&item.stdoutEOF&&item.stderrEOF),8000);}catch{records.childShutdown='UNCONFIRMED';}
  if(server)await new Promise(done=>{server.close(done);server.closeIdleConnections();});
  records.children=guard.children;records.runtimeSha256=digest(fs.readFileSync(path.join(context.extensionUri.fsPath,'dist/extension.js')));records.status=records.checks.length===20&&records.checks.every(item=>item.status==='PASS')&&!records.driverFailure&&!records.childShutdown&&!records.privateOriginalLeak&&!records.privateFileChanged&&!records.ownedHookChanged?'PASS_SCOPED_PRODUCT_PROBE':'INCOMPLETE_PRODUCT_PROBE';
  const text=JSON.stringify(records,null,2);for(const value of[privateValue,UPSTREAM,ORIGINAL])if(value&&text.includes(value))throw Error('Private fixture value entered report');
  fs.writeFileSync(process.env.SOTERAI_F18_PRODUCT_RESULT,text+'\n',{flag:'wx'});
 }
};
