'use strict';
// Actual packaged owner controller + pinned native CLI. LOW scripted decisions.
const vscode=require('vscode'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const PUBLIC='F20B_NATIVE_PUBLIC_20261019',DONE='F20B_NATIVE_COMPLETE',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),write=(f,b)=>fs.writeFileSync(f,b,{flag:'wx'});
let ideClient;let root,workspace,records,guard,provider,contextSaved,home,privateValue,phase='setup',turn=0,review='apply',consent='allow';
const safeError=e=>({name:e?.name||'Error',code:typeof e?.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(e.code)?e.code:undefined});
const until=async(fn,max=10000)=>{const end=Date.now()+max;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Fixture deadline');};
exports.beforeActivate=async context=>{
 contextSaved=context;root=process.env.SOTERAI_F20B_PRODUCT_ROOT;workspace=vscode.workspace.workspaceFolders[0].uri.fsPath;assert(path.resolve(root).toLowerCase().startsWith('d:\\soterai-lite-test-profiles\\f20b-product-'));
 records={status:'INCOMPLETE_PRODUCT_MATRIX',independence:'LOW',checks:[],requests:[],mcp:[],modals:[],native:[],phase,
  limits:['Actual exact VSIX runtime via isolated developer bootstrap; no clean-install/human/independent claim','Actual pinned IDE26.51007.21434/internal client and bundled0.162.0-alpha.17.2; physical webview remains unverified','Restricted stateless text Responses through revocable proxy and current broker; complete output buffered; explicit provider override remains uncovered','Parent Node guards do not establish OS or all-descendant traffic isolation']};
 guard=require('./ide-product-guards-01.cjs').install(root,records);ideClient=require('./ide-native-client-01.cjs').install(root,workspace,records);
 for(const name of['showInformationMessage','showErrorMessage'])Object.defineProperty(vscode.window,name,{configurable:true,writable:true,value:async()=>undefined});
 Object.defineProperty(vscode.window,'showWarningMessage',{configurable:true,writable:true,value:async(message,options,...actions)=>{
  if(!options?.modal)return;const detail=String(options.detail||'');if(privateValue)assert(!detail.includes(privateValue));
  const kind=message.startsWith('Allow one safe read')?'safe-read':message.startsWith('Review pinned Codex IDE')?'config':'other';
  records.modals.push({phase,kind,bytes:Buffer.byteLength(detail),sha256:sha(detail)});
  if(kind==='config')return review==='apply'?actions.find(a=>a==='Create reviewed Codex safe-read profile'||a==='Remove reviewed Codex profile config'):undefined;
  if(kind==='safe-read')return consent==='allow'?'Allow safe read once':undefined;
 }});
 const emit=http.Server.prototype.emit;http.Server.prototype.emit=function(event,...args){
  if(event==='request'){const[req,res]=args;if(req.url==='/codex/mcp'){
   const row={phase};records.mcp.push(row);let chunks=[],size=0;req.on('data',b=>{size+=b.length;if(size<=65536)chunks.push(Buffer.from(b));});
   req.on('end',()=>{try{const b=JSON.parse(Buffer.concat(chunks));row.method=b.method;row.argumentKeys=Object.keys(b.params?.arguments??{});row.metadataKeys=Object.keys(b.params?._meta??{});}catch{row.malformed=true;}});
   res.once('finish',()=>row.code=res.statusCode);
  }}return Reflect.apply(emit,this,[event,...args]);
 };
};
function stream(res,tool){
 const responseText=phase==='registered-output'?privateValue:DONE;res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store'});
 const emit=(type,data)=>res.write('event: '+type+'\ndata: '+JSON.stringify({type,...data})+'\n\n');
 const output=tool?[{id:'fc_f20b',type:'function_call',status:'completed',name:tool.name,namespace:tool.namespace,call_id:'call_f20b',arguments:JSON.stringify(tool.arguments)}]
  :[{id:'msg_f20b',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:responseText,annotations:[]}]}];
 const response={id:'resp_f20b',object:'response',created_at:1,status:'completed',model:'f20-fixture',output,usage:{input_tokens:1,output_tokens:1,total_tokens:2}};
 emit('response.created',{response:{...response,status:'in_progress',output:[]}});emit('response.output_item.added',{output_index:0,item:{...output[0],status:'in_progress',...(tool?{}:{content:[]})}});
 if(!tool){emit('response.content_part.added',{item_id:'msg_f20b',output_index:0,content_index:0,part:{type:'output_text',text:'',annotations:[]}});emit('response.output_text.delta',{item_id:'msg_f20b',output_index:0,content_index:0,delta:responseText});emit('response.output_text.done',{item_id:'msg_f20b',output_index:0,content_index:0,text:responseText});}
 emit('response.output_item.done',{output_index:0,item:output[0]});emit('response.completed',{response});res.end();
}
async function native(name,prompt='Synthetic loopback fixture. Perform only the offered safe tool step.'){phase=name;records.phase=name;turn=0;return ideClient.native(name,prompt,home,privateValue,records.providerUrl,DONE);}
exports.run=async (context,prepared)=>{
 assert.equal(context,contextSaved);
 const check=async(id,fn)=>{try{await fn();records.checks.push({id,status:'PASS'});}catch(e){records.checks.push({id,status:'FAIL',error:safeError(e)});if(records.nativeRetained)throw Error('Retained native child; dependent steps stopped');}};
 const requests=name=>records.requests.filter(r=>r.phase===name);
 let configFile,original,wrapper,wrapperBefore;
 try{
  const manager=context.subscriptions.find(s=>typeof s.ownedSnapshot==='function');assert(manager);const canary=await Reflect.get(manager,'canaries').create();privateValue=canary.token;guard.setPrivateCanary(privateValue);await manager.stop();
  write(path.join(workspace,'public.txt'),PUBLIC+'\n');write(path.join(workspace,'.env'),'F20B_TOKEN='+privateValue+'\nPORT=1234\n');write(path.join(root,'empty-git-config'),'');
  provider=http.createServer(async(req,res)=>{try{
   let size=0,chunks=[];for await(const b of req){size+=b.length;if(size>262144)throw Error('Bound');chunks.push(b);}
   const body=JSON.parse(Buffer.concat(chunks)),text=JSON.stringify(body),ns=(body.tools??[]).find(t=>t.type==='namespace'&&t.name==='mcp__soterai_safe_read');
   const names=(body.tools??[]).flatMap(t=>[t.name,...(t.tools??[]).map(s=>s.name)]).filter(Boolean);
   const row={phase,route:req.url,bytes:size,publicSeen:text.includes(PUBLIC),maskedEnvSeen:text.includes('F20B_TOKEN')&&text.includes('[MASKED]'),privateOriginalSeen:text.includes(privateValue),toolNames:names};
   records.requests.push(row);if(row.privateOriginalSeen&&phase!=='explicit-provider-override')records.unexpectedPrivateLeak=true;
   row.upstreamAuth=req.headers.authorization==='Bearer TEST_ONLY_F20B_NATIVE_RESPONSES_UPSTREAM_CREDENTIAL';if(phase!=='explicit-provider-override')assert(row.upstreamAuth);assert.equal(req.url,'/v1/responses');assert(++turn<=3);
   let tool;if(turn===1&&phase.startsWith('mcp-')){
    const def=ns?.tools?.find(t=>t.name==='soterai_read_project_file_safely');assert(def,'Native namespace safe tool required');
    tool={name:def.name,namespace:ns.name,arguments:phase==='mcp-public'?{path:'public.txt'}:phase==='mcp-traversal'?{path:'../.env'}:phase==='mcp-forged-approval'?{path:'.env',approved:true}:{path:'.env'}};
   }stream(res,tool);
  }catch(e){records.providerFailure=safeError(e);if(!res.headersSent)res.writeHead(400,{'content-type':'application/json'});res.end('{"error":{"message":"Synthetic fixture withheld"}}');}});
  await new Promise(r=>provider.listen(0,'127.0.0.1',r));records.providerUrl='http://127.0.0.1:'+provider.address().port;await vscode.workspace.getConfiguration('soterai').update('broker.codexResponsesProviderUrl',records.providerUrl+'/v1/responses',vscode.ConfigurationTarget.Global);await context.secrets.store('soterai.providerApiKey','TEST_ONLY_F20B_NATIVE_RESPONSES_UPSTREAM_CREDENTIAL');await manager.stop();
  const adapter=context.subscriptions.find(s=>typeof s.configure==='function'&&typeof s.status==='function'&&s.status()?.version==='26.51007.21434');
  const appData=process.env.APPDATA,appRel=appData?path.relative(root,appData):'ABSENT';
  records.ownerDiagnostic={found:!!adapter,available:adapter?.available?.(),readerEnabled:adapter?.reader?.isEnabled?.(),trusted:vscode.workspace.isTrusted,folders:vscode.workspace.workspaceFolders?.length,roamingRelative:appData&&!appRel.startsWith('..')&&!path.isAbsolute(appRel)?appRel:'OUTSIDE_OR_ABSENT'};
  const storage=context.globalStorageUri,storageRel=path.relative(root,storage.fsPath);
  records.ownerDiagnostic.storage={scheme:storage.scheme,authorityEmpty:!storage.authority,absolute:path.isAbsolute(storage.fsPath),relative:!storageRel.startsWith('..')&&!path.isAbsolute(storageRel)?storageRel:'OUTSIDE_SYNTHETIC_ROOT',storedReceiptPresent:!!context.globalState.get('soterai.lite.codexIdeAdapter.receipt.v1')};
  records.ownerStages=[];
  if(adapter)for(const name of['saved','artifact','projectEligible','parent','stamp','bounded']){const original=adapter[name];if(typeof original!=='function')continue;adapter[name]=async function(...args){try{const result=await Reflect.apply(original,this,args);if(records.ownerStages.length<128)records.ownerStages.push({method:name,leaf:typeof args[0]==='string'?path.basename(args[0]):undefined,result:typeof result==='boolean'?result:Buffer.isBuffer(result)?'BYTES_'+result.length:result===undefined?'ABSENT':typeof result});return result;}catch(error){records.ownerStages.push({method:name,leaf:typeof args[0]==='string'?path.basename(args[0]):undefined,error:safeError(error)});throw error;}};}
  const setup=()=>vscode.commands.executeCommand('soterai.configurePinnedCodexIde'),undo=()=>vscode.commands.executeCommand('soterai.restorePinnedCodexIde'),config=vscode.workspace.getConfiguration('soterai');
  await check('F20B-N01',async()=>{review='cancel';assert.equal((await setup())?.status,'CANCELLED');});
  await check('F20B-N02',async()=>{review='apply';const r=await setup();assert.equal(r?.status,'APPLIED');assert.equal(r?.badge,'Uncovered');home=r.profileDirectory;configFile=path.join(home,'config.toml');original=fs.readFileSync(configFile);assert(original.includes(Buffer.from('shell_tool = false')));});
  assert(home,'Actual owner setup required before native tests');process.env.CODEX_HOME=home;prepared?.();
  await check('F20B-N03',async()=>{const r=await native('provider-public');assert.equal(r.exitCode,0);assert(r.closed&&r.stdoutEOF&&r.stderrEOF&&r.complete);assert(requests('provider-public').length>0);assert(records.mcp.some(m=>m.phase==='provider-public'&&m.method==='initialize'&&m.code===200));});
  await check('F20B-N04',async()=>{const q=requests('provider-public')[0];assert(q);for(const name of['exec_command','write_stdin','view_image','apply_patch','web_search','spawn_agent','js_repl'])assert(!q.toolNames.includes(name));assert(q.toolNames.includes('soterai_read_project_file_safely'));});
  await check('F20B-N05',async()=>{assert((await native('mcp-public')).complete);assert(requests('mcp-public').some(r=>r.publicSeen));assert(records.modals.some(m=>m.phase==='mcp-public'&&m.kind==='safe-read'));});
  await check('F20B-N06',async()=>{assert((await native('mcp-env')).complete);assert(requests('mcp-env').some(r=>r.maskedEnvSeen));assert(!requests('mcp-env').some(r=>r.privateOriginalSeen));assert(records.mcp.some(m=>m.phase==='mcp-env'&&m.method==='tools/call'&&m.code===200));});
  await check('F20B-N07',async()=>{consent='cancel';assert((await native('mcp-cancel')).complete);assert(records.modals.some(m=>m.phase==='mcp-cancel'&&m.kind==='safe-read'));assert(!requests('mcp-cancel').some(r=>r.maskedEnvSeen||r.privateOriginalSeen));consent='allow';});
  await check('F20B-N08',async()=>{assert((await native('mcp-traversal')).complete);assert(!records.modals.some(m=>m.phase==='mcp-traversal'&&m.kind==='safe-read'));assert(!requests('mcp-traversal').some(r=>r.privateOriginalSeen));});
  await check('F20B-N09',async()=>{assert((await native('mcp-forged-approval')).complete);assert(!records.modals.some(m=>m.phase==='mcp-forged-approval'&&m.kind==='safe-read'));assert(!requests('mcp-forged-approval').some(r=>r.maskedEnvSeen||r.privateOriginalSeen));});
  await check('F20B-N10',async()=>{assert((await native('registered-public-control')).complete);assert(requests('registered-public-control').length>0);assert(!(await native('registered-context','Synthetic supplied context '+privateValue)).complete);assert.equal(requests('registered-context').length,0);records.mediatedContextControl={status:'BLOCKED_SCOPED',covered:true,scope:'Current pinned dedicated HTTP text profile; adjacent native public control'};});
  await check('F20B-N19',async()=>{assert((await native('explicit-provider-override','Synthetic explicit override context '+privateValue)).complete);assert(requests('explicit-provider-override').some(r=>r.privateOriginalSeen));records.unmediatedContextControl={status:'LEAK_CONFIRMED',covered:false,scope:'Explicit native provider override bypasses the cooperative configured route; retained uncovered control.'};});
  await check('F20B-N20',async()=>{assert(!(await native('registered-output')).complete);assert(requests('registered-output').length>0);assert(!records.native.at(-1).privateOutputSeen);});
  await check('F20B-N11',async()=>{fs.writeFileSync(configFile,Buffer.concat([original,Buffer.from('\n# synthetic drift\n')]));assert(!(await native('config-drift')).complete);assert.equal(requests('config-drift').length,0);});
  await check('F20B-N12',async()=>{assert.equal((await undo())?.status,'CHANGED');assert(fs.readFileSync(configFile).includes(Buffer.from('synthetic drift')));fs.writeFileSync(configFile,original);});
  // Undo invocation withdraws the old session. Reconfigure is deliberately
  // forbidden until reviewed restoration; current pin freshness is component
  // tested and rechecked by every actual live request above.
  await check('F20B-N13',async()=>{assert(!(await native('withdrawn-after-drift-review')).complete);assert.equal(requests('withdrawn-after-drift-review').length,0);assert(fs.readFileSync(configFile).equals(original));});
  await check('F20B-N14',async()=>{review='cancel';assert.equal((await undo())?.status,'CANCELLED');assert(fs.readFileSync(configFile).equals(original));review='apply';});
  await check('F20B-N15',async()=>{await config.update('lite.codexIdeAdapter',false,vscode.ConfigurationTarget.Global);await native('flag-off');assert.equal(requests('flag-off').length,0);assert(fs.readFileSync(configFile).equals(original));});
  await check('F20B-N16',async()=>{await config.update('lite.codexIdeAdapter',true,vscode.ConfigurationTarget.Global);assert(!(await native('flag-reenabled-old-capability')).complete);assert.equal(requests('flag-reenabled-old-capability').length,0);});
  await check('F20B-N17',async()=>{write(path.join(home,'public-native-state.txt'),'KEEP');assert.equal((await undo())?.status,'RESTORED');assert(!fs.existsSync(configFile));assert.equal(fs.readFileSync(path.join(home,'public-native-state.txt'),'utf8'),'KEEP');records.unownedNativeStatePreserved=true;});
  await check('F20B-N18',async()=>{const text=fs.readFileSync(path.join(home,'recovery.json'),'utf8');assert(!text.includes(privateValue));assert(!/Bearer [a-f0-9]{64}/.test(text));records.encryptedBackups=fs.readdirSync(path.join(context.globalStorageUri.fsPath,'config-backups')).length;assert.equal(records.encryptedBackups,1);});
 }catch(e){records.driverFailure=safeError(e);}
 finally{
  prepared?.();try{await ideClient.finish();}catch{records.childShutdown='UNCONFIRMED';}
  try{const manager=context.subscriptions.find(s=>typeof s.ownedSnapshot==='function');await manager?.stop();}catch{records.brokerShutdown='UNCONFIRMED';}
  try{await until(()=>guard.children.every(c=>c.closed&&c.stdoutEOF&&c.stderrEOF),8000);}catch{records.childShutdown='UNCONFIRMED';}
  if(provider)await new Promise(r=>{provider.close(r);provider.closeIdleConnections();});
  records.children=guard.children;records.runtimeSha256=sha(fs.readFileSync(path.join(context.extensionUri.fsPath,'dist/extension.js')));
  records.status=records.checks.length===20&&records.checks.every(c=>c.status==='PASS')&&!records.driverFailure&&!records.childShutdown&&!records.nativeRetained&&!records.providerFailure&&!records.unexpectedPrivateLeak&&!records.native.some(n=>n.privateOutputSeen||n.outputOverflow)?'PASS_SCOPED_PRODUCT_IDE_MATRIX':'INCOMPLETE_PRODUCT_MATRIX';
  const text=JSON.stringify(records,null,2);assert(!text.includes(privateValue));write(process.env.SOTERAI_F20B_PRODUCT_RESULT,text+'\n');
 }
};
