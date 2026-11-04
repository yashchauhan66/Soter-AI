// Own both pipes before writing post-spawn evidence. Never signal or kill.
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});

// Inert GUI-only contract. All original stream/close/deadline logic follows.
const launchContract=require('./installed-launch-contract-proposed-03.cjs');
const CODE_PATH='C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
const CODE_SHA='af032b86db394d21ba86872f4237a11b8395d2f57e8187963a3718a2cc6666ad';
function validateGuiContract(options){
 const {executable,args,cwd,env,run,name,profile,deadlineMs=240000,guiAuthority:a}=options;
 assert(a&&a.status==='EXPLICIT_EXTRA05_VISIBLE_OWNED_GUI_ONLY'&&a.feature==='F32');
 const b=a.binding;launchContract.validate(b);
 assert.equal(b.normalRound,3);assert.equal(a.extraAttempt,'PROPOSAL05');
 assert.equal(executable,CODE_PATH);assert.equal(a.executable.path,CODE_PATH);
 assert.equal(a.executable.sha256,CODE_SHA);assert.equal(a.executable.bytes,238751552);
 assert.equal(profile,b.profile);assert.equal(cwd,b.workspace);assert.equal(run,b.gate);
 assert.equal(name,b.phase+'-code');assert.equal(deadlineMs,600000);
 assert.equal(path.dirname(b.gate),path.join(b.profile,'F32Gate'));
 assert.equal(path.basename(b.gate),b.phase);assert.equal(path.dirname(b.profile),b.runRoot);
 assert(['profile-primary','profile-restricted','profile-upgrade'].includes(path.basename(b.profile)));
 assert.equal(path.dirname(b.workspace),b.runRoot);
 assert(['workspace-primary','workspace-upgrade'].includes(path.basename(b.workspace)));
 assert.equal(path.dirname(b.observerRoot),b.runRoot);
 assert(['observer-current','observer-old'].includes(path.basename(b.observerRoot)));
 assert.equal(b.rootMarker.path,path.join(b.runRoot,'.f32-owned-installed-root.json'));
 assert(/^[a-f0-9]{64}$/.test(b.rootMarker.sha256)&&Number.isSafeInteger(b.rootMarker.bytes)&&b.rootMarker.bytes>0);
 const endpoint=new URL(b.endpoint);assert.equal(endpoint.hostname,'127.0.0.1');assert.equal(endpoint.protocol,'http:');
 assert.equal(endpoint.pathname,'/');assert(!endpoint.search&&!endpoint.hash&&!endpoint.username&&!endpoint.password);
 assert.deepEqual(args,launchContract.windowArgs(b,b.phase,Number(endpoint.port)));
 assert.deepEqual(env,launchContract.environment(b,b.bindingFile,false));
 return {windowsHide:false,guiVisibility:'EXPLICIT_VISIBLE_OWNED_SYNTHETIC_CODE',codeSha256:CODE_SHA};
}
function verifyGuiFiles(options){
 const observed=validateGuiContract(options),b=options.guiAuthority.binding;
 for(const f of [b.runRoot,b.profile,b.workspace,b.gate,b.observerRoot]){
  for(let cursor=f;;cursor=path.dirname(cursor)){
   const s=fs.lstatSync(cursor);assert(!s.isSymbolicLink());if(path.dirname(cursor)===cursor)break;
  }
  assert(fs.lstatSync(f).isDirectory());
 }
 const markerStat=fs.lstatSync(b.rootMarker.path);assert(markerStat.isFile()&&!markerStat.isSymbolicLink()&&markerStat.nlink===1);
 const markerRaw=fs.readFileSync(b.rootMarker.path);assert.equal(markerRaw.length,b.rootMarker.bytes);assert.equal(sha(markerRaw),b.rootMarker.sha256);
 const marker=JSON.parse(markerRaw.toString('utf8'));assert.equal(marker.feature,'F32');assert.equal(marker.syntheticOnly,true);assert.equal(marker.signalsRequested,0);
 const before=fs.lstatSync(options.executable);assert(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size===238751552);
 const fd=fs.openSync(options.executable,'r'),chunk=Buffer.alloc(65536),digest=crypto.createHash('sha256');let bytes=0;
 try{while(true){const n=fs.readSync(fd,chunk,0,chunk.length,null);if(!n)break;bytes+=n;assert(bytes<=before.size);digest.update(chunk.subarray(0,n));}
 const after=fs.fstatSync(fd);assert.equal(after.ino,before.ino);assert.equal(after.size,before.size);assert.equal(after.mtimeMs,before.mtimeMs);}finally{fs.closeSync(fd)}
 assert.equal(bytes,238751552);assert.equal(digest.digest('hex'),CODE_SHA);
 return observed;
}

