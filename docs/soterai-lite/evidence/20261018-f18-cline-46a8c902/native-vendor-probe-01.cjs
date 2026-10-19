'use strict';
// Test-only installed-vendor feasibility probe. No product protection claim.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http'),https=require('node:https'),cp=require('node:child_process'),net=require('node:net'),tls=require('node:tls');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
exports.activate=async context=>{
 const vscode=require('vscode'),root=process.env.SOTERAI_F18_PROBE_ROOT,output=process.env.SOTERAI_F18_PROBE_RESULT;
 if(!root||!output||!path.resolve(root).toLowerCase().startsWith('d:\\soterai-lite-test-profiles\\f18-vendor-'))throw Error('Isolated F18 root required');
 const records={scope:'ACTUAL_INSTALLED_VENDOR_FEASIBILITY_ONLY',version:'4.1.25',independence:'LOW',publicSeen:false,requests:[],deniedExternal:[],deniedSignals:[],children:[],hooks:[],failures:[]};
 const restores=[];let server,api,closing=false;const children=[];
 const patch=(object,key,value)=>{const before=object[key];object[key]=value;restores.push(()=>{object[key]=before;});return before;};
 // Test isolation only: refuse access outside the synthetic profile/public
 // runtime trees before vendor activation; never inspect a real config/secret.
 records.deniedFileAccess=[];
 const allowedRoots=[root,path.dirname(process.execPath),process.env.SystemRoot,'C:/Program Files/Git','C:/Program Files/nodejs'].filter(Boolean).map(value=>path.resolve(value).toLowerCase());
 const syntheticFile=value=>{try{if(value instanceof URL)value=require('node:url').fileURLToPath(value);if(Buffer.isBuffer(value))value=value.toString();const file=path.resolve(value).toLowerCase(),base=path.resolve(root).toLowerCase();return file===base||file.startsWith(base+path.sep);}catch{return false;}};
 const allowedFile=(value,key,args)=>{try{if(value instanceof URL)value=require('node:url').fileURLToPath(value);if(Buffer.isBuffer(value))value=value.toString();if(typeof value!=='string')return false;if(syntheticFile(value))return true;
  if(/^(write|append|mkdir|unlink|rm)/.test(key)||/^open/.test(key)&&args[0]!=='r'&&args[0]!==0)return false;
  const file=path.resolve(value).toLowerCase(),system=path.resolve(process.env.SystemRoot).toLowerCase();if(file.startsWith(system+path.sep)&&/^readFile/.test(key)&&!/[.](?:dll|exe|mui|node|manifest)$/i.test(file))return false;
  return allowedRoots.some(base=>file===base||file.startsWith(base+path.sep));}catch{return false;}};
 for(const key of ['readFile','readFileSync','readdir','readdirSync','stat','statSync','lstat','lstatSync','access','accessSync','realpath','realpathSync','open','openSync','writeFile','writeFileSync','appendFile','appendFileSync','mkdir','mkdirSync','unlink','unlinkSync','rm','rmSync','watch']){
  if(typeof fs[key]!=='function')continue;const original=fs[key],wrapped=function(file,...args){if(!allowedFile(file,key,args)){records.deniedFileAccess.push(key);throw Object.assign(Error('F18 fixture file access outside allowed synthetic/public roots'),{code:'EACCES'});}return Reflect.apply(original,this,[file,...args]);};Object.assign(wrapped,original);patch(fs,key,wrapped);
 }
 for(const key of ['readFile','readdir','stat','lstat','access','realpath','open','writeFile','appendFile','mkdir','unlink','rm']){
  const original=fs.promises[key];if(typeof original!=='function')continue;patch(fs.promises,key,async function(file,...args){if(!allowedFile(file,key,args)){records.deniedFileAccess.push('promise-'+key);throw Object.assign(Error('F18 fixture file access outside allowed synthetic/public roots'),{code:'EACCES'});}return Reflect.apply(original,this,[file,...args]);});
 }
 const loopback=host=>['127.0.0.1','localhost','::1','[::1]'].includes(host);
 const refuse=kind=>{records.deniedExternal.push(kind);throw Error('F18 test harness denied nonloopback traffic');};
 const urlOf=args=>{const first=args[0];try{if(typeof first==='string'||first instanceof URL)return new URL(first);if(first&&typeof first==='object')return {hostname:first.hostname||first.host||'localhost'};}catch{}return {hostname:'invalid'};};
 for(const module of [http,https])for(const name of ['request','get']){const original=module[name];patch(module,name,function(...args){if(!loopback(urlOf(args).hostname))return refuse(name);return Reflect.apply(original,this,args);});}
 const originalFetch=globalThis.fetch;patch(globalThis,'fetch',function(input,...args){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!loopback(url.hostname))return Promise.reject(Error('F18 test harness denied nonloopback fetch'));return originalFetch(input,...args);});
 const originalConnect=net.Socket.prototype.connect;patch(net.Socket.prototype,'connect',function(...args){let value=args[0];if(Array.isArray(value))value=value[0];if(value&&typeof value==='object'&&value.path)return Reflect.apply(originalConnect,this,args);const host=typeof value==='object'?value.host:(typeof args[1]==='string'?args[1]:'localhost');if(!loopback(host||'localhost'))return refuse('net-connect');return Reflect.apply(originalConnect,this,args);});
 const originalTls=tls.connect;patch(tls,'connect',function(...args){if(!loopback(urlOf(args).hostname))return refuse('tls-connect');return Reflect.apply(originalTls,this,args);});
 patch(cp.ChildProcess.prototype,'kill',function(){records.deniedSignals.push('CHILD_SIGNAL_REFUSED');throw Error('F18 test forbids process signals');});
 patch(process,'kill',function(){records.deniedSignals.push('PROCESS_SIGNAL_REFUSED');throw Error('F18 test forbids process signals');});
 const originalSpawn=cp.spawn;patch(cp,'spawn',function(...args){const child=Reflect.apply(originalSpawn,this,args),row={closed:false,stdoutEOF:!child.stdout,stderrEOF:!child.stderr};children.push(row);child.once('close',()=>{row.closed=true;});child.stdout?.once('end',()=>{row.stdoutEOF=true;});child.stderr?.once('end',()=>{row.stderrEOF=true;});return child;});
 const finish=async status=>{
  if(closing)return;closing=true;records.status=status;records.children=children;
  try{const text=fs.readFileSync(path.join(root,'workspace/.f18-hook-events.jsonl'),'utf8');records.hooks=text.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch{}
  if(server)await new Promise(done=>{server.close(done);server.closeIdleConnections();});
  records.loadedRuntimeSha256=sha(fs.readFileSync(path.join(context.extensionUri.fsPath,'dist/extension.js')));
  fs.writeFileSync(output,JSON.stringify(records,null,2)+'\n',{flag:'wx'});
  // Cooperative editor shutdown; no process signaling or force termination.
  await vscode.commands.executeCommand('workbench.action.closeWindow');
 };
 try{
  const workspace=path.join(root,'workspace');fs.mkdirSync(path.join(workspace,'.clinerules/hooks'),{recursive:true});
  fs.writeFileSync(path.join(workspace,'public.txt'),'F18_PUBLIC_READ_CONTROL_20261018\n',{flag:'wx'});fs.writeFileSync(path.join(workspace,'.env'),'F18_TOKEN=TEST_ONLY_F18_NATIVE_PRIVATE_20261018\n',{flag:'wx'});
  const hook=`$ErrorActionPreference='Stop'\n$taskInput=[Console]::In.ReadToEnd()|ConvertFrom-Json\n$taskName=[string]$taskInput.preToolUse.toolName\n$taskParameters=$taskInput.preToolUse.parameters|ConvertTo-Json -Compress -Depth 10\n$taskBlock=($taskParameters -match '\\.env') -or ($taskName -notmatch 'read_file|readFile')\n$taskLog=Join-Path $PSScriptRoot '../../.f18-hook-events.jsonl'\n([ordered]@{tool=$taskName;blocked=$taskBlock;bytes=$taskInput.ToString().Length}|ConvertTo-Json -Compress)|Add-Content -LiteralPath $taskLog -Encoding utf8\nif($taskBlock){[Console]::Out.WriteLine('{"cancel":true,"errorMessage":"Synthetic protected route withheld; use approved SoterAI MCP reader."}')}else{[Console]::Out.WriteLine('{"cancel":false}')}\n`;
  fs.writeFileSync(path.join(workspace,'.clinerules/hooks/PreToolUse.ps1'),hook,{flag:'wx'});
  server=http.createServer(async(req,res)=>{try{
   let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>1024*1024)throw Error('Fixture request too large');chunks.push(chunk);}const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   const text=JSON.stringify(body),tools=(body.tools||[]).map(t=>t.function?.name).filter(Boolean);records.requests.push({route:req.url,bytes:size,tools,publicControl:text.includes('F18_PUBLIC_READ_CONTROL_20261018'),privateOriginal:text.includes('TEST_ONLY_F18_NATIVE_PRIVATE_20261018')});
   if(text.includes('TEST_ONLY_F18_NATIVE_PRIVATE_20261018'))throw Error('Private fixture reached provider');
   if(text.includes('F18_PUBLIC_READ_CONTROL_20261018'))records.publicSeen=true;
   const readName=tools.find(t=>/read_file|readFile/.test(t));
   let delta,reason;if(records.requests.length===1){if(readName){delta={role:'assistant',tool_calls:[{index:0,id:'f18-read-public',type:'function',function:{name:readName,arguments:JSON.stringify({path:'public.txt'})}}]};reason='tool_calls';}else{delta={role:'assistant',content:'<read_file>\n<path>public.txt</path>\n</read_file>'};reason='stop';}}
   else if(records.publicSeen&&records.requests.length===2){if(readName){delta={role:'assistant',tool_calls:[{index:0,id:'f18-read-private',type:'function',function:{name:readName,arguments:JSON.stringify({path:'.env'})}}]};reason='tool_calls';}else{delta={role:'assistant',content:'<read_file>\n<path>.env</path>\n</read_file>'};reason='stop';}}
   else{delta={role:'assistant',content:'<attempt_completion>\n<result>Synthetic route probe finished.</result>\n</attempt_completion>'};reason='stop';}
   res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store'});res.end('data: '+JSON.stringify({id:'f18',object:'chat.completion.chunk',created:1,model:'f18-loopback',choices:[{index:0,delta,finish_reason:null}]})+'\n\ndata: '+JSON.stringify({id:'f18',object:'chat.completion.chunk',created:1,model:'f18-loopback',choices:[{index:0,delta:{},finish_reason:reason}]})+'\n\ndata: [DONE]\n\n');
  }catch{records.failures.push('LOOPBACK_REQUEST_FAILED');res.writeHead(400);res.end('{}');}});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));const url=`http://127.0.0.1:${server.address().port}/v1`;
  const info={maxTokens:4096,contextWindow:128000,supportsImages:false,supportsPromptCache:false,inputPrice:0,outputPrice:0};
  const settings={apiProvider:'openai',planModeApiProvider:'openai',actModeApiProvider:'openai',openAiBaseUrl:url,openAiModelId:'f18-loopback',planModeOpenAiModelId:'f18-loopback',actModeOpenAiModelId:'f18-loopback',openAiModelInfo:info,planModeOpenAiModelInfo:info,actModeOpenAiModelInfo:info,mode:'act',telemetrySetting:'disabled',optOutOfRemoteConfig:true,openTelemetryEnabled:false,mcpMarketplaceEnabled:false,enableCheckpointsSetting:false,subagentsEnabled:false,worktreesEnabled:false,cloudSessionsEnabled:false,welcomeViewCompleted:true,isNewUser:false,hooksEnabled:true,autoApprovalSettings:{enabled:true,version:1,maxRequests:10,enableNotifications:false,actions:{readFiles:true,readFilesExternally:false,editFiles:false,editFilesExternally:false,executeSafeCommands:false,executeAllCommands:false,useBrowser:false,useMcp:false}}};
  for(const [key,value]of Object.entries(settings))await context.globalState.update(key,value);
  await context.secrets.store('openAiApiKey','TEST_ONLY_F18_LOOPBACK_NO_ACCOUNT');
  const runtime=fs.readFileSync(path.join(context.extensionUri.fsPath,'dist/extension.js'));if(sha(runtime)!=='a3e8eda18b38547df9c614e62d04106cdf3bf2df2cb16241af3f7b3770088022')throw Error('Pinned vendor runtime changed');
  const actual=require('./dist/extension.js');api=await actual.activate(context);records.exportedApi=Object.keys(api||{});records.activated=true;
  const timer=setTimeout(()=>{void finish(records.publicSeen&&records.hooks.some(item=>item.blocked)?'PASS_SCOPED_VENDOR_PROBE':'INCOMPLETE_VENDOR_ROUTE');},45000);timer.unref?.();
  await api.startNewTask('Synthetic local verification: read public.txt, then read .env, then report completion. Use only the current project. The provider is a scripted local fixture.',[]);
 }catch(error){records.failures.push({stage:'ACTIVATION_OR_TASK',name:error?.name||'Error',code:typeof error?.code==='string'?error.code:undefined});await finish('INCOMPLETE_VENDOR_START');}
 return api||{};
};
