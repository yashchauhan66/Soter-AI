const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const own=n=>path.join(__dirname,n),exe='C:\\Windows\\System32\\cmd.exe',hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
if(fs.existsSync(own('installed-cmd-probe-01.json')))throw Error('Immutable evidence exists');
const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},rows=[];
for(const [id,command,input] of [['CMD-VERSION','ver',''],['CMD-LOCATION','cd',''],['CMD-LITERAL','set /p "SOTERAI_LITERAL=" & set SOTERAI_LITERAL','public literal 17\r\n'],['CMD-CHOICE','C:\\Windows\\System32\\choice.exe /c y /d y /t 1 /n','']]){
 const start=Date.now(),r=cp.spawnSync(exe,['/d','/q','/u','/e:on','/v:off','/s','/c',command],{cwd:__dirname,env,windowsHide:true,shell:false,input:Buffer.from(input,'ascii'),maxBuffer:65536});
 const decode=b=>{try{return new TextDecoder('utf-16le',{fatal:true}).decode(b)}catch{return 'NOT_UTF16LE'}};
 rows.push({id,command,argv:['/d','/q','/u','/e:on','/v:off','/s','/c',command],inputSyntheticAscii:!!input,exit:r.status,signal:r.signal,error:r.error?.code,durationMs:Date.now()-start,stdoutBytes:r.stdout?.length,stderrBytes:r.stderr?.length,stdout:decode(r.stdout??Buffer.alloc(0)),stderr:decode(r.stderr??Buffer.alloc(0)),stdoutHex:Buffer.from(r.stdout??[]).toString('hex'),stderrHex:Buffer.from(r.stderr??[]).toString('hex')});
}
const data={feature:'F12',scope:'Installed fixed cmd public operations only, synthetic ASCII stdin; no workspace source, secret, profile, network, downloads or OS changes',executable:exe,executableSha256:hash(exe),observedAt:new Date().toISOString(),rows};
fs.writeFileSync(own('installed-cmd-probe-01.json'),JSON.stringify(data,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(data));
