'use strict';
// Inert on import. Root-owned PowerShell wrapper invokes only this exact Code
// owner after static admission and synthetic preparation. No process signals.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const route=require('./codexcli-route-current-02.cjs');
async function run(launchFile){
 const value=JSON.parse(fs.readFileSync(launchFile,'utf8').replace(/^\uFEFF/,''));
 const {a,current}=await route.admit(value.admissionPath,value.admissionSha256,{fresh:false});
 assert.equal(path.resolve(launchFile),path.join(a.receipts,'codexcli-code-launch-02.json'));
 assert.equal(value.executable,current.vendor.currentHost.executable.path);assert.equal(value.run,a.receipts);
 assert.equal(value.cwd,path.join(a.runRoot,'workspace'));assert.equal(value.profile,path.join(a.runRoot,'profile'));assert.equal(value.deadlineMs,300000);
 const expectedArgs=['--new-window','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes','--disable-workspace-trust','--user-data-dir='+value.profile,'--extensions-dir='+path.join(a.runRoot,'extensions'),'--extensionDevelopmentPath='+path.join(a.runRoot,'extension'),'--disable-extension=vscode.json-language-features','--disable-extension=vscode.configuration-editing','--disable-extension=vscode.github','--disable-extension=vscode.git','--disable-extension=vscode.github-authentication','--disable-extension=vscode.microsoft-authentication','--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm',value.cwd];
 assert.deepEqual(value.args,expectedArgs);
 const allowed=new Set(['SystemRoot','WINDIR','COMSPEC','USERPROFILE','HOME','APPDATA','LOCALAPPDATA','TEMP','TMP','PATH','GIT_CONFIG_NOSYSTEM','GIT_CONFIG_GLOBAL','GIT_TERMINAL_PROMPT','GCM_INTERACTIVE','SOTERAI_F20A_PRODUCT_ROOT','SOTERAI_F20A_PRODUCT_RESULT']);
 assert(Object.keys(value.env).every(k=>allowed.has(k)));assert.equal(value.env.USERPROFILE,value.profile);assert.equal(value.env.HOME,value.profile);
 assert.equal(value.env.APPDATA,path.join(a.runRoot,'public-vendor'));assert.equal(value.env.SOTERAI_F20A_PRODUCT_ROOT,a.runRoot);assert.equal(value.env.SOTERAI_F20A_PRODUCT_RESULT,path.join(a.runRoot,'product-result.json'));
 for(const k of ['LOCALAPPDATA','TEMP','TMP','GIT_CONFIG_GLOBAL'])assert(value.env[k].toLowerCase().startsWith(a.runRoot.toLowerCase()+path.sep));
 const graph=JSON.parse(fs.readFileSync(a.publicGraph.path,'utf8'));
 for(const row of graph.files)route.pin({...row,path:path.join(a.runRoot,'public-vendor/npm/node_modules/@openai/codex',row.relative)});
 const helper=path.resolve(__dirname,'../../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');assert.equal(route.fact(helper).sha256,'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
 const observed=await require(helper).phase({executable:value.executable,args:value.args,cwd:value.cwd,env:value.env,run:value.run,name:'codexcli-code',profile:value.profile,deadlineMs:value.deadlineMs});
 route.verifyClose(observed.close);
}
if(require.main===module){if(process.argv.length===3)run(process.argv[2]).catch(e=>{console.error(JSON.stringify({status:'INCOMPLETE_NO_RETRY',errorName:e.name,signalsRequested:0}));process.exitCode=1});else process.exitCode=1;}
module.exports={run};
