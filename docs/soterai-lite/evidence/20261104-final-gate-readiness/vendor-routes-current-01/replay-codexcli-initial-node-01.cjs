'use strict';
// Read-only initial Node replay only. No Code, Codex, profile creation or network.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../../..'),a=JSON.parse(fs.readFileSync(own('codexcli-admission-02.json'))),{phase}=require('../../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
const env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',COMSPEC:'C:\\Windows\\System32\\cmd.exe',PATH:'C:\\Windows\\System32;C:\\Program Files\\nodejs',USERPROFILE:path.join(a.runRoot,'profile'),HOME:path.join(a.runRoot,'profile'),TEMP:path.join(a.runRoot,'profile','Temp'),TMP:path.join(a.runRoot,'profile','Temp')};
(async()=>{
 const records=[];for(const[name,args]of [['version',['--version']],['admission',[own('codexcli-route-current-02.cjs'),'--validate-prepared',own('codexcli-admission-02.json'),'130b9ee2694ecbef00e9e075f8813ae27dc1bbbb717d5e01f1b68903807fa97e']]]){
  const r=await phase({executable:'C:\\Program Files\\nodejs\\node.exe',args,cwd:repo,env,run:__dirname,name:'codexcli-initial-node-'+name+'-replay-01',profile:'READ_ONLY_EXACT_OUTER_WRAPPER_ENV_NO_NATIVE_CLIENT',deadlineMs:60000});
  assert(r.close.actualClose&&r.close.stdoutEOF&&r.close.stderrEOF&&!r.close.deadlineExceeded&&!r.close.signalsRequested);records.push({name,code:r.closed.code,signal:r.closed.signal,close:r.close});
 }
 const report={status:'OBSERVED_READ_ONLY_INITIAL_NODE_REPLAY_NO_NATIVE_OR_RETRY',observedAt:new Date().toISOString(),profileExists:fs.existsSync(path.join(a.runRoot,'profile')),records,codeLaunches:0,vendorClientLaunches:0,networkRequests:0,signalsRequested:0};fs.writeFileSync(own('codexcli-initial-node-replay-01.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,results:records.map(r=>({name:r.name,code:r.code,signal:r.signal})),profileExists:report.profileExists}));
})().catch(e=>{console.error(e);process.exitCode=1;});
