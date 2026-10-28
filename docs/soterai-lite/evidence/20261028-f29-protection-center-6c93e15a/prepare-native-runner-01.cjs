// Derive a fresh evidence runner from the retained accepted owned lifecycle.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const old=path.resolve(__dirname,'../20261027-f27-self-hygiene-8c16e402/run-f27-native-01.cjs');
let source=fs.readFileSync(old,'utf8');
function replace(before,after){assert(source.includes(before),'Expected accepted runner seam missing');source=source.replace(before,after);}
replace("assert.equal(sha(fs.readFileSync(own('native-owned-phase-01.cjs')))","assert.equal(sha(fs.readFileSync(path.resolve(__dirname,'../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs')))");
replace("require('./native-owned-phase-01.cjs')","require('../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs')");
source=source.replaceAll('f27-native','f29-native').replaceAll('F27_FIRST_BOUNDED_NATIVE_RUN_STARTED_NO_RETRY','F29_FIRST_BOUNDED_NATIVE_RUN_STARTED_NO_RETRY').replaceAll('f27-self-hygiene-native','f29-protection-center-native').replaceAll('F27 native verification','F29 native verification');
replace("workspace=path.join(execution,'workspace')","workspace=path.join(execution,'f29-renderer-workspace-'+id)");
replace("'soterai.broker.autoStart':false}","'soterai.broker.autoStart':false,'workbench.colorTheme':'Default High Contrast','workbench.reduceMotion':'on'}");
replace("const phases=[];","const phases=[];const gate=path.join(profile,'F29RendererEvidence');fs.mkdirSync(gate);const observerScript=own('run-code-renderer-observer-01.cjs');const observerHelpers=own('accessibility-binding-01.cjs');const observerPins=[fact(observerScript),fact(observerHelpers)];\n const port=await reservePort();");
replace("const output=path.join(execution,phase+'-results.json'),args=[","const output=path.join(execution,phase+'-results.json'),args=[...(phase==='primary'?['--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port]:[]),");
replace("for(const dir of [env.HOME,env.APPDATA,env.LOCALAPPDATA,env.XDG_CONFIG_HOME,env.XDG_DATA_HOME])fs.mkdirSync(dir,{recursive:true});","for(const dir of [env.HOME,env.APPDATA,env.LOCALAPPDATA,env.XDG_CONFIG_HOME,env.XDG_DATA_HOME])fs.mkdirSync(dir,{recursive:true});\n  if(phase==='primary')env.SOTERAI_F29_RENDERER_GATE_DIRECTORY=gate;");
replace("const {closed,streams,deadline,overflow,error,close}=await ownedCodePhase({executable:host.executable.path,args,cwd:workspace,env,run,name:phase,profile,deadlineMs:240000});",`let observerWork;
  const codeWork=ownedCodePhase({executable:host.executable.path,args,cwd:workspace,env,run,name:phase,profile,deadlineMs:phase==='primary'?420000:240000});
  if(phase==='primary')observerWork=observeOwnedRenderer({binding,host,run,profile,workspace,snapshot,gate,port,env,observerScript,observerPins});
  const code=await codeWork;let observer;
  if(observerWork){observer=await observerWork;assert.equal(observer.status,'PASS_SCOPED_ACTUAL_RENDERER_KEYS_HC_MOTION_ROOT_REVIEW_PENDING');}
  const {closed,streams,deadline,overflow,error,close}=code;`);
