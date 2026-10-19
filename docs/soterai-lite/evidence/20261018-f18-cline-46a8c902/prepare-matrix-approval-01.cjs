'use strict';
const fs=require('node:fs'),path=require('node:path');
let s=fs.readFileSync(path.join(__dirname,'product-matrix-04.cjs'),'utf8');
const old="approvalTimer=setInterval(()=>{if((scenario==='mcp-public'";
if(!s.includes(old))throw Error('Missing approval guard anchor');
s=s.replace(old,"approvalTimer=setInterval(()=>{if(stageRequests>=1&&guard.children.some(item=>item.phase===scenario&&item.role==='TaskStart'&&item.closed)&&((scenario==='mcp-public'");
s=s.replace("||(scenario==='editor-public'&&stageRequests<2))void api?.pressPrimaryButton().catch(()=>undefined);","||(scenario==='editor-public'&&stageRequests<2))){records.scriptedApprovals??=[];records.scriptedApprovals.push({phase:scenario,providerRequests:stageRequests,taskStarted:true});void api?.pressPrimaryButton().catch(()=>undefined);}");
fs.writeFileSync(path.join(__dirname,'product-matrix-05.cjs'),s,{flag:'wx'});
s=fs.readFileSync(path.join(__dirname,'run-product-matrix-05.ps1'),'utf8').replaceAll('product-matrix-04.cjs','product-matrix-05.cjs');fs.writeFileSync(path.join(__dirname,'run-product-matrix-06.ps1'),s,{flag:'wx'});
