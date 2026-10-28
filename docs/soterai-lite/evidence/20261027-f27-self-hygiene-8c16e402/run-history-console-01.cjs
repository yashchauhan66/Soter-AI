// Actual inherited console only. No separate EOF or arbitrary crash-memory claim.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {guard,pin,repo,own,read,sha,relativeFile}=require('./affected-history-current-guard-01.cjs');
const json=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
function ordinary(dir){for(let cursor=path.resolve(dir);;cursor=path.dirname(cursor)){const stat=fs.lstatSync(cursor);assert(stat.isDirectory()&&!stat.isSymbolicLink());assert.equal(fs.realpathSync(cursor).toLowerCase(),cursor.toLowerCase());if(cursor===path.parse(cursor).root)break;}}
async function main(){
 assert(process.stdin.isTTY&&process.stdout.isTTY,'A real inherited tool console is mandatory');await guard();
 const binding=read(own('history-console-binding-01.json')),vendor=read(own('history-console-vendor-01.json'));assert.equal(binding.status,'BOUND_CURRENT_F27_NATIVE28_EMITTED_PROFILE_CONSOLE_NOT_RUN');assert.equal(vendor.status,'BOUND_CURRENT_F27_HISTORY_VENDOR_REVIEWED');
 for(const item of [binding.nativeSummary,binding.primaryResult,binding.restartResult,binding.emittedProfile,binding.sourceProof,binding.script])await pin(item);
 for(const item of vendor.installedModule.files)await pin(item,true);await pin(vendor.powershell,true);
 const id=new Date().toISOString().replace(/[-:.]/g,'').replace(/\d{3}Z$/,'Z')+'-'+crypto.randomBytes(4).toString('hex'),base='D:\\SoterAI-Lite-test-profiles',profile=path.join(base,'f27-affected-history-console-'+id);ordinary(base);assert(!fs.existsSync(profile));fs.mkdirSync(profile);ordinary(profile);
 fs.writeFileSync(path.join(profile,'.synthetic-only'),'f27-affected-history-console-v1',{flag:'wx'});
 const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',COMSPEC:'C:\\Windows\\System32\\cmd.exe',PATH:'C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\WindowsPowerShell\\v1.0',PSModulePath:'C:\\Program Files\\WindowsPowerShell\\Modules',SOTERAI_F26C_PROFILE:profile};
 for(const key of ['HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','XDG_CONFIG_HOME','XDG_DATA_HOME']){env[key]=path.join(profile,key);fs.mkdirSync(env[key]);ordinary(env[key]);}
 fs.writeFileSync(path.join(profile,'generated-history.ps1'),fs.readFileSync(relativeFile(binding.emittedProfile.path)),{flag:'wx'});assert.equal(sha(fs.readFileSync(path.join(profile,'generated-history.ps1'))),binding.emittedProfile.sha256);
 for(const suffix of ['start','close','timeout','error'])assert(!fs.existsSync(own('history-console-'+suffix+'-01.json')),'Existing console receipt refuses duplicate');
 let timedOut=false,ioError=false,timer;
 const args=['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',relativeFile(binding.script.path)],child=cp.spawn(vendor.powershell.path,args,{env,cwd:profile,windowsHide:true,shell:false,stdio:'inherit'});
 const completion=new Promise(resolve=>child.once('close',(exitCode,signal)=>resolve({exitCode,signal})));
 child.on('error',error=>{ioError=true;try{json(own('history-console-error-01.json'),{code:error.code,signalsRequested:0});}catch{}});
 try{json(own('history-console-start-01.json'),{status:'STARTED_NOT_COMPLETED',pid:child.pid??null,observedAt:new Date().toISOString(),profile,args,executable:vendor.powershell,script:binding.script,output:'INHERITED_MERGED_CONSOLE_SEPARATE_EOF_NOT_APPLICABLE',signalsRequested:0});}catch{ioError=true;}
 timer=setTimeout(()=>{timedOut=true;try{json(own('history-console-timeout-01.json'),{status:'STOP_UNCONFIRMED_RETAIN_OWNERSHIP',pid:child.pid,signalsRequested:0});}catch{ioError=true;}},140000);
 const closed=await completion;clearTimeout(timer);
 const evidence=[];for(const name of ['api-metadata.json','console-result.json','read-observation.json']){const source=path.join(profile,name);if(fs.existsSync(source)){const raw=fs.readFileSync(source);assert(raw.length<8192);const output=own('history-console-01-'+name);fs.writeFileSync(output,raw,{flag:'wx'});evidence.push({path:path.relative(repo,output).replace(/\\/g,'/'),bytes:raw.length,sha256:sha(raw)});}}
 await guard();const result={status:closed.exitCode===0&&closed.signal===null&&!timedOut&&!ioError?'CLOSED_CONSOLE_MECHANISM_RESULT_AVAILABLE':'FAIL_OR_INCOMPLETE',pid:child.pid,profile,...closed,actualClose:true,timedOut,ioError,output:'INHERITED_MERGED_CONSOLE_SEPARATE_EOF_NOT_APPLICABLE',signalsRequested:0,evidence,observedAt:new Date().toISOString()};json(own('history-console-close-01.json'),result);console.log(JSON.stringify(result));assert.equal(result.status,'CLOSED_CONSOLE_MECHANISM_RESULT_AVAILABLE');
}
main().catch(()=>{console.error('Current emitted history console incomplete; no retry or process signals.');process.exitCode=1;});
