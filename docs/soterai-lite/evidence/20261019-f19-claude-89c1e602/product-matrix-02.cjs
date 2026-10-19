'use strict';
// Actual packaged extension controller + pinned native Claude CLI. LOW scripted
// editor API decisions. No webview prompt API or real-provider/OS claim.
const vscode=require("vscode"),fs=require("node:fs"),path=require("node:path"),http=require("node:http"),crypto=require("node:crypto"),cp=require("node:child_process"),assert=require("node:assert/strict");
const sha=value=>crypto.createHash("sha256").update(value).digest("hex"),write=(file,text)=>fs.writeFileSync(file,text,{flag:"wx"});
const PUBLIC="F19_NATIVE_PUBLIC_20261019",DONE="F19_NATIVE_RESPONSE_COMPLETE",UPSTREAM="TEST_ONLY_F19_UPSTREAM_CREDENTIAL";
let root,workspace,records,guard,contextSaved,provider,manager,privateValue="",phase="idle",turn=0,review="apply",readConsent="allow";
const until=async(fn,maximum=15000)=>{const deadline=Date.now()+maximum;while(Date.now()<deadline){if(await fn())return;await new Promise(done=>setTimeout(done,25));}throw Error("Fixture deadline");};
const safeError=error=>({name:error?.name||"Error",code:typeof error?.code==="string"&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:undefined});
exports.beforeActivate=async context=>{
 contextSaved=context;root=process.env.SOTERAI_F19_PRODUCT_ROOT;workspace=vscode.workspace.workspaceFolders[0].uri.fsPath;
 assert(path.resolve(root).toLowerCase().startsWith("d:\\soterai-lite-test-profiles\\f19-product-"));
 records={status:"INCOMPLETE_PRODUCT_MATRIX",scope:"ACTUAL_EXACT_VSIX_EDITOR_CONTROLLER_AND_PINNED_CLAUDE_NATIVE_CLI",independence:"LOW",checks:[],requests:[],hooks:[],mcp:[],modals:[],native:[],phase:"setup",
 limits:["Scripted native editor decisions/developer bootstrap; not clean installed VSIX or human review","Vendor webview prompt session UNVERIFIED; CLI text route only","Current owner badge Uncovered","Parent Node guards are not OS or all-descendant traffic certification"]};
 guard=require("./matrix-guards-01.cjs").install(root,records);
 for(const name of ["showInformationMessage","showErrorMessage"])Object.defineProperty(vscode.window,name,{configurable:true,writable:true,value:async()=>undefined});
 Object.defineProperty(vscode.window,"showWarningMessage",{configurable:true,writable:true,value:async(message,options,...actions)=>{
  if(!options?.modal)return;
  const detail=String(options.detail||"");if(privateValue&&detail.includes(privateValue))throw Error("Private canary entered review");
  records.modals.push({phase,kind:message.startsWith("Allow one safe read")?"safe-read":message.startsWith("Review pinned Claude")?"config":"other",bytes:Buffer.byteLength(detail),sha256:sha(detail)});
  if(message.startsWith("Review pinned Claude"))return review==="apply"?actions.find(action=>["Apply reviewed Claude changes","Restore reviewed Claude config"].includes(action)):undefined;
  if(message.startsWith("Allow one safe read"))return readConsent==="allow"?"Allow safe read once":undefined;
 }});
 // Capture only protocol metadata, constant decisions, and synthetic-canary
 // membership. Do not persist hook prompts, source contents or capabilities.
 const emit=http.Server.prototype.emit;
 http.Server.prototype.emit=function(event,...args){
  if(event==="request"){
   const[req,res]=args;if(["/claude/hooks","/claude/mcp"].includes(req.url)){
    const row={phase,code:undefined};(req.url==="/claude/hooks"?records.hooks:records.mcp).push(row);
    let chunks=[],size=0;req.on("data",part=>{size+=part.length;if(size<=65536)chunks.push(Buffer.from(part));});
    req.on("end",()=>{try{const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));row.bytes=size;
     if(req.url==="/claude/hooks"){row.event=body.hook_event_name;row.tool=body.tool_name;row.fields=Object.keys(body).sort();row.permissionMode=typeof body.permission_mode==="string"&&body.permission_mode.length<=32?body.permission_mode:"OTHER";row.effort=body.effort===null?null:typeof body.effort==="string"&&body.effort.length<=16?body.effort:typeof body.effort;row.inputFields=body.tool_input&&typeof body.tool_input==="object"?Object.keys(body.tool_input).sort():undefined;row.privatePromptSeen=typeof body.prompt==="string"&&privateValue&&body.prompt.includes(privateValue);}
     else row.method=body.method;
    }catch{row.invalid=true;}});
    const end=res.end;res.end=function(value,...rest){if(req.url==="/claude/hooks"&&value){try{row.denied=JSON.parse(String(value)).hookSpecificOutput?.permissionDecision==="deny";}catch{row.invalidResponse=true;}}return Reflect.apply(end,this,[value,...rest]);};
    res.once("finish",()=>row.code=res.statusCode);
   }
  }return Reflect.apply(emit,this,[event,...args]);
 };
 // Vendor extension discovery/pin only. Its webview is deliberately not driven
 // through private messages; actual native CLI is launched below.
 const vendor=path.join(root,"extensions/anthropic.claude-code-2.1.301-win32-x64");
 fs.writeFileSync(path.join(vendor,"package.json"),fs.readFileSync(path.join(vendor,".f19-original-package.json")));
};
function stream(res,tool){
 res.writeHead(200,{"content-type":"text/event-stream","cache-control":"no-store","request-id":"f19-product"});
 const emit=(event,body)=>res.write("event: "+event+"\ndata: "+JSON.stringify(body)+"\n\n");
 emit("message_start",{type:"message_start",message:{id:"msg_f19",type:"message",role:"assistant",model:"claude-sonnet-4-6",content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:8,output_tokens:0}}});
 emit("content_block_start",{type:"content_block_start",index:0,content_block:tool?{type:"tool_use",id:"toolu_f19",name:tool.name,input:{}}:{type:"text",text:""}});
 emit("content_block_delta",{type:"content_block_delta",index:0,delta:tool?{type:"input_json_delta",partial_json:JSON.stringify(tool.input)}:{type:"text_delta",text:DONE}});
 emit("content_block_stop",{type:"content_block_stop",index:0});
 emit("message_delta",{type:"message_delta",delta:{stop_reason:tool?"tool_use":"end_turn",stop_sequence:null},usage:{output_tokens:8}});
 emit("message_stop",{type:"message_stop"});res.end();
}
async function native(name,prompt="Perform only the next synthetic local fixture step."){
 phase=records.phase=name;turn=0;
 const profile=process.env.USERPROFILE,env={};for(const key of["SystemRoot","WINDIR","COMSPEC"])if(process.env[key])env[key]=process.env[key];
 Object.assign(env,{USERPROFILE:profile,HOME:profile,APPDATA:path.join(profile,"AppData/Roaming"),LOCALAPPDATA:path.join(profile,"AppData/Local"),TEMP:path.join(profile,"Temp"),TMP:path.join(profile,"Temp"),
  CLAUDE_CONFIG_DIR:path.join(profile,"claude"),PATH:"C:/Windows/System32;C:/Windows/System32/WindowsPowerShell/v1.0;C:/Program Files/Git/cmd;C:/Program Files/nodejs",
  GIT_CONFIG_NOSYSTEM:"1",GIT_CONFIG_GLOBAL:path.join(root,"empty-git-config"),GIT_TERMINAL_PROMPT:"0",GCM_INTERACTIVE:"never",CLAUDE_CODE_GIT_BASH_PATH:"C:/Program Files/Git/bin/bash.exe",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:"1",DISABLE_AUTOUPDATER:"1",DISABLE_TELEMETRY:"1",DISABLE_ERROR_REPORTING:"1",CLAUDE_CODE_DISABLE_AUTO_MEMORY:"1",CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY:"1",DISABLE_INSTALLATION_CHECKS:"1",DO_NOT_TRACK:"1",CI:"1",CLAUDE_CODE_SKIP_PROMPT_HISTORY:"1",
  ANTHROPIC_API_KEY:"TEST_ONLY_F19_INHERITED_OLD_KEY",ANTHROPIC_AUTH_TOKEN:"TEST_ONLY_F19_INHERITED_OLD_AUTH",ANTHROPIC_BASE_URL:records.providerUrl+"/unmanaged-origin",ANTHROPIC_MODEL:"claude-sonnet-4-6",CLAUDE_CODE_MAX_RETRIES:"0"});
 const binary=path.join(root,"extensions/anthropic.claude-code-2.1.301-win32-x64/resources/native-binary/claude.exe");
 const args=["--setting-sources","user","-p",prompt,"--output-format","stream-json","--verbose","--no-session-persistence","--max-turns","2","--model","claude-sonnet-4-6"];
 const row={phase:name,closed:false,stdoutEOF:false,stderrEOF:false};records.native.push(row);
 await new Promise(resolve=>{
  let settled=false,out=[],err=[],outSize=0,errSize=0;
  const child=cp.spawn(binary,args,{cwd:workspace,env,windowsHide:true,stdio:["pipe","pipe","pipe"]});
  const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);resolve();};
  const timer=setTimeout(()=>{row.timeout=true;finish();},45000);timer.unref();
  child.stdout.on("data",part=>{outSize+=part.length;if(outSize<=1048576)out.push(Buffer.from(part));});
  child.stderr.on("data",part=>{errSize+=part.length;if(errSize<=65536)err.push(Buffer.from(part));});
  child.stdout.once("end",()=>row.stdoutEOF=true);child.stderr.once("end",()=>row.stderrEOF=true);
  child.once("error",error=>{row.launchFailure=safeError(error);finish();});
  child.once("close",(code,signal)=>{
   row.closed=true;row.exitCode=code;row.signal=signal;
   const stdout=Buffer.concat(out),stderr=Buffer.concat(err);write(path.join(root,"native-"+name+"-stdout.txt"),stdout);write(path.join(root,"native-"+name+"-stderr.txt"),stderr);
   row.stdoutSha256=sha(stdout);row.stderrSha256=sha(stderr);row.stdoutBytes=outSize;row.stderrBytes=errSize;row.complete=stdout.includes(Buffer.from(DONE));
   row.privateOutputSeen=stdout.includes(Buffer.from(privateValue))||stderr.includes(Buffer.from(privateValue));
   finish();
  });child.stdin.end();
 });
 if(!(row.closed&&row.stdoutEOF&&row.stderrEOF&&!row.timeout&&!row.launchFailure&&row.stdoutBytes<=1048576&&row.stderrBytes<=65536))records.nativeRetained=true;
 assert(!records.nativeRetained,"Native child incomplete");
 return row;
}
exports.run=async context=>{
 assert.equal(context,contextSaved);const check=async(id,fn)=>{try{await fn();records.checks.push({id,status:"PASS"});}catch(error){records.checks.push({id,status:"FAIL",error:safeError(error),fixtureDeadline:error?.message==="Fixture deadline"});if(records.nativeRetained)throw Error("Incomplete native child retained; dependent checks stopped");}};
 const requests=name=>records.requests.filter(item=>item.phase===name);
 try{
  manager=context.subscriptions.find(item=>typeof item.ownedSnapshot==="function");assert(manager,"Packaged broker manager required");
  provider=http.createServer(async(req,res)=>{try{
   let size=0,chunks=[];for await(const part of req){size+=part.length;if(size>262144)throw Error("Too large");chunks.push(part);}
   const bytes=Buffer.concat(chunks),body=JSON.parse(bytes.toString("utf8")),text=JSON.stringify(body);
   if(text.includes(privateValue)){records.privateOriginalLeak=true;throw Error("Private canary reached collector");}
   const auth=req.headers["x-api-key"]===UPSTREAM,tools=(body.tools||[]).map(item=>item.name);
   records.requests.push({phase,route:req.url,bytes:size,upstreamAuth:auth,publicSeen:text.includes(PUBLIC),maskedEnvSeen:text.includes("F19_TOKEN")&&text.includes("[MASKED]"),privateOriginal:false,tools});
   assert(auth,"Controlled upstream credential required");turn++;
   const safe=tools.find(name=>name==="mcp__soterai_safe_read__soterai_read_project_file_safely");
   const target=path.join(workspace,"public.txt"),envPath=path.join(workspace,".env");
   const cases={
    "read-public":{name:"Read",input:{file_path:target}},"read-private":{name:"Read",input:{file_path:envPath}},
    "write-public":{name:"Write",input:{file_path:path.join(workspace,"created.txt"),content:PUBLIC+" CREATED\n"}},
    "write-private":{name:"Write",input:{file_path:envPath,content:"F19_TOKEN=UNAPPROVED_CHANGE\n"}},
    "edit-public":{name:"Edit",input:{file_path:target,old_string:PUBLIC,new_string:PUBLIC+" EDITED"}},
    "edit-private":{name:"Edit",input:{file_path:envPath,old_string:"PORT=1234",new_string:"PORT=9999"}},
    "search-public":{name:"Grep",input:{path:target,pattern:"F19_NATIVE_PUBLIC",output_mode:"content"}},
    "search-private":{name:"Grep",input:{path:envPath,pattern:"F19_TOKEN",output_mode:"content"}},
    "shell-private":{name:"Bash",input:{command:"cat .env",description:"Synthetic denied file read"}},
    "git-private":{name:"Bash",input:{command:"git log --all --oneline",description:"Synthetic denied Git command"}},
    "self-settings":{name:"Write",input:{file_path:path.join(workspace,".claude/settings.json"),content:"{}"}},
    "mcp-public":{name:safe,input:{path:"public.txt"}},"mcp-env":{name:safe,input:{path:".env"}},"mcp-cancel":{name:safe,input:{path:".env"}},
   };
   if(phase.startsWith("mcp-"))assert(safe,"Actual safe MCP name required");
   stream(res,turn===1?cases[phase]:undefined);
  }catch{records.providerFailure=true;res.writeHead(400,{"content-type":"application/json"});res.end('{"error":{"type":"invalid_request_error","message":"Fixture withheld"}}');}});
  await new Promise(done=>provider.listen(0,"127.0.0.1",done));records.providerUrl="http://127.0.0.1:"+provider.address().port;
  const config=vscode.workspace.getConfiguration("soterai");await config.update("broker.anthropicProviderUrl",records.providerUrl,vscode.ConfigurationTarget.Global);await context.secrets.store("soterai.providerApiKey",UPSTREAM);
  const canary=await Reflect.get(manager,"canaries").create();privateValue=canary.token;guard.setPrivateCanary(privateValue);await manager.stop();
  write(path.join(workspace,"public.txt"),PUBLIC+"\n");write(path.join(workspace,".env"),"F19_TOKEN="+privateValue+"\nPORT=1234\n");write(path.join(root,"empty-git-config"),"");
  const directory=path.join(process.env.USERPROFILE,"claude");fs.mkdirSync(directory,{recursive:true});
  const settingsFile=path.join(directory,"settings.json"),stateFile=path.join(directory,".claude.json");
  write(settingsFile,JSON.stringify({permissions:{defaultMode:"default",allow:["Read","Edit","Write","Grep","mcp__soterai_safe_read__soterai_read_project_file_safely"],deny:["Read(unrelated-synthetic-protected.txt)"]},env:{ANTHROPIC_API_KEY:"TEST_ONLY_F19_OLD_PROFILE_KEY"},alwaysThinkingEnabled:false}));
  write(stateFile,JSON.stringify({nativePublic:"preserve"}));const originalSettings=fs.readFileSync(settingsFile),originalState=fs.readFileSync(stateFile),privateBefore=sha(fs.readFileSync(path.join(workspace,".env")));
  await check("F19-N01",async()=>{review="cancel";const result=await vscode.commands.executeCommand("soterai.configurePinnedClaude");records.cancelStatus=result?.status;assert.equal(result?.status,"CANCELLED");assert(fs.readFileSync(settingsFile).equals(originalSettings));assert(fs.readFileSync(stateFile).equals(originalState));});
  await check("F19-N02",async()=>{review="apply";const result=await vscode.commands.executeCommand("soterai.configurePinnedClaude");records.configureStatus=result?.status;assert.equal(result?.status,"APPLIED");const saved=JSON.parse(fs.readFileSync(settingsFile));assert.equal(saved.hooks.PreToolUse[0].hooks[0].onFailure,"block");assert(saved.permissions.deny.includes("Read(unrelated-synthetic-protected.txt)"));});
  assert.equal(records.configureStatus,"APPLIED","Dependent native routes require current product setup");records.controllerStages=[];const adapter=context.subscriptions.find(item=>typeof item.configure==="function"&&typeof item.status==="function"&&item.status()?.version==="2.1.301");
if(adapter)for(const name of["projectEligible","read","artifact"]){const original=adapter[name];if(typeof original!=="function")continue;adapter[name]=async function(...args){try{const result=await Reflect.apply(original,this,args);if(records.controllerStages.length<500)records.controllerStages.push({phase,method:name,file:name==="read"?path.basename(args[0]):undefined,result:typeof result==="boolean"?result:typeof result==="string"?"STRING_"+Buffer.byteLength(result):typeof result});return result;}catch(error){records.controllerStages.push({phase,method:name,error:safeError(error)});throw error;}};}
  await check("F19-N03",async()=>{const row=await native("provider-public");assert.equal(row.exitCode,0);assert(row.complete);assert(requests("provider-public").length>0);});
  await check("F19-N04",async()=>{await native("read-public");assert(requests("read-public").some(item=>item.publicSeen));assert(records.hooks.some(item=>item.phase==="read-public"&&item.event==="PreToolUse"&&item.code===200&&!item.denied));});
  if(records.checks.some(item=>item.id==="F19-N04"&&item.status!=="PASS"))throw Error("Diagnostic stops dependent routes after public native failure");
await check("F19-N05",async()=>{await native("read-private");assert(records.hooks.some(item=>item.phase==="read-private"&&item.tool==="Read"&&item.denied));assert(requests("read-private").every(item=>!item.privateOriginal));});
  await check("F19-N06",async()=>{await native("write-public");assert(fs.readFileSync(path.join(workspace,"created.txt"),"utf8").includes("CREATED"));});
  await check("F19-N07",async()=>{await native("edit-public");assert(fs.readFileSync(path.join(workspace,"public.txt"),"utf8").includes("EDITED"));});
  await check("F19-N08",async()=>{await native("search-public");assert(requests("search-public").some(item=>item.publicSeen));});
  for(const[id,name,tool]of[["F19-N09","write-private","Write"],["F19-N10","edit-private","Edit"],["F19-N11","search-private","Grep"],["F19-N12","shell-private","Bash"],["F19-N13","git-private","Bash"],["F19-N14","self-settings","Write"]])await check(id,async()=>{await native(name);assert(records.hooks.some(item=>item.phase===name&&item.tool===tool&&item.denied));assert.equal(sha(fs.readFileSync(path.join(workspace,".env"))),privateBefore);});
  await check("F19-N15",async()=>{await native("mcp-public");assert(requests("mcp-public").some(item=>item.publicSeen));assert(records.mcp.some(item=>item.phase==="mcp-public"&&item.method==="tools/call"&&item.code===200));});
  await check("F19-N16",async()=>{await native("mcp-env");assert(requests("mcp-env").some(item=>item.maskedEnvSeen));assert(records.modals.some(item=>item.phase==="mcp-env"&&item.kind==="safe-read"));});
  await check("F19-N17",async()=>{readConsent="cancel";await native("mcp-cancel");assert(!requests("mcp-cancel").some(item=>item.maskedEnvSeen));assert(records.modals.some(item=>item.phase==="mcp-cancel"&&item.kind==="safe-read"));readConsent="allow";});
  await check("F19-N18",async()=>{await native("registered-prompt","Synthetic registered context: "+privateValue);assert(records.hooks.some(item=>item.phase==="registered-prompt"&&item.privatePromptSeen));assert.equal(requests("registered-prompt").length,0);});
  await check("F19-N19",async()=>{const before=fs.readFileSync(settingsFile);fs.writeFileSync(settingsFile,Buffer.concat([before,Buffer.from(" ")]));try{const result=await vscode.commands.executeCommand("soterai.restorePinnedClaude");assert.equal(result?.status,"CHANGED");}finally{fs.writeFileSync(settingsFile,before);}});
  await check("F19-N20",async()=>{await config.update("lite.claudeAdapter",false,vscode.ConfigurationTarget.Global);await native("flag-off");assert.equal(requests("flag-off").length,0);assert(records.hooks.some(item=>item.phase==="flag-off"&&item.code===503));});
  await config.update("lite.claudeAdapter",true,vscode.ConfigurationTarget.Global);
  await check("F19-N21",async()=>{review="cancel";const before=sha(fs.readFileSync(settingsFile));assert.equal((await vscode.commands.executeCommand("soterai.restorePinnedClaude"))?.status,"CANCELLED");assert.equal(sha(fs.readFileSync(settingsFile)),before);});
  await check("F19-N22",async()=>{review="apply";assert.equal((await vscode.commands.executeCommand("soterai.restorePinnedClaude"))?.status,"RESTORED");assert(fs.readFileSync(settingsFile).equals(originalSettings));const state=JSON.parse(fs.readFileSync(stateFile));assert.equal(state.nativePublic,"preserve");assert.equal(state.mcpServers,undefined);assert(Object.keys(state).some(key=>key!=="nativePublic"));records.unownedNativeStatePreserved=true;records.encryptedBackups=fs.readdirSync(path.join(context.globalStorageUri.fsPath,"config-backups")).length;assert.equal(records.encryptedBackups,2);});
 }catch(error){records.driverFailure=safeError(error);}
 finally{
  try{await manager?.stop();}catch{records.brokerShutdown="UNCONFIRMED";}
  try{await until(()=>guard.children.every(item=>item.closed&&item.stdoutEOF&&item.stderrEOF),8000);}catch{records.childShutdown="UNCONFIRMED";}
  if(provider)await new Promise(done=>{provider.close(done);provider.closeIdleConnections();});
  records.children=guard.children;records.runtimeSha256=sha(fs.readFileSync(path.join(context.extensionUri.fsPath,"dist/extension.js")));
  records.status=records.checks.length===22&&records.checks.every(item=>item.status==="PASS")&&!records.driverFailure&&!records.childShutdown&&!records.privateOriginalLeak&&!records.providerFailure?"PASS_SCOPED_PRODUCT_CLI_MATRIX":"INCOMPLETE_PRODUCT_MATRIX";
  const text=JSON.stringify(records,null,2);for(const secret of[privateValue,UPSTREAM])if(secret)assert(!text.includes(secret),"Private fixture value entered metadata");
  write(process.env.SOTERAI_F19_PRODUCT_RESULT,text+"\n");
 }
};
