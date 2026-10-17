const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const repo = path.resolve(__dirname,'../../../..'), git = 'C:\\Program Files\\Git\\cmd\\git.exe', ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const root = fs.mkdtempSync(path.join(os.tmpdir(),'soter-f10-git-diagnostic-')), job = fs.mkdtempSync(path.join(os.tmpdir(),'soter-f10-git-diagnostic-job-'));
fs.mkdirSync(path.join(job,'empty-hooks')); fs.writeFileSync(path.join(job,'empty.gitconfig'),'');
const env = {SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,COMSPEC:process.env.COMSPEC,HOME:job,USERPROFILE:job,TEMP:job,TMP:job,XDG_CONFIG_HOME:job,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(job,'empty.gitconfig'),GIT_CONFIG_SYSTEM:path.join(job,'empty.gitconfig'),GIT_NO_LAZY_FETCH:'1',GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0',GIT_ATTR_NOSYSTEM:'1',GIT_PROTOCOL_FROM_USER:'0'};
async function finite(file,args,input) { return new Promise((resolve,reject)=>{const child=cp.spawn(file,args,{cwd:root,env,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});const out=[],err=[];child.once('error',reject);child.stdout.on('data',b=>out.push(b));child.stderr.on('data',b=>err.push(b));child.once('close',code=>resolve({code,stdout:Buffer.concat(out).toString('utf8'),stderr:Buffer.concat(err).toString('utf8')}));child.stdin.end(input);}); }
(async()=>{
 const init=await finite(git,['-c','core.hooksPath='+path.join(job,'empty-hooks'),'-c','core.fsmonitor=false','init','--initial-branch=main','--template='+path.join(job,'empty-hooks')]); if(init.code)throw new Error('Synthetic init failed');
 fs.writeFileSync(path.join(root,'public.txt'),'public fixture\n'); const add=await finite(git,['-c','core.hooksPath='+path.join(job,'empty-hooks'),'add','--','public.txt']); if(add.code)throw new Error('Synthetic add failed');
 const source=fs.readFileSync(path.join(repo,'packages/vscode-extension/src/terminal/PowerShell51Worker.ts'),'utf8');
 const original=source.split('const SCRIPT = String.raw`')[1].split('`;')[0];
 // Diagnostic copy only: retain the original terminating error in an isolated
 // entirely public synthetic repository. Production keeps constant diagnostics.
 const diagnostic=original.replace("catch { throw 'Checked PowerShell operation unavailable.' }",'catch { throw $_ }');
 const result=await finite(ps,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(diagnostic,'utf16le').toString('base64')],JSON.stringify({operation:{kind:'GIT',action:'status'},git:{job}}));
 const evidence={root,job,syntheticOnly:true,diagnosticCopy:true,result}; fs.writeFileSync(path.join(__dirname,'git-script-diagnostic-01.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(evidence));
})();
