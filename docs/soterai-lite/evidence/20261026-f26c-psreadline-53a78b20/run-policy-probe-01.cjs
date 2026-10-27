// Owned fixed synthetic API probe; no normal profile, signals or pipe cancellation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const home=__dirname,repo=path.resolve(home,'../../../..'),own=n=>path.join(home,n),sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const start=json(own('start-checkpoint-01.json'));const pins=start.installedModule.files;
function checkPins(){for(const pin of pins){const raw=fs.readFileSync(pin.path);assert.equal(raw.length,pin.bytes);assert.equal(sha(raw),pin.sha256);}}
checkPins();const exe='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',script=own('probe-generated-policy-01.ps1');
const taskId=new Date().toISOString().replace(/[-:.]/g,'').replace(/\d{3}Z$/,'Z')+'-'+crypto.randomBytes(4).toString('hex');
const profile=path.join('D:\\SoterAI-Lite-test-profiles','f26c-policy-probe-'+taskId);assert(/^D:\\SoterAI-Lite-test-profiles\\f26c-policy-probe-[0-9TZ]+-[a-f0-9]{8}$/.test(profile));
assert(!fs.existsSync(profile));fs.mkdirSync(profile);fs.writeFileSync(path.join(profile,'.synthetic-only'),'f26c-policy-probe-v1',{flag:'wx'});
const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',COMSPEC:'C:\\Windows\\System32\\cmd.exe',PATH:'C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\WindowsPowerShell\\v1.0',PSModulePath:'C:\\Program Files\\WindowsPowerShell\\Modules',SOTERAI_F26C_PROFILE:profile};
for(const name of ['HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','XDG_CONFIG_HOME','XDG_DATA_HOME']){env[name]=path.join(profile,name);fs.mkdirSync(env[name]);}
const binding=json(own('generated-text-inputs-01.json'));for(const pin of [...binding.sources,binding.output]){const raw=fs.readFileSync(path.join(repo,pin.path));assert.equal(raw.length,pin.bytes);assert.equal(sha(raw),pin.sha256);}fs.writeFileSync(path.join(profile,'generated-history.ps1'),fs.readFileSync(path.join(repo,binding.output.path)),{flag:'wx'});
const executable=fs.readFileSync(exe),scriptRaw=fs.readFileSync(script);const command=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script];
const streams={};for(const name of ['stdout','stderr'])streams[name]={file:own('policy-probe-01-'+name+'.bin'),fd:fs.openSync(own('policy-probe-01-'+name+'.bin'),'wx'),bytes:0,observed:0,eof:false};
let closed=false,exitCode=null,signal=null,overflow=false,timedOut=false,streamError=false;
const child=cp.spawn(exe,command,{cwd:profile,env,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
fs.writeFileSync(own('policy-probe-start-01.json'),JSON.stringify({status:'STARTED_NOT_COMPLETED',observedAt:new Date().toISOString(),pid:child.pid??null,profile,executable:{path:exe,bytes:executable.length,sha256:sha(executable)},script:{path:path.relative(repo,script).replace(/\\/g,'/'),bytes:scriptRaw.length,sha256:sha(scriptRaw)},args:command,signalsRequested:0},null,2)+'\n',{flag:'wx'});
const keep=setInterval(()=>{},1000),timer=setTimeout(()=>{timedOut=true;fs.writeFileSync(own('policy-probe-timeout-01.json'),JSON.stringify({status:'STOP_UNCONFIRMED_RETAIN_OWNERSHIP',pid:child.pid,closed,stdoutEOF:streams.stdout.eof,stderrEOF:streams.stderr.eof,signalsRequested:0})+'\n',{flag:'wx'});},60000);
for(const name of ['stdout','stderr']){child[name].on('data',raw=>{const stream=streams[name];stream.observed+=raw.length;const remaining=65536-stream.bytes;if(raw.length>remaining)overflow=true;if(remaining>0){const piece=raw.subarray(0,remaining);fs.writeSync(stream.fd,piece);stream.bytes+=piece.length;}});child[name].on('end',()=>{streams[name].eof=true});child[name].on('error',()=>{streamError=true});}
child.on('error',()=>{streamError=true});
child.on('close',(code,sig)=>{closed=true;exitCode=code;signal=sig;clearTimeout(timer);clearInterval(keep);for(const stream of Object.values(streams)){fs.fsyncSync(stream.fd);fs.closeSync(stream.fd);}checkPins();
 const result={status:!timedOut&&!overflow&&!streamError&&code===0&&sig===null&&streams.stdout.eof&&streams.stderr.eof?'CLOSED_API_PROBE_RESULT_AVAILABLE':'FAIL_OR_INCOMPLETE',observedAt:new Date().toISOString(),pid:child.pid??null,profile,closed,exitCode,signal,timedOut,overflow,streamError,stdoutEOF:streams.stdout.eof,stderrEOF:streams.stderr.eof,signalsRequested:0,streams:Object.entries(streams).map(([name,x])=>({name,path:path.relative(repo,x.file).replace(/\\/g,'/'),bytes:x.bytes,observedBytes:x.observed,sha256:sha(fs.readFileSync(x.file))}))};
 fs.writeFileSync(own('policy-probe-close-01.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));if(result.status!=='CLOSED_API_PROBE_RESULT_AVAILABLE')process.exitCode=1;
});
