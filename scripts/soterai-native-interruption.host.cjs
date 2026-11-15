'use strict';
const vscode=require('vscode'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),demand=v=>{if(!v)throw Error('INTERRUPTION_CHECK');};
const original='DB_PASSWORD="BlueMango7!"\nAPI_PASSWORD="OrangeRiver9!"\n',safe='DB_PASSWORD=\nAPI_PASSWORD=\n';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.run=async()=>{
 const out=process.env.SOTERAI_INTERRUPTION_DIRECTORY,p=JSON.parse(await fs.readFile(path.join(out,'prepared.json'),'utf8'));
 const cohort=p.cohortRoot,source=path.join(cohort,'workspace/.env'),storage=path.join(cohort,'profile/user-data/User/globalStorage',p.identity),cipher=path.join(storage,'soterai-vault.enc'),pending=path.join(storage,'vault-pending.json');
 const result={schemaVersion:1,status:'FAIL_NATIVE_INTERRUPTION',artifactSha256:p.artifactSha256,runNonce:p.runNonce,phase:p.phase,extensionHostPid:process.pid,checks:[],nativeSecretStorageUsed:true,productBytesModified:false};let ordinal=0;
 async function check(name,fn){try{await fn();result.checks.push({name,status:'PASS'});return true;}catch(e){result.checks.push({name,status:'FAIL',errorClass:e.name,lines:(String(e.stack).match(/host[.]cjs:[0-9]+:[0-9]+/g)||[]).slice(0,3)});return false;}}
 async function command(stage,id,args=[]){ordinal++;await fs.writeFile(path.join(out,`ui-request-${ordinal}.json`),JSON.stringify({runNonce:p.runNonce,ordinal,stage}),{flag:'wx'});await vscode.commands.executeCommand(id,...args);for(let i=0;i<250;i++){try{const a=JSON.parse(await fs.readFile(path.join(out,`ui-step-${ordinal}.json`),'utf8'));demand(a.runNonce===p.runNonce&&a.status==='PASS');return;}catch(e){if(e.code!=='ENOENT')throw e;}await delay(100);}throw Error('UI_TIMEOUT');}
 const uri=vscode.Uri.file(source);
 try{
  if(!await check('exact-installed-product',async()=>{demand(vscode.workspace.isTrusted&&path.resolve(process.env.USERPROFILE).toLowerCase()===path.join(cohort,'profile').toLowerCase());const e=vscode.extensions.getExtension(p.identity);demand(e&&e.packageJSON.version===p.version&&e.extensionPath.toLowerCase().startsWith(path.join(cohort,'profile/extensions').toLowerCase()+path.sep));for(const f of p.runtimes){const b=await fs.readFile(path.join(e.extensionPath,'dist',f.name));demand(b.length===f.bytes&&sha(b)===f.sha256);}await e.activate();demand(e.isActive);}))return;
  if(p.phase==='crash'){
   const rename=fs.rename;let held=false;
   fs.rename=async function(from,to){await rename.apply(this,arguments);if(!held&&path.resolve(String(to)).toLowerCase()===cipher.toLowerCase()){
    held=true;demand(await fs.readFile(source,'utf8')===original);const ciphertext=await fs.readFile(cipher),pointer=await fs.readFile(pending);
    const generations=(await fs.readdir(storage)).filter(n=>/^vault-generation-.*\.enc$/.test(n));demand(generations.length===1&&!ciphertext.toString('utf8').includes('BlueMango7!'));
    await fs.writeFile(path.join(out,'barrier.json'),JSON.stringify({schemaVersion:1,status:'NATIVE_VAULT_COMMIT_BARRIER',artifactSha256:p.artifactSha256,runNonce:p.runNonce,extensionHostPid:process.pid,sourceSha256:sha(original),cipherSha256:sha(ciphertext),pendingSha256:sha(pointer),generation:generations[0],checks:result.checks}),{flag:'wx'});
    await new Promise(()=>{});
   }};
   await command('migrate','soterai.migrateSecretsToVault',[uri]);throw Error('BARRIER_NOT_REACHED');
  }
  if(!await check('prior-processes-closed-and-encrypted-state-retained',async()=>{
   const previous=JSON.parse(await fs.readFile(path.join(p.parent,'native-launch.json'),'utf8'));demand(previous.ok&&previous.native.processClosed);
   for(const pid of [previous.native.pid,previous.hostReport?.extensionHostPid].filter(Boolean)){let gone=false;try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')gone=true;else throw e;}demand(gone);}
   if(p.phase==='recovery'){const b=JSON.parse(await fs.readFile(path.join(cohort,'barrier.json'),'utf8'));demand(sha(await fs.readFile(source))===b.sourceSha256&&sha(await fs.readFile(cipher))===b.cipherSha256&&sha(await fs.readFile(pending))===b.pendingSha256);}
   else{demand(sha(await fs.readFile(source))===previous.hostReport.maskedSha256&&sha(await fs.readFile(cipher))===previous.hostReport.cipherSha256);}
  }))return;
  if(p.phase==='recovery'){
   if(!await check('recovery-cancel-preserves-source-and-pending',async()=>{const before=sha(await fs.readFile(pending));await command('cancel-recovery','soterai.recoverVaultMigration',[uri]);demand(await fs.readFile(source,'utf8')===original&&sha(await fs.readFile(pending))===before);}))return;
   if(!await check('approved-recovery-with-native-persisted-key',async()=>{await command('recover','soterai.recoverVaultMigration',[uri]);const masked=await fs.readFile(source,'utf8');demand(masked.includes('SOTERAI_PROTECTED_')&&!masked.includes('BlueMango7!')&&!masked.includes('OrangeRiver9!')&&await fs.readFile(path.join(cohort,'workspace/.env.example'),'utf8')===safe);let absent=false;try{await fs.lstat(pending);}catch(e){if(e.code==='ENOENT')absent=true;else throw e;}demand(absent);}))return;
   if(!await check('repeat-recovery-idempotent',async()=>{const before=sha(await fs.readFile(source)),vault=sha(await fs.readFile(cipher));await vscode.commands.executeCommand('soterai.recoverVaultMigration',uri);demand(sha(await fs.readFile(source))===before&&sha(await fs.readFile(cipher))===vault);}))return;
  }
  if(!await check('native-vault-metadata-two-authenticated-records',()=>command('metadata','soterai.openVaultStatus')))return;
  if(p.phase==='verify'&&!await check('second-restart-approved-original-restoration',async()=>{await command('restore','soterai.restoreSecretPlaceholders',[uri]);demand(await fs.readFile(source,'utf8')===original);}))return;
  result.maskedSha256=sha(await fs.readFile(source));result.cipherSha256=sha(await fs.readFile(cipher));result.status='PASS_NATIVE_INTERRUPTION_'+p.phase.toUpperCase();
 }finally{await fs.writeFile(path.join(out,'host-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
};