replace("phase==='primary'?17:5","phase==='primary'?25:5");
replace("for(const name of ['f29-native-restart-custody.json'])","for(const name of ['f29-native-restart-custody.json'])");
replace("nativeChecks:22","nativeChecks:30");replace("nativeChecks:22","nativeChecks:30");
replace("auditExport:'NO_REGISTERED_OWNER_API_COMPONENT_ONLY'","accessibility:'ACTUAL_RENDERER_KEYS_HC_MOTION_PASS_ADJACENT_EDGE_AXE_SEPARATE',auditExport:'NOT_NEWLY_CLAIMED_BY_PRESENTATION'");
const helper=String.raw`
const fact=file=>{const raw=fs.readFileSync(file);return{path:path.isAbsolute(file)&&!file.startsWith(repo+path.sep)?file:path.relative(repo,file).replace(/\\/g,'/'),bytes:raw.length,sha256:sha(raw)}};
const wait=ms=>new Promise(done=>setTimeout(done,ms));
async function reservePort(){const net=require('node:net'),server=net.createServer();await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});const address=server.address();assert(address&&typeof address!=='string'&&address.port>=1024);await new Promise((done,reject)=>server.close(error=>error?reject(error):done()));return address.port;}
async function endpointReady(port){const http=require('node:http');for(let n=0;n<150;n++){const ok=await new Promise(done=>{const request=http.get({host:'127.0.0.1',port,path:'/json/version',timeout:700},response=>{let bytes=0;response.on('data',raw=>{bytes+=raw.length;});response.on('end',()=>done(response.statusCode===200&&bytes<65536));response.on('error',()=>done(false));});request.on('error',()=>done(false));request.on('timeout',()=>request.destroy());});if(ok)return;await wait(100);}throw Error('Exact owned CDP endpoint unavailable');}
async function observeOwnedRenderer({binding,run,profile,workspace,snapshot,gate,port,env,observerScript,observerPins}){
 try{
  const startFile=path.join(run,'primary-owned-start.json');for(let n=0;n<100&&!fs.existsSync(startFile);n++)await wait(20);const start=read(startFile);assert(Number.isSafeInteger(start.pid)&&start.pid>0);await endpointReady(port);
  const custodyFile=path.join(run,'renderer-listener-custody-01.json'),q=value=>"'"+value.replaceAll("'","''")+"'";
  const query=String.raw`$ErrorActionPreference='Stop'; $rootId=ROOT_ID; $seen=[System.Collections.Generic.HashSet[int]]::new(); [void]$seen.Add($rootId); $pending=[System.Collections.Generic.Queue[int]]::new(); $pending.Enqueue($rootId); $rootProcess=Get-CimInstance Win32_Process -Filter ('ProcessId='+$rootId); if($null -eq $rootProcess){throw 'Owned root process absent'}; while($pending.Count -gt 0){$parentId=$pending.Dequeue(); foreach($childRecord in @(Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$parentId))){$childId=[int]$childRecord.ProcessId; if($seen.Add($childId)){$pending.Enqueue($childId)}}}; $listener=@(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort PORT_ID -State Listen); if($listener.Count -ne 1){throw 'One exact numeric loopback listener required'}; $listenerOwner=[int]$listener[0].OwningProcess; if(-not $seen.Contains($listenerOwner)){throw 'Listener outside owned Code tree'}; $value=[ordered]@{schemaVersion=1;feature='F29';localAddress='127.0.0.1';localPort=PORT_ID;profile=PROFILE_PATH;rootCodePid=$rootId;codeProcessTreePids=@($seen);owningProcess=$listenerOwner;observedAt=[DateTime]::UtcNow.ToString('o');signals=0}; $bytes=[Text.Encoding]::UTF8.GetBytes(($value|ConvertTo-Json -Depth 6)); $stream=[IO.File]::Open(OUTPUT_PATH,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write); try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}`.replaceAll('ROOT_ID',String(start.pid)).replaceAll('PORT_ID',String(port)).replace('PROFILE_PATH',q(profile)).replace('OUTPUT_PATH',q(custodyFile));
  const custody=await ownedCodePhase({executable:'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe',args:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(query,'utf16le').toString('base64')],cwd:workspace,env,run,name:'renderer-custody-query',profile,deadlineMs:30000});
  assert(custody.closed.code===0&&custody.closed.signal===null&&custody.close.stdoutEOF&&custody.close.stderrEOF&&!custody.deadline&&!custody.error&&!custody.overflow);
  for(const row of observerPins){assert.equal(sha(fs.readFileSync(relativeFile(row.path))),row.sha256);}
  const observerBinding={schemaVersion:1,feature:'F29',kind:'CODE_RENDERER',sourceProof:binding.sourceProof,vsix:binding.vsix,runtimes:binding.runtimes.map(row=>({...row,path:path.join(snapshot,'dist',path.basename(row.path))})),requiredReceipts:binding.requiredReceipts,toolInventory:fact(own('accessibility-tooling-inventory-01.json')),syntheticOnly:true,signals:0,gateDirectory:gate,profile,workspace,endpoint:'http://127.0.0.1:'+port,actualCodePid:start.pid,ownerReceipt:fact(startFile),ownerPidField:'pid',listenerCustody:fact(custodyFile),listenerPidField:'owningProcess',expectedThemeClass:'hc-black',expectReducedMotion:true,targetTitleContains:path.basename(workspace),observerPins};
  const bindingFile=own('renderer-binding-01.json');json(bindingFile,observerBinding);
  const observed=await ownedCodePhase({executable:process.execPath,args:[observerScript,bindingFile],cwd:repo,env:process.env,run,name:'renderer-observer',profile,deadlineMs:210000});
  for(const name of fs.readdirSync(gate)){const source=path.join(gate,name);assert(fs.lstatSync(source).isFile());fs.copyFileSync(source,path.join(run,name),fs.constants.COPYFILE_EXCL);}
  assert(observed.closed.code===0&&observed.closed.signal===null&&observed.close.stdoutEOF&&observed.close.stderrEOF&&!observed.deadline&&!observed.error&&!observed.overflow);
  return read(path.join(gate,'f29-renderer-observations-01.json'));
 }catch(error){json(path.join(run,'renderer-preparation-or-observation-failure-01.json'),{status:'FAIL_OR_INCOMPLETE_NO_NATIVE_RETRY',observedAt:new Date().toISOString(),errorName:error instanceof Error?error.name:'UnknownFailure',error:String(error?.message).slice(0,400),signalsRequested:0});return{status:'FAIL_OR_INCOMPLETE_ACTUAL_RENDERER_OBSERVER'};}
}
`;
// Preserve the bootstrap declaration and insert helpers before main begins.
replace('async function main(){',helper+'\nasync function main(){');
assert(source.includes("phase==='primary'?25:5"));assert(!source.includes('nativeChecks:22'));assert(!source.includes('f27-native-restart'));
fs.writeFileSync(path.join(__dirname,'run-f29-native-01.cjs'),source,{flag:'wx'});console.log('Fresh F29 runner prepared, NOT_RUN.');
