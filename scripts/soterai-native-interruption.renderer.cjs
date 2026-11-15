'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{spawnSync}=require('node:child_process'),{chromium}=require('playwright');
const delay=ms=>new Promise(r=>setTimeout(r,ms)),demand=v=>{if(!v)throw Error('INTERRUPTION_UI');};
async function until(fn,ms=35000){const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await delay(100);}throw Error('UI_TIMEOUT');}
exports.run=async(out,child)=>{
 const p=JSON.parse(await fs.readFile(path.join(out,'prepared.json'),'utf8'));let browser;
 try{
  const port=await until(async()=>{try{const n=Number((await fs.readFile(path.join(p.cohortRoot,'profile/user-data/DevToolsActivePort'),'utf8')).split(/\r?\n/)[0]);return Number.isInteger(n)&&n>=1024&&n<=65535?n:false;}catch(e){if(e.code!=='ENOENT')throw e;}});
  browser=await chromium.connectOverCDP('http://127.0.0.1:'+port,{timeout:15000,noDefaults:true});
  const page=await until(()=>browser.contexts().flatMap(c=>c.pages()).find(pg=>/^vscode-file:\/\/vscode-app\//.test(pg.url())));
  for(let ordinal=1;ordinal<=(p.phase==='crash'?1:p.phase==='recovery'?3:2);ordinal++){
   const request=await until(async()=>{try{return JSON.parse(await fs.readFile(path.join(out,`ui-request-${ordinal}.json`),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}});demand(request.runNonce===p.runNonce&&request.ordinal===ordinal);
   if(request.stage==='metadata'){
    await until(async()=>{for(const frame of page.frames()){try{if(await frame.getByText('2 stored values for this project. Encrypted recovery is outside the project.',{exact:true}).isVisible())return true;}catch{}}});
   }else{
    const label={migrate:'Migrate securely','cancel-recovery':'Cancel',recover:'Complete safe recovery',restore:'Restore raw values'}[request.stage];demand(label);
    const dialog=page.locator('.monaco-dialog-box:visible'),button=dialog.getByRole('button',{name:label,exact:true});await button.waitFor({state:'visible',timeout:25000});await page.bringToFront();await button.click();
   }
   await fs.writeFile(path.join(out,`ui-step-${ordinal}.json`),JSON.stringify({runNonce:p.runNonce,status:'PASS',stage:request.stage,ordinal,realUiInteraction:true}),{flag:'wx'});
  }
  if(p.phase==='crash'){
   const barrier=await until(async()=>{try{return JSON.parse(await fs.readFile(path.join(out,'barrier.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}});
   demand(barrier.runNonce===p.runNonce&&barrier.artifactSha256===p.artifactSha256&&Number.isInteger(barrier.extensionHostPid)&&Number.isInteger(child.pid)&&child.exitCode===null&&child.signalCode===null);
   const ps=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-Command','Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress'],{encoding:'utf8',windowsHide:true,timeout:10000});demand(ps.status===0);
   const parents=new Map(JSON.parse(ps.stdout).map(p=>[p.ProcessId,p.ParentProcessId]));let current=barrier.extensionHostPid,descendant=false;
   for(let i=0;i<20;i++){if(current===child.pid){descendant=true;break;}current=parents.get(current);if(!current)break;}demand(descendant&&child.exitCode===null);
   const killed=spawnSync('C:\\Windows\\System32\\taskkill.exe',['/PID',String(child.pid),'/T','/F'],{encoding:'utf8',windowsHide:true,timeout:10000});
   await fs.writeFile(path.join(out,'kill-result.json'),JSON.stringify({runNonce:p.runNonce,pid:child.pid,hostDescendantVerified:true,exitCode:killed.status,forced:true}),{flag:'wx'});demand(killed.status===0);
  }else await until(async()=>{try{const report=JSON.parse(await fs.readFile(path.join(out,'host-result.json'),'utf8'));return report.runNonce===p.runNonce;}catch(e){if(e.code!=='ENOENT')throw e;}});
 }finally{try{if(browser)await browser.close();}catch{}}
};
