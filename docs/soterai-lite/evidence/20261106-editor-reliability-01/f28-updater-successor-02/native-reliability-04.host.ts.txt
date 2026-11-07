/** F28 actual isolated packaged-command fixture. Scripted choices/scheduling,
 * LOW independence. No Git push, real secrets, normal profile or signals. */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import childProcess from "node:child_process";
import { createHash } from "node:crypto";

const PREFIX="SOTERAI_LITE_F28_",FLAG="lite.reliability",MARKER=".synthetic-lite-f28-host";
const PUBLIC="Public F28 operational note.\n",PRIVATE="SYNTHETIC_F28_VALUE_NEVER_RELEASE_20261101";
const ENV="PRIVATE_TOKEN="+PRIVATE+"\nPUBLIC_PORT=8080\n",MASKED="PRIVATE_TOKEN=[MASKED]\nPUBLIC_PORT=[MASKED]";
const originalOpen=fsp.open,sha=(v:string|Uint8Array)=>createHash("sha256").update(v).digest("hex");
type Row={id:string;scope:string;status:"NOT_RUN"|"PASS"|"FAIL";errorName?:string;assertion?:{operator:string;actual:boolean|number|string;expected:boolean|number|string};lastReadStatus?:string};
type Result={status:string;text?:string;kind?:string};
type Status={status:string;activeReads:number;startupMilliseconds?:number;limits:{readMilliseconds:number;readBytes:number;concurrentReads:number;startupMilliseconds:number}};
const primaryScopes=[
 "Exact four packaged runtimes, driver, default-true restricted machine setting and native command",
 "Actual activation-body measurement is within the fixed startup bound and reader is ready",
 "Actual packaged public read has exact native consent and useful output",
 "Sensitive saved environment returns names with every value masked and no original document",
 "Cancelled actual native consent releases no text",
 "Oversized default input reaches no consent and releases no prefix",
 "Binary and malformed UTF8 saved inputs release no partial result",
 "Actual multiple-hardlink input is withheld",
 "Actual internal Windows directory junction is withheld",
 "Actual workspace-root junction alias is withheld",
 "Deterministically scheduled actual file replacement before open is withheld before consent",
 "Deterministically scheduled actual parent replacement before open is withheld before consent",
 "Deterministically scheduled actual same-length content drift is withheld before consent",
 "Actual second workspace root preserves independent policy and public control",
 "Actual workspace-folder change revokes a pending native approval",
 "Flag withdrawal with unfinished real open withholds and retains its slot until observed close",
 "Disabled shared reader withholds new original reads",
 "Re-enable requires a fresh native consent and exact public control",
 "Actual five-second owned read expiry withholds while unfinished IO keeps its slot until real close",
 "Actual packaged selected128 reads in a4096-file repo remain under the whole-scan measurement bound",
 "Two concurrent isolated native windows preserve machine-flag/read isolation and close the peer naturally",
 "Actual filesystem outage is a generic withheld result without raw diagnostic reflection",
 "No original synthetic environment value enters native TextDocuments or public result metadata",
 "Runtime bytes stay exact and all delayed source handles are observed closed",
 "Primary withdrawal persists disabled state and an exact restart basis with no active reads",
];
const restartScopes=[
 "Actual same-profile restart preserves exact runtime and disabled shared reader",
 "Re-enable after restart requires fresh exact native public consent",
 "Sensitive saved values remain masked after restart",
 "Pending approval is revoked by disabling the guard without returning originals",
 "Reviewed fixture withdrawal restores the original owner setting and observes zero active reads",
];
let root="",parent="",profile="",output="",phase="",config:vscode.WorkspaceConfiguration;
let decision:(...args:unknown[])=>Promise<unknown>=async()=>"Allow safe read once",prompts=0,docEvents=0,originalFlag:boolean|undefined;
let lastReadStatus="NONE";
let sourceOpened=0,sourceClosed=0,fixtureHandles=0,driverFailure:string|null=null;
const restorers:Array<()=>void>=[],listeners:vscode.Disposable[]=[],measurements:Array<Record<string,unknown>>=[],peerChildren:Array<Record<string,unknown>>=[];
const peerOwner={started:false,closed:false,stdoutEOF:false,stderrEOF:false,timedOut:false};
export function setupDiagnostic(){return{halted:fixtureHandles!==0||peerOwner.started&&(!peerOwner.closed||!peerOwner.stdoutEOF||!peerOwner.stderrEOF),busyChildren:peerOwner.started&&!peerOwner.closed?1:0,timedOutChildren:peerOwner.timedOut?1:0,unfinishedFixtureHandles:fixtureHandles};}
const wait=(ms:number)=>new Promise<void>(done=>setTimeout(done,ms));
async function bounded<T>(work:Promise<T>,milliseconds=10000):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(Error("Bounded synthetic operation incomplete.")),milliseconds);})]);}finally{clearTimeout(timer);}}
async function until(predicate:()=>boolean|Promise<boolean>,milliseconds=10000):Promise<void>{const end=performance.now()+milliseconds;while(performance.now()<end){if(await predicate())return;await wait(20);}throw Error("Bounded synthetic observation incomplete.");}
async function changeFolders(index:number,remove:number,expected:number,...added:{uri:vscode.Uri}[]):Promise<void>{
 let confirmed=false;
 const subscription=vscode.workspace.onDidChangeWorkspaceFolders(event=>{
  if(event.added.length===added.length&&event.removed.length===remove&&added.every(value=>event.added.some(folder=>folder.uri.toString()===value.uri.toString())))confirmed=true;
 });
 try{assert(vscode.workspace.updateWorkspaceFolders(index,remove,...added));await until(()=>confirmed&&vscode.workspace.workspaceFolders?.length===expected);}
 finally{subscription.dispose();}
}
function patch(target:object,name:string,value:unknown):()=>void{const item=target as Record<string,unknown>,old=item[name];item[name]=value;let restored=false;const restore=()=>{if(!restored){restored=true;item[name]=old;}};restorers.push(restore);return restore;}
function within(base:string,file:string):boolean{const relative=path.relative(path.resolve(base),path.resolve(file));return relative===""||relative!==".."&&!relative.startsWith(".."+path.sep)&&!path.isAbsolute(relative);}
const file=(relative:string)=>path.join(root,relative),uri=(relative:string)=>vscode.Uri.file(file(relative));
async function put(filename:string,value:unknown):Promise<void>{assert(within(parent,filename));await fsp.writeFile(filename,JSON.stringify(value,null,2)+"\n",{flag:"wx"});}
async function status():Promise<Status>{const value=await vscode.commands.executeCommand<Status>("soterai.readReliabilityStatus");assert(value);return value;}
async function setFlag(value:boolean|undefined):Promise<void>{await config.update(FLAG,value,vscode.ConfigurationTarget.Global);await until(()=>config.inspect<boolean>(FLAG)?.globalValue===value);await wait(30);}
function withheld(value:Result):void{assert(value&&value.status!=="ALLOWED_ONCE");assert.equal(Object.hasOwn(value,"text"),false);assert(!JSON.stringify(value).includes(PRIVATE));}
async function read(relative:string):Promise<Result>{const result=await vscode.commands.executeCommand<Result>("soterai.readProjectFileSafely",uri(relative));assert(result);lastReadStatus=["ALLOWED_ONCE","DENIED","UNAVAILABLE","CHANGED","EXPIRED","BUSY"].includes(result.status)?result.status:"UNKNOWN";return result;}
async function publicRead(relative="public.txt"):Promise<void>{const before=prompts,result=await read(relative);assert.equal(result.status,"ALLOWED_ONCE");assert.equal(result.text,PUBLIC);assert.equal(prompts,before+1);}
async function runtimes(context:vscode.ExtensionContext):Promise<Array<{name:string;bytes:number;sha256:string}>>{
 const extension=vscode.extensions.getExtension("soterai.soterai-ide-guard");assert(extension&&extension.isActive);assert.equal(extension.extensionPath.toLowerCase(),context.extensionPath.toLowerCase());
 const rows=[];for(const name of ["extension.js","local-ai-broker.js","soterai-mcp-server.js","pre-commit-client.js"]){const raw=await fsp.readFile(path.join(extension.extensionPath,"dist",name));rows.push({name,bytes:raw.length,sha256:sha(raw)});}
 assert.equal(rows[0].sha256,process.env[PREFIX+"BUNDLE_SHA256"]);return rows;
}
export async function beforeActivate(context:vscode.ExtensionContext):Promise<void>{
 phase=process.env[PREFIX+"PHASE"]??"";output=process.env[PREFIX+"EVIDENCE"]??"";profile=process.env[PREFIX+"PROFILE"]??"";
 assert(["primary","restart","peer"].includes(phase));assert(path.isAbsolute(output)&&path.isAbsolute(profile));assert.equal(context.extensionMode,vscode.ExtensionMode.Development);
 assert.equal(vscode.workspace.workspaceFolders?.length,1);root=vscode.workspace.workspaceFolders![0].uri.fsPath;parent=path.dirname(root);
 assert(/^D:\\SoterAI-Lite-test-profiles\\f28-reliability-native-[0-9TZ]+-[a-f0-9]{8}\\workspace$/i.test(root));
 assert.equal(path.resolve(profile).toLowerCase(),path.join(parent,phase==="peer"?"peer-profile":"profile").toLowerCase());
 assert.equal(path.resolve(process.env.USERPROFILE??"").toLowerCase(),path.resolve(profile).toLowerCase());assert(within(parent,output)&&!within(root,output));
 assert.equal(await fsp.readFile(file(MARKER),"utf8"),"synthetic-only-v1");assert(vscode.workspace.isTrusted&&!vscode.env.remoteName);
 config=vscode.workspace.getConfiguration("soterai");originalFlag=config.inspect<boolean>(FLAG)?.globalValue;
 await context.globalState.update("soterai.onboarded",true);
 patch(vscode.window,"showWarningMessage",async(...args:unknown[])=>{if(args.includes("Allow safe read once")){prompts++;assert(!String((args[1] as {detail?:string})?.detail??"").includes(PRIVATE));return decision(...args);}return undefined;});
 for(const name of ["showInformationMessage","showErrorMessage"])patch(vscode.window,name,async()=>undefined);
 listeners.push(vscode.workspace.onDidOpenTextDocument(document=>{if(document.uri.scheme==="file"&&document.uri.fsPath.toLowerCase()===file(".env.f28").toLowerCase())docEvents++;}));
 if(phase==="primary"){
  await fsp.writeFile(file("public.txt"),PUBLIC,{flag:"wx"});await fsp.writeFile(file(".env.f28"),ENV,{flag:"wx"});
  for(const name of ["file-race.txt","content-race.txt","cancel-open.txt","timeout-open.txt","outage.txt"])await fsp.writeFile(file(name),"public",{flag:"wx"});
  await fsp.mkdir(file("parent-race"));await fsp.writeFile(file("parent-race/public.txt"),"public",{flag:"wx"});
  await fsp.mkdir(file("bulk"));for(let first=0;first<4096;first+=32)await Promise.all(Array.from({length:32},(_,j)=>fsp.writeFile(file("bulk/public-"+(first+j)+".txt"),PUBLIC,{flag:"wx"})));
 }
}
async function delayedOpen(relative:string,action:(pending:Promise<Result>,opened:()=>number,closed:()=>number)=>Promise<void>):Promise<void>{
 const target=file(relative);let enter!:()=>void,release!:()=>void,opened=0,closed=0;
 const entered=new Promise<void>(resolve=>{enter=resolve;}),hold=new Promise<void>(resolve=>{release=resolve;});
 const restore=patch(fsp,"open",async(...args:Parameters<typeof fsp.open>)=>{const handle=await originalOpen(...args);if(path.resolve(String(args[0])).toLowerCase()!==target.toLowerCase())return handle;
  sourceOpened++;fixtureHandles++;opened++;const close=handle.close.bind(handle);let didClose=false;patch(handle,"close",async()=>{await close();if(!didClose){didClose=true;sourceClosed++;fixtureHandles--;closed++;}});enter();await hold;return handle;});
 const pending=read(relative);void pending.catch(()=>undefined);
 try{await until(async()=>{await Promise.race([entered,wait(20)]);return opened>0;});await action(pending,()=>opened,()=>closed);}
 finally{release();await until(()=>closed===opened);restore();await wait(30);}
}
async function peerRun(context:vscode.ExtensionContext):Promise<void>{
 const ready=path.join(parent,"f28-peer-ready.json"),probe=path.join(parent,"f28-peer-probe.json"),answer=path.join(parent,"f28-peer-answer.json"),stop=path.join(parent,"f28-peer-stop.json");
 await runtimes(context);assert.equal((await status()).status,"READY");await put(ready,{status:"READY",hostPid:process.pid,version:vscode.version,bundle:process.env[PREFIX+"BUNDLE_SHA256"]});
 await until(async()=>fsp.stat(probe).then(()=>true,()=>false),60000);await publicRead();await put(answer,{status:"PASS",reader:(await status()).status,publicDigest:sha(PUBLIC),prompts});
 await until(async()=>fsp.stat(stop).then(()=>true,()=>false),60000);assert.equal((await status()).activeReads,0);
 await put(output,{status:"PASS_SCOPED_F28_PEER_NATIVE_PUBLIC_CONTROL",runtimeBindings:await runtimes(context),driverFailure:null,signalsRequested:0});
}
async function concurrentPeer(context:vscode.ExtensionContext):Promise<void>{
 const peerProfile=path.join(parent,"peer-profile"),extensions=path.join(parent,"peer-extensions"),ready=path.join(parent,"f28-peer-ready.json"),probe=path.join(parent,"f28-peer-probe.json"),answer=path.join(parent,"f28-peer-answer.json"),stop=path.join(parent,"f28-peer-stop.json");
 await fsp.mkdir(path.join(peerProfile,"User"),{recursive:true});await fsp.mkdir(path.join(peerProfile,"Temp"));await fsp.mkdir(extensions);
 await fsp.writeFile(path.join(peerProfile,"User/settings.json"),await fsp.readFile(path.join(profile,"User/settings.json")),{flag:"wx"});
 const env:NodeJS.ProcessEnv={};for(const key of ["SystemRoot","WINDIR","COMSPEC"])if(process.env[key])env[key]=process.env[key];
 Object.assign(env,{USERPROFILE:peerProfile,APPDATA:path.join(peerProfile,"AppData/Roaming"),LOCALAPPDATA:path.join(peerProfile,"AppData/Local"),TEMP:path.join(peerProfile,"Temp"),TMP:path.join(peerProfile,"Temp"),GIT_CONFIG_NOSYSTEM:"1",GIT_CONFIG_GLOBAL:path.join(profile,"empty-global.gitconfig"),GIT_CONFIG_SYSTEM:path.join(profile,"empty-system.gitconfig")});
 for(const suffix of ["BUNDLE_SHA256","DRIVER_SHA256","SOURCE_PROOF_SHA256","VSIX_SHA256"])env[PREFIX+suffix]=process.env[PREFIX+suffix];
 env[PREFIX+"PROFILE"]=peerProfile;env[PREFIX+"PHASE"]="peer";env[PREFIX+"EVIDENCE"]=path.join(parent,"peer-results.json");
 const child=childProcess.spawn(process.execPath,["--extensionDevelopmentPath="+context.extensionUri.fsPath,"--user-data-dir="+peerProfile,"--extensions-dir="+extensions,"--new-window","--disable-extensions","--disable-extension=vscode.git","--disable-extension=vscode.github-authentication","--disable-extension=vscode.microsoft-authentication","--disable-workspace-trust","--disable-gpu","--disable-updates","--skip-welcome","--skip-release-notes",root],{env,windowsHide:true,shell:false,stdio:["ignore","pipe","pipe"]});
 peerOwner.started=true;
 let closed=false,code:number|null=null,signal:NodeJS.Signals|null=null,stdoutEOF=false,stderrEOF=false,overflow=false,error=false;const buffers:{stdout:Buffer[];stderr:Buffer[]}={stdout:[],stderr:[]},sizes={stdout:0,stderr:0};
 for(const channel of ["stdout","stderr"] as const){child[channel]!.on("data",(chunk:Buffer)=>{const left=1048576-sizes[channel];if(chunk.length>left)overflow=true;if(left>0){const part=chunk.subarray(0,left);buffers[channel].push(part);sizes[channel]+=part.length;}});child[channel]!.once("end",()=>{if(channel==="stdout"){stdoutEOF=true;peerOwner.stdoutEOF=true;}else{stderrEOF=true;peerOwner.stderrEOF=true;}});child[channel]!.on("error",()=>{error=true;});}
 child.on("error",()=>{error=true;});child.once("close",(exit,stopped)=>{closed=true;peerOwner.closed=true;code=exit;signal=stopped;});
 try{await until(async()=>fsp.stat(ready).then(()=>true,()=>false),60000);const value=JSON.parse(await fsp.readFile(ready,"utf8"));assert.equal(value.status,"READY");assert.equal(value.bundle,process.env[PREFIX+"BUNDLE_SHA256"]);
  await setFlag(false);assert.equal((await status()).status,"DISABLED");await put(probe,{status:"PROBE_AFTER_PRIMARY_FLAG_DISABLED"});await until(async()=>fsp.stat(answer).then(()=>true,()=>false),60000);
  const answerValue=JSON.parse(await fsp.readFile(answer,"utf8"));assert.equal(answerValue.status,"PASS");assert.equal(answerValue.reader,"READY");assert.equal(answerValue.publicDigest,sha(PUBLIC));assert.equal((await status()).status,"DISABLED");
 }finally{await put(stop,{status:"NORMAL_PEER_WINDOW_CLOSE_REQUESTED_NO_SIGNALS"});try{await until(()=>closed&&stdoutEOF&&stderrEOF,90000);}catch(error){peerOwner.timedOut=true;throw error;}await setFlag(true);
  const streams=[];for(const channel of ["stdout","stderr"] as const){const raw=Buffer.concat(buffers[channel]),target=path.join(parent,"peer-"+channel+".bin");await fsp.writeFile(target,raw,{flag:"wx"});streams.push({channel,bytes:raw.length,sha256:sha(raw),file:target});}
  peerChildren.push({pid:child.pid??null,closed,code,signal,stdoutEOF,stderrEOF,overflow,streamError:error,profile:peerProfile,streams,signalsRequested:0});
 }
 assert(closed&&code===0&&signal===null&&stdoutEOF&&stderrEOF&&!overflow&&!error);assert.equal(JSON.parse(await fsp.readFile(path.join(parent,"peer-results.json"),"utf8")).status,"PASS_SCOPED_F28_PEER_NATIVE_PUBLIC_CONTROL");
}
export async function run(context:vscode.ExtensionContext):Promise<void>{
 if(phase==="peer"){try{await peerRun(context);}finally{restorers.reverse().forEach(restore=>restore());listeners.forEach(l=>l.dispose());}return;}
 const scopes=phase==="primary"?primaryScopes:restartScopes,rows:Row[]=scopes.map((scope,index)=>({id:"F28-H"+(phase==="primary"?"P":"R")+String(index+1).padStart(2,"0"),scope,status:"NOT_RUN"}));
 let bindings:Awaited<ReturnType<typeof runtimes>>=[],safeWithdrawal="NOT_COMPLETED",readyForInterphase=false,index=0;
 const check=async(action:()=>Promise<void>)=>{const row=rows[index++];assert(row);try{await action();row.status="PASS";}catch(error){row.status="FAIL";row.errorName=error instanceof Error?error.name:"UnknownFailure";row.lastReadStatus=lastReadStatus;if(error instanceof assert.AssertionError){const primitive=(value:unknown):boolean|number|string=>typeof value==="boolean"?value:typeof value==="number"&&Number.isFinite(value)?value:typeof value;row.assertion={operator:["==","===","strictEqual","equal","deepStrictEqual"].includes(error.operator)?error.operator:"OTHER",actual:primitive(error.actual),expected:primitive(error.expected)};}throw error;}finally{console.log("F28_NATIVE "+row.id+" "+row.status);}};
 try{
  bindings=await runtimes(context);assert.equal(sha(await fsp.readFile(__filename)),process.env[PREFIX+"DRIVER_SHA256"]);
  if(phase==="primary"){
   await check(async()=>{const m=context.extension.packageJSON,p=m.contributes.configuration.properties["soterai.lite.reliability"];assert(p&&p.default===true&&p.scope==="machine");assert(m.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.reliability"));assert((await vscode.commands.getCommands(true)).includes("soterai.readReliabilityStatus"));});
   await check(async()=>{const s=await status();assert.equal(s.status,"READY");assert.equal(s.limits.startupMilliseconds,1500);assert(typeof s.startupMilliseconds==="number"&&s.startupMilliseconds>=0&&s.startupMilliseconds<1500);measurements.push({kind:"ACTIVATION_BODY_EXCLUDES_MODULE_LOADING",milliseconds:s.startupMilliseconds});});
   await check(async()=>publicRead());
   await check(async()=>{const r=await read(".env.f28");assert.equal(r.status,"ALLOWED_ONCE");assert.equal(r.text,MASKED);});
   await check(async()=>{decision=async()=>undefined;try{const r=await read("public.txt");assert.equal(r.status,"DENIED");withheld(r);}finally{decision=async()=>"Allow safe read once";}});
   await check(async()=>{await fsp.writeFile(file("oversized.txt"),"p".repeat(65537),{flag:"wx"});const before=prompts;withheld(await read("oversized.txt"));assert.equal(prompts,before);});
   await check(async()=>{for(const [name,bytes]of [["binary.txt",Buffer.from("a\0b")],["invalid.txt",Buffer.from([0xc0,0xaf])]] as const){await fsp.writeFile(file(name),bytes,{flag:"wx"});withheld(await read(name));}});
   await check(async()=>{await fsp.writeFile(file("hardlink-source.txt"),PUBLIC,{flag:"wx"});await fsp.link(file("hardlink-source.txt"),file("hardlink.txt"));try{withheld(await read("hardlink.txt"));assert.equal((await fsp.lstat(file("public.txt"))).nlink,1);}finally{await fsp.writeFile(file("single.txt"),PUBLIC,{flag:"wx"});}});
   await check(async()=>{await fsp.mkdir(file("ordinary"));await fsp.writeFile(file("ordinary/public.txt"),PUBLIC,{flag:"wx"});await fsp.symlink(file("ordinary"),file("linked"),"junction");withheld(await read("linked/public.txt"));});
   await check(async()=>{const alias=path.join(parent,"workspace-alias");await fsp.symlink(root,alias,"junction");await changeFolders(1,0,2,{uri:vscode.Uri.file(alias)});try{const r=await vscode.commands.executeCommand<Result>("soterai.readProjectFileSafely",vscode.Uri.file(path.join(alias,"ordinary/public.txt")));assert(r);withheld(r);}finally{await changeFolders(1,1,1);}});
   await check(async()=>{let changed=false;const before=prompts,restore=patch(fsp,"open",async(...args:Parameters<typeof fsp.open>)=>{if(!changed&&path.resolve(String(args[0])).toLowerCase()===file("file-race.txt").toLowerCase()){changed=true;await fsp.rename(file("file-race.txt"),file("file-race.old"));await fsp.writeFile(file("file-race.txt"),"public",{flag:"wx"});}return originalOpen(...args);});try{withheld(await read("file-race.txt"));assert(changed);assert.equal(prompts,before);}finally{restore();}});
   await check(async()=>{let changed=false;const before=prompts,restore=patch(fsp,"open",async(...args:Parameters<typeof fsp.open>)=>{if(!changed&&path.resolve(String(args[0])).toLowerCase()===file("parent-race/public.txt").toLowerCase()){changed=true;await fsp.rename(file("parent-race"),file("parent-race-old"));await fsp.mkdir(file("parent-race"));await fsp.writeFile(file("parent-race/public.txt"),"public",{flag:"wx"});}return originalOpen(...args);});try{withheld(await read("parent-race/public.txt"));assert(changed);assert.equal(prompts,before);}finally{restore();}});
   await check(async()=>{let changed=false;const before=prompts,restore=patch(fsp,"open",async(...args:Parameters<typeof fsp.open>)=>{const h=await originalOpen(...args);if(path.resolve(String(args[0])).toLowerCase()===file("content-race.txt").toLowerCase()){const native=h.read.bind(h);patch(h,"read",async(...a:any[])=>{const result=await(native as any)(...a);if(!changed&&result.bytesRead){changed=true;await fsp.writeFile(file("content-race.txt"),"secret");}return result;});}return h;});try{withheld(await read("content-race.txt"));assert(changed);assert.equal(prompts,before);}finally{restore();}});
   await check(async()=>{const second=path.join(parent,"second-workspace");await fsp.mkdir(second);await fsp.writeFile(path.join(second,"public.txt"),PUBLIC,{flag:"wx"});await changeFolders(1,0,2,{uri:vscode.Uri.file(second)});try{const r=await vscode.commands.executeCommand<Result>("soterai.readProjectFileSafely",vscode.Uri.file(path.join(second,"public.txt")));assert.equal(r?.text,PUBLIC);assert.equal(r?.status,"ALLOWED_ONCE");await publicRead();}finally{await changeFolders(1,1,1);}});
   await check(async()=>{let enter!:()=>void,answer!:(value:unknown)=>void;const entered=new Promise<void>(r=>{enter=r;});decision=async()=>{enter();return new Promise(r=>{answer=r;});};const pending=read("single.txt");try{await bounded(entered);await changeFolders(1,0,2,{uri:vscode.Uri.file(path.join(parent,"second-workspace"))});withheld(await pending);}finally{answer?.("Allow safe read once");decision=async()=>"Allow safe read once";if(vscode.workspace.workspaceFolders?.length===2){await changeFolders(1,1,1);}}});
   await check(async()=>{await delayedOpen("cancel-open.txt",async(pending)=>{await setFlag(false);withheld(await pending);const s=await status();assert.equal(s.status,"DISABLED");assert(s.activeReads>=1);measurements.push({kind:"WITHDRAWN_OPEN_SLOT_RETAINED",activeReads:s.activeReads});});assert.equal((await status()).activeReads,0);});
   await check(async()=>{const before=prompts;withheld(await read("single.txt"));assert.equal(prompts,before);});
   await check(async()=>{await setFlag(true);await publicRead("single.txt");});
   await check(async()=>{await delayedOpen("timeout-open.txt",async(pending)=>{const start=performance.now();withheld(await pending);const elapsed=performance.now()-start;assert(elapsed>=4500&&elapsed<8000);assert((await status()).activeReads>=1);measurements.push({kind:"OWNED_FIVE_SECOND_TIMER_WITHHELD_IO_STILL_OWNED",milliseconds:elapsed});});assert.equal((await status()).activeReads,0);});
   await check(async()=>{const start=performance.now(),before=prompts;for(let i=0;i<128;i++)await publicRead("bulk/public-"+i+".txt");const elapsed=performance.now()-start;assert(elapsed<60000);assert.equal(prompts,before+128);measurements.push({kind:"ACTUAL_PACKAGED_COMMAND_SELECTED128_OF4096",selected:128,bulkSyntheticFiles:4096,milliseconds:elapsed,budgetMilliseconds:60000});});
   await check(async()=>concurrentPeer(context));
   await check(async()=>{const restore=patch(fsp,"open",async(...args:Parameters<typeof fsp.open>)=>{if(path.resolve(String(args[0])).toLowerCase()===file("outage.txt").toLowerCase())throw Error(PRIVATE);return originalOpen(...args);});try{withheld(await read("outage.txt"));}finally{restore();}});
   await check(async()=>{assert.equal(docEvents,0);assert(vscode.workspace.textDocuments.every(d=>!d.getText().includes(PRIVATE)));});
   await check(async()=>{assert.deepEqual(await runtimes(context),bindings);assert.equal(fixtureHandles,0);assert.equal(sourceOpened,sourceClosed);assert.equal((await status()).activeReads,0);});
   await check(async()=>{await setFlag(false);withheld(await read("single.txt"));assert.equal((await status()).activeReads,0);await put(path.join(parent,"f28-restart-state.json"),{schemaVersion:1,syntheticOnly:true,originalFlagPresent:originalFlag!==undefined,originalFlag:originalFlag??null,runtimeBindings:bindings,primaryChecks:25,disabled:true,driverSha256:process.env[PREFIX+"DRIVER_SHA256"]});readyForInterphase=true;safeWithdrawal="PRIMARY_DISABLED_NO_PENDING_READS_RESTART_REQUIRED";});
  }else{
   const saved=JSON.parse(await fsp.readFile(path.join(parent,"f28-restart-state.json"),"utf8"));assert(saved.syntheticOnly&&saved.schemaVersion===1&&saved.disabled);assert.deepEqual(saved.runtimeBindings,bindings);
   await check(async()=>{assert.equal((await status()).status,"DISABLED");const before=prompts;withheld(await read("single.txt"));assert.equal(prompts,before);});
   await check(async()=>{await setFlag(true);await publicRead("single.txt");});
   await check(async()=>{const r=await read(".env.f28");assert.equal(r.status,"ALLOWED_ONCE");assert.equal(r.text,MASKED);});
   await check(async()=>{let enter!:()=>void,answer!:(value:unknown)=>void;const entered=new Promise<void>(r=>{enter=r;});decision=async()=>{enter();return new Promise(r=>{answer=r;});};const pending=read("single.txt");try{await bounded(entered);await setFlag(false);withheld(await pending);}finally{answer?.("Allow safe read once");decision=async()=>"Allow safe read once";}});
   await check(async()=>{await setFlag(saved.originalFlagPresent?saved.originalFlag:undefined);assert.equal(config.inspect<boolean>(FLAG)?.globalValue,saved.originalFlagPresent?saved.originalFlag:undefined);assert.equal((await status()).activeReads,0);assert.deepEqual(await runtimes(context),bindings);safeWithdrawal="ORIGINAL_FLAG_RESTORED_NO_PENDING_READS";});
  }
 }catch(error){driverFailure=error instanceof Error?error.name:"UnknownFailure";}
 finally{
  restorers.reverse().forEach(restore=>restore());listeners.forEach(l=>l.dispose());
  const body={schemaVersion:1,phase,syntheticOnly:true,scope:"F28_SCRIPTED_ACTUAL_PACKAGED_COMMANDS_AND_DETERMINISTIC_REAL_FS_SCHEDULING_NOT_NATURAL_ADVERSARY",hostVersion:vscode.version,extensionBundleSha256:bindings[0]?.sha256??null,runtimeBindings:bindings,hostProbeSha256:sha(await fsp.readFile(__filename)),sourceProofSha256:process.env[PREFIX+"SOURCE_PROOF_SHA256"]??null,observations:rows,expectedChecks:rows.length,passed:rows.filter(r=>r.status==="PASS").length,failed:rows.filter(r=>r.status==="FAIL").length,notRun:rows.filter(r=>r.status==="NOT_RUN").length,driverFailure,readyForInterphase,safeWithdrawal,measurements,sourceHandleOpens:sourceOpened,sourceHandleCloses:sourceClosed,unfinishedFixtureHandles:fixtureHandles,originalEnvironmentDocumentEvents:docEvents,peerChildren,prompts,readStatus:await status(),optionalPrivilegedSymlink:"NOT_TESTED_COMPONENT_CAPABILITY_SKIPS_RETAINED",nestedVendorChildren:"NO_INFERRED_ALL_DESCENDANT_EOF",configuredGitPush:"NOT_AUTHORIZED_NOT_RUN",signalsRequested:0,independence:"LOW_SCRIPTED_NATIVE"};
  assert(!JSON.stringify(body).includes(PRIVATE));await put(output,body);
 }
}
