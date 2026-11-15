'use strict';
const vscode=require('vscode'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),demand=v=>{if(!v)throw Error('LEGACY_UPGRADE_CHECK');};
const noValues=s=>!['SYNTHETIC_LEGACY_ONLY','LegacyFixture7!','AmberMoon8!','VioletBridge2!'].some(v=>s.includes(v));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.run=async()=>{
 const out=process.env.SOTERAI_LEGACY_UPGRADE_DIRECTORY,p=JSON.parse(await fs.readFile(path.join(out,'prepared.json'),'utf8'));
 const cohort=p.cohortRoot,workspace=path.join(cohort,'workspace'),legacyFile=path.join(workspace,'legacy.env'),newFile=path.join(workspace,'upgrade/.env');
 const storage=path.join(cohort,'profile/user-data/User/globalStorage',p.target.identity),cipherFile=path.join(storage,'soterai-vault.enc');
 const result={schemaVersion:1,status:'FAIL_NATIVE_LEGACY_UPGRADE',artifactSha256:p.target.sha256,currentCandidateSha256:p.currentCandidateSha256,runNonce:p.runNonce,checks:[],extensionHostPid:process.pid,mode:p.mode,productApiMocked:false,nativeSecretStorageUsed:true,normalProfileModified:false,independentHumanReview:false,releaseReady:false};
 let ordinal=0;
 async function check(name,fn){try{await fn();result.checks.push({name,status:'PASS'});return true;}catch(error){result.checks.push({name,status:'FAIL',errorClass:error?.name,code:/^[A-Z0-9_]{1,60}$/.test(error?.code||'')?error.code:undefined,
  pathFailure:typeof error?.message==='string'&&error.name==='WorkspacePathViolation'?['outside','alias','canonical','symbolic','trusted'].filter(term=>error.message.includes(term)):undefined});return false;}}
 async function command(stage,id,args=[],expectedCount){
  ordinal++;await fs.writeFile(path.join(out,`ui-request-${ordinal}.json`),JSON.stringify({schemaVersion:1,runNonce:p.runNonce,ordinal,stage,expectedCount}),{flag:'wx'});
  await vscode.commands.executeCommand(id,...args);const deadline=Date.now()+25000;
  while(Date.now()<deadline){try{const ack=JSON.parse(await fs.readFile(path.join(out,`ui-step-${ordinal}.json`),'utf8'));demand(ack.runNonce===p.runNonce&&ack.status==='PASS');return ack;}catch(e){if(e.code!=='ENOENT')throw e;}await delay(100);}throw Error('UI_TIMEOUT');
 }
 try{
  if(p.mode==='legacy'){
   // The old release compares drive-letter spelling to realpath verbatim.
   // Normalize only that spelling in this isolated fixture generator; keep
   // the original product, containment checks and cryptography unchanged.
   let prototype=Object.getPrototypeOf(vscode.Uri.file(legacyFile)),descriptor;
   while(prototype&&!(descriptor=Object.getOwnPropertyDescriptor(prototype,'fsPath')))prototype=Object.getPrototypeOf(prototype);
   demand(descriptor?.get&&descriptor.configurable);
   Object.defineProperty(prototype,'fsPath',{...descriptor,get(){const value=descriptor.get.call(this);return process.platform==='win32'&&['file','vscode-userdata'].includes(this.scheme)?value.replace(/^[a-z]:/i,drive=>drive.toUpperCase()):value;}});
   result.legacyUriDriveCasingInstrumented=true;result.unmodifiedLegacyNativeAcceptance=false;
  }
  if(!await check('exact-installed-product',async()=>{
   demand(vscode.workspace.isTrusted&&path.resolve(process.env.USERPROFILE).toLowerCase()===path.join(cohort,'profile').toLowerCase());
   const extension=vscode.extensions.getExtension(p.target.identity);demand(extension&&extension.packageJSON.version===p.target.version&&extension.extensionPath.toLowerCase().startsWith(path.join(cohort,'profile/extensions').toLowerCase()+path.sep));
   for(const f of p.target.runtimes){const b=await fs.readFile(path.join(extension.extensionPath,'dist',f.name));demand(b.length===f.bytes&&sha(b)===f.sha256);}await extension.activate();demand(extension.isActive);
  }))return;
  if(p.mode==='legacy'){
   if(!await check('legacy-product-encrypted-seed',async()=>{
    const original=await fs.readFile(legacyFile,'utf8'),rawValues=original.split('\n').filter(Boolean).map(line=>/^\w+="([^"]+)"$/.exec(line)?.[1]);demand(rawValues.length===2&&rawValues.every(v=>typeof v==='string'));
    result.legacyObservations={sourceLoaded:true,expectedValues:2};
    const document=await vscode.workspace.openTextDocument(vscode.Uri.file(legacyFile));await vscode.window.showTextDocument(document);
    result.legacyObservations.activeEditorScheme=vscode.window.activeTextEditor?.document.uri.scheme;
    result.legacyObservations.owningWorkspaceFound=!!vscode.workspace.getWorkspaceFolder(document.uri);
    await delay(500);await command('migrate-legacy','soterai.migrateSecretsToVault',[vscode.Uri.file(legacyFile)]);
    const masked=await fs.readFile(legacyFile,'utf8');let cipherExists=true;try{await fs.lstat(cipherFile);}catch(e){if(e.code==='ENOENT')cipherExists=false;else throw e;}
    Object.assign(result.legacyObservations,{sourceChanged:masked!==original,sourceHasMarkers:masked.includes('SOTERAI_PROTECTED_'),cipherExists});
    const cipher=await fs.readFile(cipherFile);demand(masked!==original&&masked.includes('SOTERAI_PROTECTED_')&&rawValues.every(v=>!masked.includes(v)&&!cipher.toString('utf8').includes(v)));
    result.maskedSourceSha256=sha(masked);result.legacyCipherSha256=sha(cipher);result.sourceFinalState='MASKED';
   }))return;
   result.status='PASS_NATIVE_LEGACY_VAULT_SEED';return;
  }
  let seed;
  if(!await check('persisted-legacy-encrypted-state-and-cold-process',async()=>{
   const bytes=await fs.readFile(path.join(cohort,'host-result.json'));demand(sha(bytes)===p.seedSha256);seed=JSON.parse(bytes);
   const launchBytes=await fs.readFile(path.join(cohort,'native-launch.json'));demand(sha(launchBytes)===p.seedLaunchSha256);const launch=JSON.parse(launchBytes);
   demand(launch.native.ok&&launch.native.processClosed&&seed.extensionHostPid!==process.pid);
   for(const pid of new Set([seed.extensionHostPid,launch.native.pid])){let gone=false;try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')gone=true;else throw e;}demand(gone);}
   demand(sha(await fs.readFile(cipherFile))===seed.legacyCipherSha256&&sha(await fs.readFile(legacyFile))===seed.maskedSourceSha256);result.oldOwningProcessesExited=true;
  }))return;
  if(!await check('upgraded-product-authenticates-legacy-vault',async()=>{const ack=await command('metadata-legacy','soterai.openVaultStatus',[],2);result.legacyNames=ack.names;}))return;
  if(!await check('upgraded-migration-retains-legacy-records',async()=>{
   await command('migrate-new','soterai.migrateSecretsToVault',[vscode.Uri.file(newFile)]);demand(noValues(await fs.readFile(newFile,'utf8')));
   const ack=await command('metadata-merged','soterai.openVaultStatus',[],4);demand(result.legacyNames.every(n=>ack.names.includes(n)));result.mergedNames=ack.names;
   demand(noValues((await fs.readFile(cipherFile)).toString('utf8'))&&sha(await fs.readFile(legacyFile))===seed.maskedSourceSha256);
  }))return;
  if(!await check('upgraded-owner-reviewed-current-record-recovery',async()=>{
   await command('restore-new','soterai.restoreSecretPlaceholders',[vscode.Uri.file(newFile)]);
   demand((await fs.readFile(newFile,'utf8'))==='SERVICE_PASSWORD="AmberMoon8!"\nQUEUE_PASSWORD="VioletBridge2!"\n');
   demand(sha(await fs.readFile(legacyFile))===seed.maskedSourceSha256);result.currentRecoveryVerified=true;
   await vscode.commands.executeCommand('soterai.restoreSecretPlaceholders',vscode.Uri.file(legacyFile));demand(sha(await fs.readFile(legacyFile))===seed.maskedSourceSha256);result.legacyUnboundRestorationWithheld=true;
  }))return;
  result.status='PASS_NATIVE_POPULATED_LEGACY_UPGRADE';result.upgradeRecoveryTested=true;
 }finally{await fs.writeFile(path.join(out,'host-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
};
