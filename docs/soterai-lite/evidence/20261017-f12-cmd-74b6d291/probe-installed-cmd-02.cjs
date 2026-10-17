const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const rows=[],exe='C:\\Windows\\System32\\cmd.exe',env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'};
for(const [id,command,input,delay] of [['CMD-LITERAL-FIXED','set /p SOTERAI_LITERAL=&set SOTERAI_LITERAL','public literal 17\r\n',0],['CMD-LITERAL-SHELL-DATA','set /p SOTERAI_LITERAL=&set SOTERAI_LITERAL','synthetic & percent% bang!\r\n',0],['CMD-DIRECTORY','dir /b /a','',0],['CMD-OWNED-WAIT','pause >nul','\r\n',500]]){
 const started=Date.now();const row=await new Promise(resolve=>{
  const child=cp.spawn(exe,['/d','/q','/u','/e:on','/v:off','/s','/c',command],{cwd:__dirname,env,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
  const out=[],err=[];child.stdout.on('data',b=>out.push(b));child.stderr.on('data',b=>err.push(b));
  child.once('error',e=>resolve({id,error:e.code}));child.once('close',exit=>resolve({id,command,exit,durationMs:Date.now()-started,stdout:Buffer.concat(out).toString('utf16le'),stderr:Buffer.concat(err).toString('utf16le'),stdoutBytes:Buffer.concat(out).length,stderrBytes:Buffer.concat(err).length}));
  child.once('spawn',()=>{if(delay)setTimeout(()=>child.stdin.end(input,'ascii'),delay);else child.stdin.end(input,'ascii')});child.stdin.on('error',()=>{});
 });rows.push(row);
}
const data={scope:'Fixed installed cmd public/synthetic literal and finite owned stdin wait probes; no external executable fallback',observedAt:new Date().toISOString(),rows};fs.writeFileSync(path.join(__dirname,'installed-cmd-probe-02.json'),JSON.stringify(data,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(data));
