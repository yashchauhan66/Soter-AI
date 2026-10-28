// Own both pipes before writing post-spawn evidence. Never signal or kill.
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
async function phase({executable,args,cwd,env,run,name,profile,deadlineMs=240000}){
 const streams={};let overflow=false,error=false,deadline=false,child;
 for(const suffix of ['owned-start.json','owned-close.json','deadline.json','stdout.bin','stderr.bin'])assert(!fs.existsSync(path.join(run,name+'-'+suffix)),'Existing phase evidence refuses a second launch.');
 try{for(const channel of ['stdout','stderr']){const file=path.join(run,name+'-'+channel+'.bin');streams[channel]={file,fd:fs.openSync(file,'wx'),bytes:0,observed:0,eof:false};}}
 catch(failure){for(const s of Object.values(streams))fs.closeSync(s.fd);throw failure;}
 try{child=cp.spawn(executable,args,{cwd,env,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});}
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
 try{json(path.join(run,name+'-owned-start.json'),{status:'STARTED_NOT_COMPLETED',observedAt:new Date().toISOString(),pid:child.pid??null,args,profile,workspace:cwd,signalsRequested:0});}catch{error=true;}
 const timer=setTimeout(()=>{
  deadline=true;
  try{json(path.join(run,name+'-deadline.json'),{status:'STOP_UNCONFIRMED_RETAIN_OWNERSHIP_NO_NEXT_PHASE',pid:child.pid,profile,workspace:cwd,stdoutEOF:streams.stdout.eof,stderrEOF:streams.stderr.eof,signalsRequested:0});}catch{error=true;}
 },deadlineMs);
 const closed=await completion;clearTimeout(timer);
 for(const s of Object.values(streams)){try{fs.fsyncSync(s.fd);}catch{error=true;}finally{try{fs.closeSync(s.fd);}catch{error=true;}}}
 const close={observedAt:new Date().toISOString(),pid:child.pid??null,actualClose:true,exitCode:closed.code,signal:closed.signal,stdoutEOF:streams.stdout.eof,stderrEOF:streams.stderr.eof,overflow,streamError:error,deadlineExceeded:deadline,signalsRequested:0,streams:Object.entries(streams).map(([name,s])=>({name,bytes:s.bytes,observedBytes:s.observed,sha256:sha(fs.readFileSync(s.file))}))};
 json(path.join(run,name+'-owned-close.json'),close);console.log(JSON.stringify({phase:name,...close}));
 return {closed,streams,deadline,overflow,error,close};
}
module.exports={phase};
