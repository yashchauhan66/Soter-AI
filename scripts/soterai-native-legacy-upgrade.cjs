'use strict';
// Actual legacy/current VSIX installations in one isolated profile. No keys
// are extracted or provided to the upgraded instance.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {run}=require('./soterai-installed-acceptance.cjs');
const {resolveRelease}=require('../packages/soterai-lite/scripts/release-artifact.cjs');
const yauzl=require('../tools/soterai-lite-packager/node_modules/yauzl');
const repo=path.resolve(__dirname,'..'),base=path.join(repo,'docs/soterai-lite/evidence/20261114-release-gates');
const exe='C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const demand=v=>{if(!v)throw Error('UPGRADE_PRECONDITION');};
async function legacy(){
 const artifactPath='packages/vscode-extension/soterai-ide-guard-0.6.2.vsix',bytes=await fs.readFile(path.join(repo,artifactPath));
 demand(sha(bytes)==='a74ef2597d7b07b019bc58e0f1d591aa37dd7986acba78b07dd6ff03fa042454');
 const wanted=['extension/package.json',...['extension.js','local-ai-broker.js','soterai-mcp-server.js'].map(n=>'extension/dist/'+n)];
 const found=new Map();
 await new Promise((resolve,reject)=>yauzl.fromBuffer(bytes,{lazyEntries:true},(error,zip)=>{
  if(error)return reject(error);zip.on('error',reject);zip.on('end',resolve);zip.on('entry',entry=>{
   if(!wanted.includes(entry.fileName))return zip.readEntry();
   if(found.has(entry.fileName)||entry.uncompressedSize>8*1024*1024)return reject(Error('LEGACY_ARCHIVE'));
   zip.openReadStream(entry,(error,stream)=>{if(error)return reject(error);const chunks=[];stream.on('data',c=>chunks.push(c));stream.on('error',reject);stream.on('end',()=>{found.set(entry.fileName,Buffer.concat(chunks));zip.readEntry();});});
  });zip.readEntry();
 }));
 demand(found.size===4);const manifest=JSON.parse(found.get('extension/package.json'));
 demand(manifest.version==='0.6.2'&&manifest.publisher+'.'+manifest.name==='soterai.soterai-ide-guard');
 return {artifactPath,sha256:sha(bytes),version:'0.6.2',identity:'soterai.soterai-ide-guard',runtimes:wanted.slice(1).map(file=>({name:path.basename(file),bytes:found.get(file).length,sha256:sha(found.get(file))}))};
}
async function main(){
 const [mode,location,pointer,cohortLocation]=process.argv.slice(2);demand(['prepare-legacy','prepare-upgrade','run'].includes(mode));
 const out=path.resolve(repo,location);demand(out.startsWith(base+path.sep));
 if(mode!=='run'){
  const release=await resolveRelease({repoRoot:repo,pointerPath:path.resolve(repo,pointer)}),old=await legacy();
  await fs.mkdir(out);await fs.mkdir(path.join(out,'driver'));await fs.mkdir(path.join(out,'temp'));
  let cohort=out,seed;
  if(mode==='prepare-upgrade'){
   cohort=path.resolve(repo,cohortLocation);demand(cohort.startsWith(base+path.sep)&&cohort!==out);
   seed=JSON.parse(await fs.readFile(path.join(cohort,'host-result.json'),'utf8'));
   const launch=JSON.parse(await fs.readFile(path.join(cohort,'native-launch.json'),'utf8'));
   demand(seed.status==='PASS_NATIVE_LEGACY_VAULT_SEED'&&seed.artifactSha256===old.sha256&&launch.native.ok&&launch.native.processClosed);
  }else{
   await fs.mkdir(path.join(out,'workspace'));await fs.mkdir(path.join(out,'profile'));
   const fakeOpenAi='sk-proj-'+crypto.randomBytes(32).toString('hex'),fakeGithub='ghp_'+crypto.randomBytes(20).toString('hex');
   await fs.writeFile(path.join(out,'workspace/legacy.env'),'OPENAI_API_KEY="'+fakeOpenAi+'"\nGITHUB_TOKEN="'+fakeGithub+'"\n',{flag:'wx'});
  }
  await fs.mkdir(path.join(cohort,'workspace/upgrade'),{recursive:true});
  if(mode==='prepare-upgrade')await fs.writeFile(path.join(cohort,'workspace/upgrade/.env'),'SERVICE_PASSWORD="AmberMoon8!"\nQUEUE_PASSWORD="VioletBridge2!"\n',{flag:'wx'});
  const build=JSON.parse(await fs.readFile(path.join(repo,release.buildReceiptPath),'utf8'));
  const target=mode==='prepare-legacy'?old:{artifactPath:release.artifactPath,sha256:release.sha256,version:release.version,identity:release.identity,runtimes:build.inventory.map(({name,bytes,sha256})=>({name,bytes,sha256}))};
  const prepared={schemaVersion:1,mode:mode==='prepare-legacy'?'legacy':'upgrade',pointerPath:path.resolve(repo,pointer),currentCandidateSha256:release.sha256,cohortRoot:cohort,runNonce:crypto.randomBytes(16).toString('hex'),target,baseline:old,
   ...(seed?{seedSha256:sha(await fs.readFile(path.join(cohort,'host-result.json'))),seedLaunchSha256:sha(await fs.readFile(path.join(cohort,'native-launch.json')))}:{})};
  for(const name of ['host','renderer']){const bytes=await fs.readFile(path.join(__dirname,'soterai-native-legacy-upgrade.'+name+'.cjs'));await fs.writeFile(path.join(out,'driver',name+'.cjs'),bytes,{flag:'wx'});prepared[name+'Sha256']=sha(bytes);}
  await fs.writeFile(path.join(out,'driver/package.json'),JSON.stringify({name:'soterai-legacy-upgrade-driver',publisher:'local-test',version:'0.0.1',engines:{vscode:'^1.85.0'},main:'./extension.cjs',activationEvents:['onStartupFinished']}),{flag:'wx'});
  await fs.writeFile(path.join(out,'driver/extension.cjs'),"exports.activate=()=>{void(async()=>{await new Promise(r=>setTimeout(r,1500));try{await require('./host.cjs').run();}catch{await require('node:fs/promises').writeFile(require('node:path').join(__dirname,'../driver-failed.json'),JSON.stringify({status:'DRIVER_FAILED'}),{flag:'wx'});}finally{await require('vscode').commands.executeCommand('workbench.action.quit');}})();};\n",{flag:'wx'});
  await fs.writeFile(path.join(out,'prepared.json'),JSON.stringify(prepared,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PREPARED_NOT_RUN',mode:prepared.mode,targetSha256:target.sha256}));return;
 }
 const p=JSON.parse(await fs.readFile(path.join(out,'prepared.json'),'utf8'));
 const current=await resolveRelease({repoRoot:repo,pointerPath:p.pointerPath});demand(current.sha256===p.currentCandidateSha256);
 demand(sha(await fs.readFile(path.join(repo,p.target.artifactPath)))===p.target.sha256);
 for(const name of ['host','renderer'])demand(sha(await fs.readFile(path.join(out,'driver',name+'.cjs')))===p[name+'Sha256']);
 try{await fs.lstat(path.join(out,'native-launch.json'));throw Error('REPLAY');}catch(e){if(e.code!=='ENOENT')throw e;}
 const profile=path.join(p.cohortRoot,'profile'),env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',PATH:'C:\\Windows\\System32',USERPROFILE:profile,APPDATA:path.join(profile,'AppData/Roaming'),LOCALAPPDATA:path.join(profile,'AppData/Local'),TEMP:path.join(out,'temp'),TMP:path.join(out,'temp'),SOTERAI_LEGACY_UPGRADE_DIRECTORY:out};
 for(const name of ['APPDATA','LOCALAPPDATA'])await fs.mkdir(env[name],{recursive:true});
 await fs.mkdir(path.join(profile,'user-data/User'),{recursive:true});
 if(p.mode==='legacy')await fs.writeFile(path.join(profile,'user-data/User/settings.json'),JSON.stringify({'update.mode':'none','extensions.autoUpdate':false,'extensions.autoCheckUpdates':false,'telemetry.telemetryLevel':'off','git.enabled':false,'soterai.cloud.enabled':false,'soterai.broker.autoStart':false,'soterai.autoVaultMigration.enabled':false,'soterai.secretInterceptor.enabled':false,'soterai.lite.secureEditor':false,'window.dialogStyle':'custom'}),{flag:'wx'});
 const launch=await fs.readFile(path.join(path.dirname(exe),'bin/code.cmd'),'utf8'),inv=launch.split(/\r?\n/).map(s=>s.match(/^"([^"]+)"\s+"([^"]+)"\s+%\*\s*$/i)).find(Boolean);demand(inv);
 const cli=path.resolve(inv[2].replace(/^%~dp0/i,path.join(path.dirname(exe),'bin')+path.sep));demand(cli.startsWith(path.dirname(exe)+path.sep));
 const common=['--user-data-dir',path.join(profile,'user-data'),'--extensions-dir',path.join(profile,'extensions'),'--disable-telemetry','--skip-welcome','--skip-release-notes','--disable-updates'];
 const installation=await run([cli,...common,'--install-extension',path.join(repo,p.target.artifactPath),'--force'],{...env,ELECTRON_RUN_AS_NODE:'1'},out,30000);
 let native={ok:false,code:'INSTALL_FAILED'};
 if(installation.ok)native=await run([...common,'--new-window','--wait','--disable-gpu','--disable-workspace-trust','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--extensionDevelopmentPath='+path.join(out,'driver'),path.join(p.cohortRoot,'workspace')],env,out,150000,child=>require(path.join(out,'driver/renderer.cjs')).run(out,child));
 let host;try{host=JSON.parse(await fs.readFile(path.join(out,'host-result.json'),'utf8'));demand(host.artifactSha256===p.target.sha256&&host.runNonce===p.runNonce&&host.status===(p.mode==='legacy'?'PASS_NATIVE_LEGACY_VAULT_SEED':'PASS_NATIVE_POPULATED_LEGACY_UPGRADE'));}catch{native.ok=false;native.code='HOST_REPORT_FAILED';}
 const report={schemaVersion:1,artifactSha256:p.target.sha256,currentCandidateSha256:current.sha256,install:{ok:installation.ok,code:installation.code},native:{ok:native.ok,code:native.code,pid:native.pid,processClosed:native.processClosed,startedAt:native.startedAt,closedAt:native.closedAt},hostReport:host,normalProfileModified:false,releaseReady:false};
 await fs.writeFile(path.join(out,'native-launch.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({mode:p.mode,native:report.native,hostStatus:host?.status}));if(!native.ok)process.exitCode=2;
}
main().catch(()=>{console.error('Legacy upgrade acceptance unavailable; retained evidence is not a pass.');process.exitCode=2;});
