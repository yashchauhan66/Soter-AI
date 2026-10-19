'use strict';
// Feasibility of the actual installed executable, not product acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const base=__dirname,pin=JSON.parse(fs.readFileSync(path.join(base,'installed-public-inputs-01.json'),'utf8')),binary=pin.files.find(v=>v.relative==='resources/native-binary/claude.exe');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex'),write=(file,value)=>fs.writeFileSync(file,value,{flag:'wx'});
const PUBLIC='F19_SYNTHETIC_NATIVE_PUBLIC_20261019',KEY='TEST_ONLY_F19_LOOPBACK_API_CREDENTIAL',HOOK='TEST_ONLY_F19_LOOPBACK_HOOK_CREDENTIAL',privateValue='SOTERAI_F19_PRIVATE_'+crypto.randomBytes(32).toString('hex');
const root=path.resolve('D:/SoterAI-Lite-test-profiles/f19-vendor-'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z')+'-'+crypto.randomBytes(4).toString('hex'));
if(!root.toLowerCase().startsWith('d:\\soterai-lite-test-profiles\\f19-vendor-')||fs.existsSync(root))throw Error('Fresh explicit fixture root required');
const record={status:'INCOMPLETE_VENDOR_FEASIBILITY',version:pin.version,root,checks:[],requests:[],hooks:[],children:[],independence:'LOW',scope:'Actual pinned native CLI, fixed loopback synthetic provider/hooks, fresh automatic user settings; manual permissions and ordinary default toolset, no product adapter/IDE/human/real provider/OS/all-descendant traffic claim.'};
let provider,hookServer,current,workspace,stage=0;
async function fileHash(file){const digest=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))digest.update(chunk);return digest.digest('hex');}
function send(res,tool){
 res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','request-id':'f19-fixture'});
 const emit=(event,data)=>res.write('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n');
 emit('message_start',{type:'message_start',message:{id:'msg_f19',type:'message',role:'assistant',model:'claude-sonnet-4-6',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:8,output_tokens:0}}});
 emit('content_block_start',{type:'content_block_start',index:0,content_block:tool?{type:'tool_use',id:'toolu_f19',name:'Read',input:{}}:{type:'text',text:''}});
 emit('content_block_delta',{type:'content_block_delta',index:0,delta:tool?{type:'input_json_delta',partial_json:JSON.stringify({file_path:path.join(workspace,current==='read-public'?'public.txt':'.env')})}:{type:'text_delta',text:'F19_SYNTHETIC_RESPONSE_COMPLETE'}});
 emit('content_block_stop',{type:'content_block_stop',index:0});emit('message_delta',{type:'message_delta',delta:{stop_reason:tool?'tool_use':'end_turn',stop_sequence:null},usage:{output_tokens:8}});emit('message_stop',{type:'message_stop'});res.end();
}
async function input(req,max){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('Bounded fixture input refused');chunks.push(chunk);}return Buffer.concat(chunks);}
async function run(name,providerUrl,hookUrl){
 current=name;stage=0;const profile=path.join(root,name,'profile');workspace=path.join(root,name,'workspace');for(const dir of[workspace,path.join(profile,'Temp'),path.join(profile,'claude')])fs.mkdirSync(dir,{recursive:true});
 write(path.join(workspace,'public.txt'),PUBLIC+'\n');write(path.join(workspace,'.env'),'F19_TOKEN='+privateValue+'\n');
 const settings={autoUpdates:false,env:{ANTHROPIC_BASE_URL:providerUrl,ANTHROPIC_API_KEY:'',ANTHROPIC_AUTH_TOKEN:KEY,CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_AUTOUPDATER:'1',DISABLE_TELEMETRY:'1',DISABLE_ERROR_REPORTING:'1'},alwaysThinkingEnabled:false,permissions:{defaultMode:'default',allow:['Read']},hooks:{}};
 const hook={type:'http',url:hookUrl,headers:{Authorization:'Bearer '+HOOK},timeout:2,onFailure:'block'};
 if(name!=='provider-public'){settings.hooks.PreToolUse=[{matcher:'Read',hooks:[hook]}];settings.hooks.UserPromptSubmit=[{hooks:[hook]}];}
 const settingsPath=path.join(profile,'claude/settings.json');write(settingsPath,JSON.stringify(settings));
 const env={};for(const key of['SystemRoot','WINDIR','COMSPEC'])if(process.env[key])env[key]=process.env[key];
 Object.assign(env,{USERPROFILE:profile,HOME:profile,APPDATA:path.join(profile,'AppData/Roaming'),LOCALAPPDATA:path.join(profile,'AppData/Local'),TEMP:path.join(profile,'Temp'),TMP:path.join(profile,'Temp'),CLAUDE_CONFIG_DIR:path.join(profile,'claude'),PATH:'C:/Windows/System32;C:/Windows/System32/WindowsPowerShell/v1.0;C:/Program Files/Git/cmd;C:/Program Files/nodejs',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(root,'empty-git-config'),GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never',CLAUDE_CODE_GIT_BASH_PATH:'C:/Program Files/Git/bin/bash.exe',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_AUTOUPDATER:'1',DISABLE_TELEMETRY:'1',DISABLE_ERROR_REPORTING:'1',CLAUDE_CODE_DISABLE_AUTO_MEMORY:'1',CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY:'1',DISABLE_INSTALLATION_CHECKS:'1',DO_NOT_TRACK:'1',CI:'1',CLAUDE_CODE_SKIP_PROMPT_HISTORY:'1',ANTHROPIC_API_KEY:'TEST_ONLY_F19_OLD_INHERITED_KEY',ANTHROPIC_AUTH_TOKEN:'TEST_ONLY_F19_OLD_INHERITED_AUTH',ANTHROPIC_BASE_URL:providerUrl+'/unmanaged-origin',ANTHROPIC_MODEL:'claude-sonnet-4-6',CLAUDE_CODE_MAX_RETRIES:'0'});
 const args=['--setting-sources','user','-p','Perform only this synthetic loopback fixture step.','--output-format','stream-json','--verbose','--no-session-persistence','--max-turns','2','--model','claude-sonnet-4-6',];
 const row={phase:name,closed:false,stdoutEOF:false,stderrEOF:false};record.children.push(row);
 const result=await new Promise(resolve=>{
  const child=cp.spawn(binary.path,args,{cwd:workspace,env,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout=[],stderr=[],outSize=0,errSize=0,settled=false;
  const finish=extra=>{if(settled)return;settled=true;clearTimeout(timer);resolve({...row,...extra});};
  const timer=setTimeout(()=>finish({status:'INCOMPLETE_RETAINED_NO_SIGNAL'}),45000);timer.unref();
  child.stdout.on('data',chunk=>{outSize+=chunk.length;if(outSize<=1048576)stdout.push(Buffer.from(chunk));});child.stderr.on('data',chunk=>{errSize+=chunk.length;if(errSize<=65536)stderr.push(Buffer.from(chunk));});
  child.stdout.once('end',()=>{row.stdoutEOF=true;});child.stderr.once('end',()=>{row.stderrEOF=true;});child.once('error',error=>finish({status:'LAUNCH_FAILED',code:error.code}));
  child.once('close',(code,signal)=>{row.closed=true;const out=Buffer.concat(stdout),err=Buffer.concat(stderr);write(path.join(root,name,'stdout.txt'),out);write(path.join(root,name,'stderr.txt'),err);row.exitCode=code;row.signal=signal;row.stdoutSha256=sha(out);row.stderrSha256=sha(err);row.stdoutBytes=outSize;row.stderrBytes=errSize;row.rawPrivateSeen=out.includes(Buffer.from(privateValue))||err.includes(Buffer.from(privateValue));row.authUnavailable=/authentication|invalid api key|not logged in|login required/i.test(out.toString()+err.toString());row.resultComplete=out.includes(Buffer.from('F19_SYNTHETIC_RESPONSE_COMPLETE'));finish({status:outSize<=1048576&&errSize<=65536?'CLOSED':'OVERSIZE'});});child.stdin.end();
 });
 const requests=record.requests.filter(v=>v.phase===name&&v.route.includes('/messages')&&!v.route.includes('/count_tokens')),hooks=record.hooks.filter(v=>v.phase===name);
 let pass=result.status==='CLOSED'&&result.closed&&result.stdoutEOF&&result.stderrEOF&&!result.rawPrivateSeen&&!record.privateOriginalLeak;
 if(name==='provider-public')pass&&=result.exitCode===0&&result.resultComplete&&requests.length>0&&requests.every(v=>v.configuredBearer&&!v.unmanagedOrigin);
 else if(name==='read-public')pass&&=result.exitCode===0&&requests.some(v=>v.publicSeen)&&hooks.some(v=>v.event==='PreToolUse'&&v.decision==='allow');
 else if(name==='prompt-outage')pass&&=requests.length===0&&hooks.some(v=>v.event==='UserPromptSubmit'&&v.failure===503);
 else pass&&=requests.length>0&&hooks.some(v=>v.event==='PreToolUse'&&(name==='read-private'?v.decision==='deny':v.failure===503))&&requests.every(v=>!v.privateOriginal);
 record.checks.push({phase:name,status:pass?'PASS':'FAIL',child:result,modelRequests:requests.length,hookCount:hooks.length});return result.closed&&(name==='provider-public'||hooks.length>0)&&!record.privateOriginalLeak;
}
(async()=>{
 assert.equal(await fileHash(binary.path),binary.sha256);fs.mkdirSync(root,{recursive:true});write(path.join(root,'empty-git-config'),'');
 provider=http.createServer(async(req,res)=>{try{
  const body=await input(req,262144);if(req.url.includes('count_tokens')){res.writeHead(200,{'content-type':'application/json'});res.end('{"input_tokens":16}');return;}
  const text=body.toString('utf8'),parsed=JSON.parse(text);if(text.includes(privateValue)){record.privateOriginalLeak=true;record.leakPhase=current;}
  const authenticated=req.headers['x-api-key']===KEY||req.headers.authorization==='Bearer '+KEY;
  record.requests.push({phase:current,route:req.url,bytes:body.length,authenticated,configuredBearer:req.headers.authorization==='Bearer '+KEY,unmanagedOrigin:req.url.startsWith('/unmanaged-origin'),publicSeen:text.includes(PUBLIC),privateOriginal:text.includes(privateValue),fields:Object.keys(parsed).sort(),tools:(parsed.tools||[]).map(v=>v.name)});
  if(!authenticated||record.privateOriginalLeak){res.writeHead(400,{'content-type':'application/json'});res.end('{"error":{"type":"invalid_request_error","message":"Fixture withheld"}}');return;}
  if(parsed.tools?.length&&!fs.existsSync(path.join(base,'native-tool-schemas-06.json')))write(path.join(base,'native-tool-schemas-06.json'),JSON.stringify(parsed.tools,null,2)+'\n');
  if(!fs.existsSync(path.join(base,'native-controls-06.json'))){const fields={};for(const key of['thinking','output_config','context_management','safeguards'])if(parsed[key]!==undefined)fields[key]=parsed[key];write(path.join(base,'native-controls-06.json'),JSON.stringify(fields,null,2)+'\n');}stage++;send(res,current!=='provider-public'&&current!=='prompt-outage'&&stage===1);
 }catch(error){record.providerFailure=true;record.providerFailureKind={name:error.name,code:error.code};res.writeHead(400);res.end('{}');}});
 hookServer=http.createServer(async(req,res)=>{try{const frame=JSON.parse((await input(req,65536)).toString('utf8')),event=frame.hook_event_name,authenticated=req.headers.authorization==='Bearer '+HOOK,cwdCurrent=path.resolve(frame.cwd||'').toLowerCase()===workspace.toLowerCase();const row={phase:current,event,authenticated,cwdCurrent};record.hooks.push(row);res.setHeader('content-type','application/json');
  if(!authenticated||!cwdCurrent){row.failure=403;res.writeHead(403);res.end('{}');return;}
  if(current==='prompt-outage'&&event==='UserPromptSubmit'||current==='read-hook-failure'&&event==='PreToolUse'){row.failure=503;res.writeHead(503);res.end('{}');return;}
  if(event==='PreToolUse'){const allowed=frame.tool_name==='Read'&&path.resolve(frame.tool_input?.file_path||'').toLowerCase()===path.join(workspace,'public.txt').toLowerCase();row.decision=allowed?'allow':'deny';res.end(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:row.decision,permissionDecisionReason:'Synthetic fixture permission'}}));return;}
  res.end('{}');
 }catch{res.writeHead(400);res.end('{}');}});
 await new Promise(done=>provider.listen(0,'127.0.0.1',done));await new Promise(done=>hookServer.listen(0,'127.0.0.1',done));const providerUrl='http://127.0.0.1:'+provider.address().port,hookUrl='http://127.0.0.1:'+hookServer.address().port+'/hook';
 for(const name of['provider-public'])if(!await run(name,providerUrl,hookUrl))break;
 assert.equal(await fileHash(binary.path),binary.sha256);record.binarySha256=binary.sha256;record.driverSha256=sha(fs.readFileSync(__filename));record.status=record.checks.length===1&&record.checks.every(v=>v.status==='PASS')&&!record.providerFailure&&!record.privateOriginalLeak?'PASS_SCOPED_DEFAULT_SYSTEM_AND_TOOLS_PUBLIC':'INCOMPLETE_VENDOR_FEASIBILITY';
})().catch(error=>{record.driverFailure={name:error.name,code:error.code};}).finally(async()=>{
 for(const server of[provider,hookServer])if(server?.listening)await new Promise(done=>{server.close(done);server.closeIdleConnections();});
 const text=JSON.stringify(record,null,2);for(const value of[privateValue,KEY,HOOK])assert.ok(!text.includes(value),'Private fixture value entered metadata');write(path.join(base,'vendor-feasibility-06.json'),text+'\n');console.log(JSON.stringify({status:record.status,root,checks:record.checks.map(({phase,status,modelRequests,hookCount,child})=>({phase,status,modelRequests,hookCount,exitCode:child.exitCode,authUnavailable:child.authUnavailable})),driverFailure:record.driverFailure}));if(record.status!=='PASS_SCOPED_DEFAULT_SYSTEM_AND_TOOLS_PUBLIC')process.exitCode=1;
});