async function phase(options){
 const {executable,args,cwd,env,run,name,profile,deadlineMs=240000}=options;
 const guiObservation=verifyGuiFiles(options);
 const streams={};let overflow=false,error=false,deadline=false,child;
 for(const suffix of ['owned-start.json','owned-close.json','deadline.json','stdout.bin','stderr.bin'])assert(!fs.existsSync(path.join(run,name+'-'+suffix)),'Existing phase evidence refuses a second launch.');
 try{for(const channel of ['stdout','stderr']){const file=path.join(run,name+'-'+channel+'.bin');streams[channel]={file,fd:fs.openSync(file,'wx'),bytes:0,observed:0,eof:false};}}
 catch(failure){for(const s of Object.values(streams))fs.closeSync(s.fd);throw failure;}
 try{child=cp.spawn(executable,args,{cwd,env,windowsHide:false,shell:false,stdio:['ignore','pipe','pipe']});}
 catch(failure){for(const s of Object.values(streams))fs.closeSync(s.fd);throw failure;}
 const completion=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
 child.on('error',()=>{error=true;});
 for(const channel of ['stdout','stderr']){
  const s=streams[channel];
  child[channel].on('data',raw=>{
   s.observed+=raw.length;const left=8*1024*1024-s.bytes;if(raw.length>left)overflow=true;
   if(left>0){try{const part=raw.subarray(0,left),written=fs.writeSync(s.fd,part);s.bytes+=written;if(written!==part.length)error=true;}catch{error=true;}}
  });
  child[channel].on('end',()=>{s.eof=true;});child[channel].on('error',()=>{error=true;});
 }
 try{json(path.join(run,name+'-owned-start.json'),{status:'STARTED_NOT_COMPLETED',...guiObservation,observedAt:new Date().toISOString(),pid:child.pid??null,args,profile,workspace:cwd,signalsRequested:0});}catch{error=true;}
 const timer=setTimeout(()=>{
  deadline=true;
  try{json(path.join(run,name+'-deadline.json'),{status:'STOP_UNCONFIRMED_RETAIN_OWNERSHIP_NO_NEXT_PHASE',pid:child.pid,profile,workspace:cwd,stdoutEOF:streams.stdout.eof,stderrEOF:streams.stderr.eof,signalsRequested:0});}catch{error=true;}
 },deadlineMs);
 const closed=await completion;clearTimeout(timer);
 for(const s of Object.values(streams)){try{fs.fsyncSync(s.fd);}catch{error=true;}finally{try{fs.closeSync(s.fd);}catch{error=true;}}}
 const close={...guiObservation,observedAt:new Date().toISOString(),pid:child.pid??null,actualClose:true,exitCode:closed.code,signal:closed.signal,stdoutEOF:streams.stdout.eof,stderrEOF:streams.stderr.eof,overflow,streamError:error,deadlineExceeded:deadline,signalsRequested:0,streams:Object.entries(streams).map(([name,s])=>({name,bytes:s.bytes,observedBytes:s.observed,sha256:sha(fs.readFileSync(s.file))}))};
 json(path.join(run,name+'-owned-close.json'),close);console.log(JSON.stringify({phase:name,...close}));
 return {closed,streams,deadline,overflow,error,close};
}
module.exports={phase,validateGuiContract};
