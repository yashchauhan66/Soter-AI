const {spawn}=require('node:child_process'),{randomUUID,randomBytes}=require('node:crypto'),path=require('node:path'),fs=require('node:fs');
const repo=path.resolve(__dirname,'../../../..'),session=randomUUID(),events=[];
const child=spawn(process.execPath,['--import','tsx',path.join(repo,'apps/local-ai-broker/src/cli.ts')],{cwd:repo,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,SOTERAI_BROKER_SESSION:session,SOTERAI_BROKER_PORT:'0',SOTERAI_BROKER_TOKEN:randomBytes(32).toString('base64url'),SOTERAI_BROKER_CONTROL_TOKEN:randomBytes(32).toString('base64url')},windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
for(const name of ['spawn','disconnect','exit','close','error'])child.on(name,(a,b)=>events.push({event:name,code:typeof a==='number'?a:undefined,signal:typeof b==='string'?b:undefined}));
for(const name of ['stdout','stderr']){child[name].on('data',()=>{});for(const ev of ['end','close','error'])child[name].on(ev,()=>events.push({pipe:name,event:ev}));}
child.once('message',()=>{events.push({event:'READY'});child.disconnect();});
setTimeout(()=>{fs.writeFileSync(path.join(__dirname,'disconnect-observations-01.json'),JSON.stringify({events,exitCode:child.exitCode,signalCode:child.signalCode,connected:child.connected},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({events,exitCode:child.exitCode,connected:child.connected}));},3000);
