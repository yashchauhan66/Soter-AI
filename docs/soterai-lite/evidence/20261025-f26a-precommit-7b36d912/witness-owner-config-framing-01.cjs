const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
async function child(root,env,args,name){
 const stdout=[],stderr=[];let out=0,err=0,stdoutEOF=false,stderrEOF=false,close=false,code,signal;
 return await new Promise((resolve,reject)=>{
  const p=spawn('C:\\Program Files\\Git\\cmd\\git.exe',args,{cwd:root,env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const timer=setTimeout(()=>{const file=path.join(__dirname,name+'.unconfirmed.json');if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify({status:'STOP_UNCONFIRMED',pid:p.pid,stdoutBytes:out,stderrBytes:err,signalsSent:0},null,2)+'\n',{flag:'wx'});},60000);
  const joined=()=>{if(!stdoutEOF||!stderrEOF||!close)return;clearTimeout(timer);const bytes=Buffer.concat(stdout),errors=Buffer.concat(stderr);
   const output=path.join(__dirname,name+'.bin'),errorFile=path.join(__dirname,name+'.stderr.bin');fs.writeFileSync(output,bytes,{flag:'wx'});fs.writeFileSync(errorFile,errors,{flag:'wx'});
   resolve({exitCode:code,signal,stdoutEOF,stderrEOF,actualClose:close,signalsSent:0,stdout:{file:path.basename(output),bytes:bytes.length,sha256:sha(bytes)},stderr:{file:path.basename(errorFile),bytes:errors.length,sha256:sha(errors)},nulFields:bytes.toString('utf8').split('\0')});};
  p.stdout.on('data',chunk=>{out+=chunk.length;if(out<=65536)stdout.push(Buffer.from(chunk));});p.stderr.on('data',chunk=>{err+=chunk.length;if(err<=8192)stderr.push(Buffer.from(chunk));});
  p.stdout.once('end',()=>{stdoutEOF=true;joined();});p.stderr.once('end',()=>{stderrEOF=true;joined();});p.once('close',(value,sig)=>{code=value;signal=sig;close=true;joined();});p.once('error',error=>{if(p.pid===undefined){clearTimeout(timer);reject(error);}});
 });
}
async function main(){
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'soter-f26a-owner-framing-')),profile=path.join(root,'synthetic-profile'),globalConfig=path.join(profile,'.gitconfig'),systemConfig=path.join(profile,'system.gitconfig');
 for(const directory of ['.git/objects/info','.git/objects/pack','.git/refs/heads','synthetic-profile'])await fsp.mkdir(path.join(root,...directory.split('/')),{recursive:true});
 const config=path.join(root,'.git/config'),base='[core]\n repositoryformatversion = 0\n bare = false\n';
 await fsp.writeFile(config,base,{flag:'wx'});await fsp.writeFile(path.join(root,'.git/HEAD'),'ref: refs/heads/main\n',{flag:'wx'});await fsp.writeFile(globalConfig,'',{flag:'wx'});await fsp.writeFile(systemConfig,'',{flag:'wx'});
 const env={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,COMSPEC:process.env.COMSPEC,HOME:profile,USERPROFILE:profile,GIT_CONFIG_GLOBAL:globalConfig,GIT_CONFIG_SYSTEM:systemConfig,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never',LC_ALL:'C',LANG:'C'};
 const args=['--no-pager','--no-optional-locks','-c','protocol.allow=never','-c','credential.helper=','-c','credential.interactive=false','config','--null','--show-origin','--show-scope','--no-includes','--get-regexp','^(core[.]hookspath|include[.]path|includeif[.].*[.]path|extensions[.]worktreeconfig)$'];
 const results={version:await child(root,env,['--version'],'owner-config-version-01'),none:await child(root,env,args,'owner-config-none-01')};
 await fsp.writeFile(path.join(root,'.git/config.before-local'),await fsp.readFile(config),{flag:'wx'});await fsp.writeFile(config,base+' hooksPath = .synthetic-hooks\n');
 results.local=await child(root,env,args,'owner-config-local-01');
 await fsp.writeFile(path.join(root,'.git/config.before-include'),await fsp.readFile(config),{flag:'wx'});await fsp.writeFile(config,base+'[include]\n path = synthetic-missing-include\n');
 results.include=await child(root,env,args,'owner-config-include-01');
 await fsp.writeFile(path.join(root,'.git/config.before-global'),await fsp.readFile(config),{flag:'wx'});await fsp.writeFile(config,base);await fsp.writeFile(globalConfig,'[core]\n hooksPath = .synthetic-global-hooks\n');
 results.global=await child(root,env,args,'owner-config-global-01');
 const receipt={status:'ACTUAL_SYNTHETIC_GIT_CONFIG_FRAMING_ONLY',time:new Date().toISOString(),root,profile,arguments:args,results,noRealConfig:true,noCommitOrHook:true,signalsSent:0};
 fs.writeFileSync(path.join(__dirname,'owner-config-framing-witness-01.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({root,results}));
 for(const [name,result]of Object.entries(results))if(!result.actualClose||!result.stdoutEOF||!result.stderrEOF||result.signal||result.stderr.bytes||result.stdout.bytes>65536||result.exitCode!==(name==='none'?1:0))throw Error('Witness result unavailable: '+name);
}
main().catch(()=>{console.error('Synthetic owner framing witness failed; retained output must be inspected.');process.exitCode=1;});
