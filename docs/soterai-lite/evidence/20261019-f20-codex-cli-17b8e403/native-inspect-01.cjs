'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const base='C:/Users/USER/AppData/Roaming/npm/node_modules/@openai/codex';
const binary=base+'/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe';
const profile=path.join(__dirname,'inspect-profile-01');fs.mkdirSync(profile);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const facts=[base+'/package.json',base+'/bin/codex.js',base+'/node_modules/@openai/codex-win32-x64/package.json',binary].map(file=>{const b=fs.readFileSync(file);return {path:file,bytes:b.length,sha256:sha(b)};});
fs.writeFileSync(path.join(__dirname,'installed-cli-public-inputs-01.json'),JSON.stringify({status:'STATIC-ONLY',files:facts},null,2)+'\n',{flag:'wx'});
const env={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,COMSPEC:process.env.COMSPEC,CODEX_HOME:profile,USERPROFILE:profile,APPDATA:profile,LOCALAPPDATA:profile,TEMP:profile,TMP:profile,PATH:path.dirname(binary)+';'+process.env.SystemRoot+'/System32',NO_COLOR:'1'};
async function run(label,args){await new Promise((resolve,reject)=>{const child=cp.spawn(binary,args,{cwd:profile,env,windowsHide:true,stdio:['ignore','pipe','pipe']});const out=[],err=[];child.stdout.on('data',b=>out.push(b));child.stderr.on('data',b=>err.push(b));child.on('error',reject);child.on('close',(code,signal)=>{fs.writeFileSync(path.join(__dirname,label+'.stdout.txt'),Buffer.concat(out),{flag:'wx'});fs.writeFileSync(path.join(__dirname,label+'.stderr.txt'),Buffer.concat(err),{flag:'wx'});fs.writeFileSync(path.join(__dirname,label+'.json'),JSON.stringify({code,signal,args,stdoutSha256:sha(Buffer.concat(out)),stderrSha256:sha(Buffer.concat(err)),naturalClose:true},null,2)+'\n',{flag:'wx'});console.log(label+' exit='+code);resolve();});});}
(async()=>{await run('cli-version-01',['--version']);await run('cli-help-01',['--help']);await run('cli-debug-help-01',['debug','--help']);await run('cli-exec-help-01',['exec','--help']);await run('cli-appserver-help-01',['app-server','--help']);})().catch(e=>{console.error(e);process.exitCode=1;});
