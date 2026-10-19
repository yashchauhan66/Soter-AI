'use strict';
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const save=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'});
let probe=read('product-probe-02.cjs');
probe=probe.replace("records.brokerStages=[];", `records.brokerStages=[];const tokenMethod=manager.getClientToken;manager.getClientToken=async function(){try{const value=await Reflect.apply(tokenMethod,this,[]);records.tokenShape={type:typeof value,length:value?.length,whitespace:typeof value==='string'&&/[\\x00-\\x20\\x7f]/.test(value)};return value;}catch(error){records.tokenFailure={error:safeError(error),state:this.ownedSnapshot().state};throw error;}};`);
probe=probe.replace("['artifact','eligible','read','write','configuredFiles']", "['artifact','eligible','read','write','configuredFiles','dependencies']");
probe=probe.replace("running:result?.running", "running:result?.running,urlShape:result?.url?new URL(result.url).pathname:undefined");
probe=probe.replace("  const files=()=>", `  if(adapter){const original=adapter.withdraw;adapter.withdraw=function(...args){records.withdrawals??=[];records.withdrawals.push({state:manager.ownedSnapshot().state,stack:new Error().stack.split('\\n').slice(2,5).map(line=>line.replace(/.*[\\\\/]/,'').replace(/:[0-9]+:[0-9]+\\)?$/,''))});return Reflect.apply(original,this,args);};}
  const files=()=>`);
save('product-probe-03.cjs',probe);
let launch=read('run-product-probe-02.ps1').replaceAll('product-probe-02.cjs','product-probe-03.cjs').replace('brokerStages,controllerStages,driverFailure,childShutdown','brokerStages,controllerStages,tokenShape,tokenFailure,withdrawals,driverFailure,childShutdown');
save('run-product-probe-03.ps1',launch);
