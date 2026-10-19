'use strict';
// Actual product/vendor fixture, scripted native APIs, LOW independence.
const vscode=require('vscode'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),cp=require('node:child_process');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const PUBLIC='F18_NATIVE_PUBLIC_CONTROL_20261018\n',UPSTREAM='TEST_ONLY_F18_UPSTREAM_KEY',ORIGINAL='TEST_ONLY_F18_ORIGINAL_PROVIDER_KEY';
let captured,api,vendorActual,permit,server,vendorActivation,privateValue='',scenario='idle',stageRequests=0,root,records,guard,decide='apply';
const until=async(fn,ms=15000)=>{const deadline=Date.now()+ms;while(Date.now()<deadline){if(await fn())return;await new Promise(done=>setTimeout(done,25));}throw Error('Native fixture deadline');};
const safeError=error=>({name:error?.name||'Error',code:typeof error?.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:undefined});
exports.beforeActivate=async context=>{
 captured=context;root=process.env.SOTERAI_F18_PRODUCT_ROOT;
 if(!root||!path.resolve(root).toLowerCase().startsWith('d:\\soterai-lite-test-profiles\\f18-product-'))throw Error('Explicit isolated product root required');
 records={scope:'ACTUAL_PACKAGED_PRODUCT_AND_PINNED_CLINE_SCRIPTED_APIS',independence:'LOW',checks:[],modals:[],requests:[],phase:'setup'};
 guard=require('./product-test-guards-02.cjs').install(root,records);
 for(const name of ['showInformationMessage','showErrorMessage'])Object.defineProperty(vscode.window,name,{configurable:true,writable:true,value:async()=>undefined});
 Object.defineProperty(vscode.window,'showWarningMessage',{configurable:true,writable:true,value:async(message,options,...actions)=>{
  if(options?.modal){const detail=String(options.detail||'');if(privateValue&&detail.includes(privateValue))throw Error('Private canary entered native preview');
   records.modals.push({kind:message.startsWith('Allow one safe read')?'read':message.startsWith('Review pinned Cline')?'config':'other',bytes:Buffer.byteLength(detail),digest:digest(detail)});
   if(message.startsWith('Review pinned Cline'))return decide==='apply'?'Apply reviewed Cline changes':undefined;
   if(message.startsWith('Allow one safe read'))return 'Allow safe read once';
  }return undefined;
 }});
 let release;permit=new Promise(done=>{release=done;});globalThis.__SOTERAI_F18_RELEASE_VENDOR__=release;
 globalThis.__SOTERAI_F18_ACTIVATE_VENDOR__=async vendorContext=>{
  const info={maxTokens:4096,contextWindow:128000,supportsImages:false,supportsPromptCache:false,inputPrice:0,outputPrice:0};
  const settings={apiProvider:'openai',planModeApiProvider:'openai',actModeApiProvider:'openai',openAiBaseUrl:records.providerUrl,openAiModelId:'f18-loopback',planModeOpenAiModelId:'f18-loopback',actModeOpenAiModelId:'f18-loopback',openAiModelInfo:info,planModeOpenAiModelInfo:info,actModeOpenAiModelInfo:info,mode:'act',telemetrySetting:'disabled',optOutOfRemoteConfig:true,openTelemetryEnabled:false,mcpMarketplaceEnabled:false,enableCheckpointsSetting:false,subagentsEnabled:false,worktreesEnabled:false,cloudSessionsEnabled:false,welcomeViewCompleted:true,isNewUser:false,hooksEnabled:true,autoApprovalSettings:{enabled:true,version:1,maxRequests:10,enableNotifications:false,actions:{readFiles:true,readFilesExternally:false,editFiles:false,executeSafeCommands:false,executeAllCommands:false,useBrowser:false,useMcp:true}}};
  for(const[key,value]of Object.entries(settings))await vendorContext.globalState.update(key,value);
  await vendorContext.secrets.store('openAiApiKey',ORIGINAL);
  const data=path.join(process.env.USERPROFILE,'.cline/data/settings');fs.mkdirSync(data,{recursive:true});
  fs.writeFileSync(path.join(data,'global-settings.json'),JSON.stringify({autoUpdateEnabled:false,telemetryOptOut:true}));
  fs.writeFileSync(path.join(data,'../globalState.json'),JSON.stringify(settings));
  fs.writeFileSync(path.join(data,'providers.json'),JSON.stringify({version:1,lastUsedProvider:'openai-compatible',modes:{},providers:{'openai-compatible':{settings:{provider:'openai-compatible',apiKey:ORIGINAL,model:'f18-loopback',baseUrl:records.providerUrl},updatedAt:new Date().toISOString(),tokenSource:'fixture'}}}));
  fs.writeFileSync(path.join(data,'models.json'),JSON.stringify({version:1,providers:{'openai-compatible':{provider:{name:'OpenAI Compatible',baseUrl:records.providerUrl,defaultModelId:'f18-loopback'},models:{'f18-loopback':{id:'f18-loopback',name:'f18-loopback',maxTokens:4096,contextWindow:128000,maxInputTokens:128000,capabilities:['streaming','tools']}}}}}));
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
  records.brokerStages=[];for(const method of ['start','stop']){const original=manager[method];manager[method]=async function(...args){try{const result=await Reflect.apply(original,this,args);records.brokerStages.push({method,state:this.ownedSnapshot().state,running:result?.running});return result;}catch(error){records.brokerStages.push({method,state:this.ownedSnapshot().state,error:safeError(error)});throw error;}};}
  const adapter=context.subscriptions.find(item=>typeof item.configure==='function'&&typeof item.undo==='function');records.controllerStages=[];
  if(adapter)for(const name of ['artifact','eligible','read','write','configuredFiles']){const original=adapter[name];if(typeof original==='function')adapter[name]=async function(...args){try{const value=await Reflect.apply(original,this,args);if(records.controllerStages.length<128)records.controllerStages.push({stage:name,file:name==='read'||name==='write'?path.basename(args[0]):undefined,status:'RETURNED',...(typeof value==='boolean'?{value}:{}),...(typeof value==='string'?{bytes:Buffer.byteLength(value)}:{})});return value;}catch(error){if(records.controllerStages.length<128)records.controllerStages.push({stage:name,file:name==='read'||name==='write'?path.basename(args[0]):undefined,status:'FAILED',error:safeError(error)});throw error;}};}
  server=http.createServer(async(req,res)=>{try{
   if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({object:'list',data:[{id:'f18-loopback',object:'model',owned_by:'fixture'}]}));return;}
   let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>262144)throw Error('Too large');chunks.push(chunk);}const body=JSON.parse(Buffer.concat(chunks).toString('utf8')),text=JSON.stringify(body),tools=body.tools||[];
   if(privateValue&&text.includes(privateValue))throw Error('Original private canary reached upstream');
   const actualTools=tools.map(item=>item.function?.name).filter(Boolean),publicSeen=text.includes(PUBLIC.trim()),upstreamAuth=req.headers.authorization==='Bearer '+UPSTREAM;
   if(records.requests.length>=8){records.fixtureRequestBudget=true;res.writeHead(429);res.end('{}');return;}
   records.requests.push({scenario,route:req.url,bytes:size,upstreamAuth,publicSeen,privateOriginal:false,tools:actualTools});stageRequests++;
   if(!upstreamAuth){response(res,{role:'assistant',content:'Unverified route refused.'});return;}
   const schema=JSON.stringify(tools);if(!schema.includes(privateValue||'__never__')&&!schema.includes(UPSTREAM)&&!schema.includes(ORIGINAL)){
    const file=path.join(root,'tool-schemas.json');if(!fs.existsSync(file))fs.writeFileSync(file,schema+'\n',{flag:'wx'});
   }
   if(scenario==='mcp-public'&&stageRequests===1){const name=actualTools.find(item=>item.includes('read_project_file_safely'));if(!name){records.missingSafeTool=true;response(res,{role:'assistant',content:'Safe tool unavailable.'});return;}
    response(res,{role:'assistant',tool_calls:[{index:0,id:'f18-public',type:'function',function:{name,arguments:JSON.stringify({path:'public.txt'})}}]},'tool_calls');return;}
   if(scenario==='native-private'&&stageRequests===1){response(res,{role:'assistant',tool_calls:[{index:0,id:'f18-private',type:'function',function:{name:'read_files',arguments:JSON.stringify({path:'.env'})}}]},'tool_calls');return;}
   response(res,{role:'assistant',content:'<attempt_completion><result>Synthetic local route probe complete.</result></attempt_completion>'});
  }catch{records.providerFailure=true;res.writeHead(400,{'content-type':'application/json'});res.end('{"error":{"message":"Synthetic route refused"}}');}});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));records.providerUrl='http://127.0.0.1:'+server.address().port+'/v1';
  const config=vscode.workspace.getConfiguration('soterai');await config.update('broker.openAIProviderUrl',records.providerUrl,vscode.ConfigurationTarget.Global);await context.secrets.store('soterai.providerApiKey',UPSTREAM);
  const canaries=Reflect.get(manager,'canaries'),canary=await canaries.create();privateValue=canary.token;await manager.stop();
  const workspace=vscode.workspace.workspaceFolders[0].uri.fsPath;fs.writeFileSync(path.join(workspace,'public.txt'),PUBLIC);fs.writeFileSync(path.join(workspace,'.env'),'F18_TOKEN='+privateValue+'\nPORT=1234\n');
  const extension=vscode.extensions.getExtension('saoudrizwan.claude-dev');if(!extension)throw Error('Pinned vendor missing');vendorActivation=extension.activate();await until(()=>records.vendorPrepared===true);records.vendorVersion=extension.packageJSON.version;
  const files=()=>{const settings=path.join(process.env.USERPROFILE,'.cline/data/settings');return['providers.json','cline_mcp_settings.json','global-settings.json'].map(name=>digest(fs.readFileSync(path.join(settings,name))));};
  await check('F18-P02',async()=>{const before=files();decide='cancel';const result=await vscode.commands.executeCommand('soterai.configurePinnedCline');records.cancelStatus=result?.status;if(result?.status!=='CANCELLED')throw Error('Cancel status unavailable');if(JSON.stringify(files())!==JSON.stringify(before))throw Error('Cancel changed vendor files');});
  await check('F18-P03',async()=>{decide='apply';const result=await vscode.commands.executeCommand('soterai.configurePinnedCline');records.configureStatus=result?.status;if(result?.status!=='APPLIED')throw Error('Current product configuration unavailable');
   const hook=fs.readFileSync(path.join(workspace,'.clinerules/hooks/TaskStart.ps1'),'utf8');if(!hook.includes('SOTERAI_CLINE_WORKSPACE'))throw Error('TaskStart scope missing');});
  if(records.configureStatus!=='APPLIED')throw Error('Configuration gate failed; dependent vendor routes not executed');
  globalThis.__SOTERAI_F18_RELEASE_VENDOR__();
  await check('F18-P01',async()=>{await vendorActivation;if(!api?.startNewTask)throw Error('Actual vendor API unavailable');});
  approvalTimer=setInterval(()=>{void api?.pressPrimaryButton().catch(()=>undefined);},1000);approvalTimer.unref();
  await check('F18-P04',async()=>{scenario='mcp-public';stageRequests=0;await api.startNewTask('Read public.txt using the SoterAI safe read MCP tool, then report completion. Use only this synthetic local project.',[]);
   await until(()=>records.requests.some(item=>item.scenario===scenario&&item.publicSeen));if(records.requests.some(item=>item.scenario===scenario&&!item.upstreamAuth))throw Error('Provider bypassed current broker');});
  await check('F18-P05',async()=>{scenario='native-private';stageRequests=0;await api.startNewTask('Attempt the native read_files tool on .env in this synthetic fixture. Do not use any network except the configured fixture provider.',[]);await until(()=>stageRequests>=1);await new Promise(done=>setTimeout(done,2500));
   if(records.providerFailure||records.requests.some(item=>item.privateOriginal))throw Error('Canary reached collector');});
  await check('F18-P06',async()=>{await config.update('lite.clineAdapter',false,vscode.ConfigurationTarget.Global);const before=records.requests.length;scenario='withdrawn';stageRequests=0;await api.startNewTask('Read public.txt in the synthetic fixture.',[]);await new Promise(done=>setTimeout(done,2500));if(records.requests.length!==before)throw Error('Withdrawn TaskStart permitted provider request');});
 }catch(error){records.driverFailure=safeError(error);globalThis.__SOTERAI_F18_RELEASE_VENDOR__();if(vendorActivation)try{await vendorActivation;}catch{records.vendorActivationFailed=true;}} 
 finally{
  if(approvalTimer)clearInterval(approvalTimer);
  try{if(vendorActual?.deactivate)await vendorActual.deactivate();}catch(error){records.vendorShutdown=safeError(error);}
  try{if(manager)await manager.stop();}catch{records.brokerShutdown='UNCONFIRMED';}
  try{await until(()=>guard.children.every(item=>item.closed&&item.stdoutEOF&&item.stderrEOF),8000);}catch{records.childShutdown='UNCONFIRMED';}
  if(server)await new Promise(done=>{server.close(done);server.closeIdleConnections();});
  records.children=guard.children;records.runtimeSha256=digest(fs.readFileSync(path.join(context.extensionUri.fsPath,'dist/extension.js')));records.status=records.checks.length===6&&records.checks.every(item=>item.status==='PASS')&&!records.driverFailure&&!records.childShutdown?'PASS_SCOPED_PRODUCT_PROBE':'INCOMPLETE_PRODUCT_PROBE';
  const text=JSON.stringify(records,null,2);for(const value of[privateValue,UPSTREAM,ORIGINAL])if(value&&text.includes(value))throw Error('Private fixture value entered report');
  fs.writeFileSync(process.env.SOTERAI_F18_PRODUCT_RESULT,text+'\n',{flag:'wx'});
 }
};
