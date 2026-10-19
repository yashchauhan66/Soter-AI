'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const prior=path.resolve(__dirname,'../20261018-f17-safe-read-73bc91a2');
for(const name of ['inspect-vsix-01.ps1','artifact-binding-01.ps1','run-functional-01.ps1','run-security-01.ps1','run-affected-hosts-01.ps1']){
 let text=fs.readFileSync(path.join(prior,name),'utf8').replaceAll('20261018-f17-safe-read-73bc91a2','20261018-f18-cline-46a8c902').replaceAll('F17','F18').replaceAll('f17-','f18-');
 if(name==='inspect-vsix-01.ps1')text=text.replaceAll('soterai.lite.safeReadMcp','soterai.lite.clineAdapter').replaceAll('Count -ne 62','Count -ne 63').replaceAll('62 machine','63 machine').replaceAll('machineSettings=62','machineSettings=63');
 fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'});
}
const original=fs.readFileSync(path.join(__dirname,'native-vendor-probe-01.cjs'),'utf8');
let guards=original.slice(original.indexOf(' const restores=[];'),original.indexOf(' const finish=async status=>'));
assert.ok(guards.includes('const originalSpawn=cp.spawn'));
guards=guards.replace("if(!loopback(url.hostname))return Promise.reject", "if(!loopback(url.hostname)){records.deniedExternal.push('fetch');return Promise.reject").replace("Error('F18 test harness denied nonloopback fetch'));return originalFetch", "Error('F18 test harness denied nonloopback fetch'));}return originalFetch");
guards=guards.replace("const child=Reflect.apply(originalSpawn,this,args),row=",`const executable=String(args[0]),argv=Array.isArray(args[1])?args[1]:[],options=args[2]||{},base=path.basename(executable).toLowerCase();
 const inside=value=>typeof value==='string'&&path.resolve(value).toLowerCase().startsWith(path.resolve(root).toLowerCase()+path.sep);
 const cwd=options.cwd||process.cwd();let allowed=false;
 if(path.resolve(executable).toLowerCase()===path.resolve(process.execPath).toLowerCase()&&inside(argv[0])&&/[\\\\/]dist[\\\\/](?:local-ai-broker|soterai-mcp-server)[.]js$/.test(argv[0]))allowed=true;
 if(['powershell.exe','powershell','pwsh.exe','pwsh'].includes(base)){
   allowed=argv.includes('$PSVersionTable.PSVersion')||argv.some(value=>typeof value==='string'&&value.includes('SoterAI.Lite.F18.ConnectionTicket.v1')&&value.includes('[Security.Cryptography.ProtectedData]'))
    ||argv.some(value=>inside(value)&&/[\\\\/]\\.clinerules[\\\\/]hooks[\\\\/](?:TaskStart|PreToolUse)[.]ps1$/.test(value));
 }
 if(['git.exe','git'].includes(base)&&inside(cwd))allowed=argv.length===1&&argv[0]==='--version'||argv.includes('rev-parse')||argv.includes('--exec-path');
 if(base==='rg.exe'&&executable.toLowerCase().startsWith(path.dirname(process.execPath).toLowerCase()+path.sep)&&inside(cwd))allowed=true;
 if(!allowed){records.deniedChildLaunches.push({executable:base,argc:argv.length,cwdSynthetic:inside(cwd)});throw Object.assign(Error('F18 fixture child launch not in reviewed local allowlist'),{code:'EACCES'});}
 const child=Reflect.apply(originalSpawn,this,args),row=`);
guards=guards.replace("records.deniedSignals.push('PROCESS_SIGNAL_REFUSED')","records.deniedSignals.push(arguments[1]===0?'ZERO_SIGNAL_LIVENESS_REFUSED':'PROCESS_SIGNAL_REFUSED')");
const header="'use strict';\nconst fs=require('node:fs'),path=require('node:path'),http=require('node:http'),https=require('node:https'),cp=require('node:child_process'),net=require('node:net'),tls=require('node:tls');\nexports.install=(root,records)=>{records.deniedExternal=[];records.deniedSignals=[];records.deniedChildLaunches=[];\n";
fs.writeFileSync(path.join(__dirname,'product-test-guards-01.cjs'),header+guards+'\nreturn {children};\n};\n',{flag:'wx'});
console.log('Prepared artifact inspection and explicit test-only vendor isolation helpers; not executed.');
