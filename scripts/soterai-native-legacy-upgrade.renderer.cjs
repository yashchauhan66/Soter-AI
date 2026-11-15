'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=25000){const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await delay(100);}throw Error('UPGRADE_UI_TIMEOUT');}
exports.run=async(out,child)=>{
 const p=JSON.parse(await fs.readFile(path.join(out,'prepared.json'),'utf8'));let browser;
 try{
  const port=await until(async()=>{try{const lines=(await fs.readFile(path.join(p.cohortRoot,'profile/user-data/DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);const n=Number(lines[0]);if(Number.isInteger(n)&&n>=1024&&n<=65535)return n;}catch(e){if(e.code!=='ENOENT')throw e;}});
  browser=await chromium.connectOverCDP('http://127.0.0.1:'+port,{timeout:15000,noDefaults:true});
  const page=await until(()=>browser.contexts().flatMap(c=>c.pages()).find(pg=>/^vscode-file:\/\/vscode-app\//.test(pg.url())));
  for(let ordinal=1;ordinal<=(p.mode==='legacy'?1:4);ordinal++){
   const request=await until(async()=>{try{return JSON.parse(await fs.readFile(path.join(out,`ui-request-${ordinal}.json`),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}});
   if(request.runNonce!==p.runNonce)throw Error('UI_SCOPE');let names;
   if(request.stage.startsWith('metadata-')){
    const frame=await until(async()=>{for(const f of page.frames()){try{if(await f.getByRole('heading',{name:'Protected Vault',exact:true}).isVisible())return f;}catch{}}});
    await until(()=>frame.getByText(request.expectedCount+' stored values for this project. Encrypted recovery is outside the project.',{exact:true}).isVisible());
    names=await frame.locator('table tr').evaluateAll(rows=>rows.slice(1).map(row=>row.cells[0]?.textContent?.trim()));
    if(names.length!==request.expectedCount||names.some(n=>typeof n!=='string'||!/^[A-Za-z0-9_]{1,128}$/.test(n)))throw Error('METADATA');
   }else{
    const labels={'migrate-legacy':'Migrate & Backup','migrate-new':'Migrate securely','restore-new':'Restore raw values'};
    const label=labels[request.stage];if(!label)throw Error('UI_STAGE');
    const button=page.getByRole('button',{name:label,exact:true});await button.waitFor({state:'visible',timeout:25000});await page.bringToFront();await button.click();
   }
   await fs.writeFile(path.join(out,`ui-step-${ordinal}.json`),JSON.stringify({schemaVersion:1,runNonce:p.runNonce,status:'PASS',ordinal,stage:request.stage,names,realUiInteraction:true}),{flag:'wx'});
  }
 }finally{if(browser)await browser.close();}
};
