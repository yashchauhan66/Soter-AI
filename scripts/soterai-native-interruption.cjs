'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {run}=require('./soterai-installed-acceptance.cjs');
const {resolveRelease}=require('../packages/soterai-lite/scripts/release-artifact.cjs');
const repo=path.resolve(__dirname,'..'),base=path.join(repo,'docs/soterai-lite/evidence/20261114-release-gates');
const exe='C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),demand=v=>{if(!v)throw Error('INTERRUPTION_PRECONDITION');};
async function main(){
 const [action,location,phase,parentLocation]=process.argv.slice(2),out=path.resolve(repo,location);demand(out.startsWith(base+path.sep));
 const pointer=path.join(base,'candidate-pointer.json'),release=await resolveRelease({repoRoot:repo,pointerPath:pointer});
 if(action==='prepare'){
  demand(['crash','recovery','verify'].includes(phase));await fs.mkdir(out);await fs.mkdir(path.join(out,'driver'));await fs.mkdir(path.join(out,'temp'));
  let cohort=out,parent,prior;
  if(phase==='crash'){
   await fs.mkdir(path.join(out,'workspace'));await fs.mkdir(path.join(out,'profile'));
   await fs.writeFile(path.join(out,'workspace/.env'),'DB_PASSWORD="BlueMango7!"\nAPI_PASSWORD="OrangeRiver9!"\n',{flag:'wx'});
  }else{
   parent=path.resolve(repo,parentLocation);demand(parent.startsWith(base+path.sep));prior=JSON.parse(await fs.readFile(path.join(parent,'native-launch.json'),'utf8'));
   demand(prior.ok&&prior.artifactSha256===release.sha256&&prior.native.processClosed&&prior.phase===(phase==='recovery'?'crash':'recovery'));
   const previous=JSON.parse(await fs.readFile(path.join(parent,'prepared.json'),'utf8'));cohort=previous.cohortRoot;
  }
  const build=JSON.parse(await fs.readFile(path.join(repo,release.buildReceiptPath),'utf8'));
  const p={schemaVersion:1,phase,cohortRoot:cohort,parent,artifactSha256:release.sha256,identity:release.identity,version:release.version,
   runNonce:crypto.randomBytes(16).toString('hex'),runtimes:build.inventory.map(({name,bytes,sha256})=>({name,bytes,sha256})),
   ...(parent?{parentLaunchSha256:sha(await fs.readFile(path.join(parent,'native-launch.json')))}:{})};
  for(const name of ['host','renderer']){const b=await fs.readFile(path.join(__dirname,'soterai-native-interruption.'+name+'.cjs'));await fs.writeFile(path.join(out,'driver',name+'.cjs'),b,{flag:'wx'});p[name+'Sha256']=sha(b);}
  await fs.writeFile(path.join(out,'driver/package.json'),JSON.stringify({name:'soterai-native-interruption-driver',publisher:'local-test',version:'0.0.1',engines:{vscode:'^1.85.0'},main:'extension.cjs',activationEvents:['onStartupFinished']}),{flag:'wx'});
  await fs.writeFile(path.join(out,'driver/extension.cjs'),"exports.activate=()=>{void(async()=>{await new Promise(r=>setTimeout(r,1500));try{await require('./host.cjs').run();}catch{await require('node:fs/promises').writeFile(require('node:path').join(__dirname,'../driver-failed.json'),JSON.stringify({status:'DRIVER_FAILED'}),{flag:'wx'});}finally{await require('vscode').commands.executeCommand('workbench.action.quit');}})();};\n",{flag:'wx'});
  await fs.writeFile(path.join(out,'prepared.json'),JSON.stringify(p,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PREPARED_NOT_RUN',phase,sha256:release.sha256}));return;
 }
 demand(action==='run');const p=JSON.parse(await fs.readFile(path.join(out,'prepared.json'),'utf8'));demand(p.artifactSha256===release.sha256);
 try{await fs.lstat(path.join(out,'native-launch.json'));throw Error('REPLAY');}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const name of ['host','renderer'])demand(sha(await fs.readFile(path.join(out,'driver',name+'.cjs')))===p[name+'Sha256']);
 if(p.parent)demand(sha(await fs.readFile(path.join(p.parent,'native-launch.json')))===p.parentLaunchSha256);
 const profile=path.join(p.cohortRoot,'profile'),env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',PATH:'C:\\Windows\\System32',USERPROFILE:profile,APPDATA:path.join(profile,'AppData/Roaming'),LOCALAPPDATA:path.join(profile,'AppData/Local'),TEMP:path.join(out,'temp'),TMP:path.join(out,'temp'),SOTERAI_INTERRUPTION_DIRECTORY:out};
 for(const key of ['APPDATA','LOCALAPPDATA'])await fs.mkdir(env[key],{recursive:true});await fs.mkdir(path.join(profile,'user-data/User'),{recursive:true});
 if(p.phase==='crash')await fs.writeFile(path.join(profile,'user-data/User/settings.json'),JSON.stringify({'update.mode':'none','extensions.autoUpdate':false,'extensions.autoCheckUpdates':false,'telemetry.telemetryLevel':'off','git.enabled':false,'soterai.cloud.enabled':false,'soterai.broker.autoStart':false,'soterai.autoVaultMigration.enabled':false,'window.dialogStyle':'custom'}),{flag:'wx'});
 const launcher=await fs.readFile(path.join(path.dirname(exe),'bin/code.cmd'),'utf8'),match=launcher.split(/\r?\n/).map(s=>s.match(/^"([^"]+)"\s+"([^"]+)"\s+%\*\s*$/i)).find(Boolean);demand(match);
 const cli=path.resolve(match[2].replace(/^%~dp0/i,path.join(path.dirname(exe),'bin')+path.sep));demand(cli.startsWith(path.dirname(exe)+path.sep));
 const common=['--user-data-dir',path.join(profile,'user-data'),'--extensions-dir',path.join(profile,'extensions'),'--disable-telemetry','--skip-welcome','--skip-release-notes','--disable-updates'];
 const install=await run([cli,...common,'--install-extension',path.join(repo,release.artifactPath)],{...env,ELECTRON_RUN_AS_NODE:'1'},out);demand(install.ok);
 const native=await run([...common,'--new-window','--wait','--disable-gpu','--disable-workspace-trust','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--extensionDevelopmentPath='+path.join(out,'driver'),path.join(p.cohortRoot,'workspace')],env,out,150000,child=>require(path.join(out,'driver/renderer.cjs')).run(out,child));
 let ok=false,host;
 if(p.phase==='crash'){
  const barrier=JSON.parse(await fs.readFile(path.join(out,'barrier.json'),'utf8')),kill=JSON.parse(await fs.readFile(path.join(out,'kill-result.json'),'utf8'));
  demand(barrier.runNonce===p.runNonce&&barrier.artifactSha256===release.sha256&&kill.runNonce===p.runNonce&&kill.pid===native.pid&&kill.exitCode===0&&kill.hostDescendantVerified);
  let gone=false;try{process.kill(barrier.extensionHostPid,0);}catch(e){if(e.code==='ESRCH')gone=true;else throw e;}
  ok=native.processClosed&&native.code==='EXIT_NONZERO'&&gone;
 }else{
  host=JSON.parse(await fs.readFile(path.join(out,'host-result.json'),'utf8'));
  ok=native.ok&&native.processClosed&&host.runNonce===p.runNonce&&host.artifactSha256===release.sha256&&host.status==='PASS_NATIVE_INTERRUPTION_'+p.phase.toUpperCase()&&host.checks.every(c=>c.status==='PASS');
 }
 const report={schemaVersion:1,status:ok?'PASS_NATIVE_INTERRUPTION_'+p.phase.toUpperCase():'FAIL_NATIVE_INTERRUPTION',phase:p.phase,artifactSha256:release.sha256,ok,
  native:{ok:native.ok,code:native.code,pid:native.pid,startedAt:native.startedAt,closedAt:native.closedAt,processClosed:native.processClosed},hostReport:host,
  nativeSecretStorageUsed:true,productBytesModified:false,crashSeam:'Fixture holds node:fs/promises.rename after committing the live ciphertext; the owned app tree is then forcibly terminated',powerLossTested:false,releaseReady:false};
 await fs.writeFile(path.join(out,'native-launch.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,phase:p.phase,ok,processClosed:native.processClosed}));if(!ok)process.exitCode=2;
}
main().catch(e=>{console.error(JSON.stringify({status:'INTERRUPTION_UNAVAILABLE',errorClass:e.name,code:e.code}));process.exitCode=2;});
