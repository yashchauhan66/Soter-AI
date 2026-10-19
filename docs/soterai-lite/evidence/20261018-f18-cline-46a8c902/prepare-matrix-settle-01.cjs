'use strict';
const fs=require('node:fs'),path=require('node:path');
function derive(from,to,pairs){let s=fs.readFileSync(path.join(__dirname,from),'utf8');for(const[a,b]of pairs){if(!s.includes(a))throw Error('Missing fixture anchor');s=s.split(a).join(b);}fs.writeFileSync(path.join(__dirname,to),s,{flag:'wx'});}
derive('product-matrix-03.cjs','product-matrix-04.cjs',[
 ["if(records.providerFailure||records.requests.some(item=>item.privateOriginal))throw Error('Canary reached collector');","if(records.providerFailure||records.requests.some(item=>item.privateOriginal))throw Error('Canary reached collector');await until(()=>guard.children.some(item=>item.phase==='native-private'&&item.role==='PreToolUse'&&item.hookCancel===true&&item.closed));await new Promise(done=>setTimeout(done,750));"],
 ["records.phase=scenario=name;stageRequests=0;await api.startNewTask(prompt,images);","await new Promise(done=>setTimeout(done,500));records.phase=scenario=name;stageRequests=0;records.taskStarts??=[];const row={phase:name,called:true};records.taskStarts.push(row);try{await api.startNewTask(prompt,images);row.returned=true;}catch(error){row.error=safeError(error);throw error;}"],
 ["checks.push({id,status:'FAIL',error:safeError(error)})","checks.push({id,status:'FAIL',error:safeError(error),fixtureDeadline:error?.message==='Native fixture deadline'})"]
]);
derive('run-product-matrix-04.ps1','run-product-matrix-05.ps1',[['product-matrix-03.cjs','product-matrix-04.cjs']]);
derive('run-final-native-02.ps1','run-final-native-03.ps1',[['product-matrix-launch-03','product-matrix-launch-04'],['run-product-matrix-04.ps1','run-product-matrix-05.ps1']]);
