'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
let driver=fs.readFileSync(path.join(__dirname,'product-matrix-01.cjs'),'utf8');
const anchor="  const setup=()=>vscode.commands.executeCommand";assert.equal(driver.split(anchor).length,2);
driver=driver.replace(anchor,[
 "  const adapter=context.subscriptions.find(s=>typeof s.configure==='function'&&typeof s.status==='function'&&s.status()?.version==='0.160.1');",
 "  const appData=process.env.APPDATA,appRel=appData?path.relative(root,appData):'ABSENT';",
 "  records.ownerDiagnostic={found:!!adapter,available:adapter?.available?.(),readerEnabled:adapter?.reader?.isEnabled?.(),trusted:vscode.workspace.isTrusted,folders:vscode.workspace.workspaceFolders?.length,roamingRelative:appData&&!appRel.startsWith('..')&&!path.isAbsolute(appRel)?appRel:'OUTSIDE_OR_ABSENT'};",
 "  records.ownerStages=[];",
 "  if(adapter)for(const name of['saved','artifact','projectEligible','parent','stamp','bounded']){const original=adapter[name];if(typeof original!=='function')continue;adapter[name]=async function(...args){try{const result=await Reflect.apply(original,this,args);if(records.ownerStages.length<128)records.ownerStages.push({method:name,leaf:typeof args[0]==='string'?path.basename(args[0]):undefined,result:typeof result==='boolean'?result:Buffer.isBuffer(result)?'BYTES_'+result.length:result===undefined?'ABSENT':typeof result});return result;}catch(error){records.ownerStages.push({method:name,leaf:typeof args[0]==='string'?path.basename(args[0]):undefined,error:safeError(error)});throw error;}};",
 anchor].join('\n'));
fs.writeFileSync(path.join(__dirname,'product-matrix-02.cjs'),driver,{flag:'wx'});
let script=fs.readFileSync(path.join(__dirname,'run-product-matrix-01.ps1'),'utf8').replaceAll('product-matrix-01.cjs','product-matrix-02.cjs');
fs.writeFileSync(path.join(__dirname,'run-product-matrix-02.ps1'),script,{flag:'wx'});
const files=['product-matrix-02.cjs','run-product-matrix-02.ps1'].map(name=>{const b=fs.readFileSync(path.join(__dirname,name));return {path:name,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
fs.writeFileSync(path.join(__dirname,'native-product-diagnostic-freeze-02.json'),JSON.stringify({status:'FROZEN_BEFORE_EXECUTION',expected:18,files,reason:'Matrix01 owner setup returned UNAVAILABLE before any modal/native/provider route. Observe only safe method-stage metadata; do not change product checks or authorization.'},null,2)+'\n',{flag:'wx'});
console.log('PREPARED_VALUE_FREE_OWNER_STAGE_DIAGNOSTIC');
