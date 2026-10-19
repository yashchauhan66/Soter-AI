'use strict';
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const save=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'});
let guard=read('product-test-guards-03.cjs').replace("row.hookCancel=reply.cancel;", "row.hookCancel=reply.cancel;row.resultKind=typeof reply.errorMessage==='string'?(reply.errorMessage.startsWith('Managed route unavailable')?'POWERSHELL_HELPER_FAILURE':reply.errorMessage.startsWith('Native operation withheld')?'CLASSIFICATION_WITHHELD':'OTHER'):'NO_ERROR';");
save('product-test-guards-04.cjs',guard);
let probe=read('product-probe-05.cjs').replaceAll('product-test-guards-03.cjs','product-test-guards-04.cjs');
probe=probe.replace("   const hook=fs.readFileSync", `   records.directHook=await new Promise(resolve=>{
    const child=cp.spawn(process.execPath,[path.join(context.extensionUri.fsPath,'dist/soterai-mcp-server.js'),'--cline-hook'],{cwd:workspace,windowsHide:true,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,USERPROFILE:process.env.USERPROFILE,APPDATA:process.env.APPDATA,LOCALAPPDATA:process.env.LOCALAPPDATA,TEMP:process.env.TEMP,TMP:process.env.TMP,ELECTRON_RUN_AS_NODE:'1',SOTERAI_SAFE_READ_TICKET_PATH:path.join(context.globalStorageUri.fsPath,'adapter-sessions/cline-session.ticket'),SOTERAI_CLINE_WORKSPACE:workspace},stdio:['pipe','pipe','pipe']});
    let chunks=[],size=0,errBytes=0;const timer=setTimeout(()=>resolve({status:'INCOMPLETE_TIMEOUT'}),10000);timer.unref();child.stdout.on('data',chunk=>{size+=chunk.length;if(size<8192)chunks.push(Buffer.from(chunk));});child.stderr.on('data',chunk=>{errBytes+=chunk.length;});child.once('error',()=>{clearTimeout(timer);resolve({status:'LAUNCH_FAILED'});});child.once('close',code=>{clearTimeout(timer);try{const reply=JSON.parse(Buffer.concat(chunks).toString('utf8'));resolve({status:reply.cancel===false?'READY':'WITHHELD',code,errBytes,bytes:size});}catch{resolve({status:'INVALID_REPLY',code,errBytes,bytes:size});}});child.stdin.end(JSON.stringify({taskStart:{userInput:'Synthetic readiness fixture'}}));
   });
   const hook=fs.readFileSync`);
probe=probe.replace("records.controllerStages.length<128", "records.controllerStages.length<256");
probe=probe.replace("  approvalTimer=setInterval", "  await new Promise(done=>setTimeout(done,3000));\n  approvalTimer=setInterval");
save('product-probe-06.cjs',probe);
save('run-product-probe-07.ps1',read('run-product-probe-06.ps1').replaceAll('product-probe-05.cjs','product-probe-06.cjs').replaceAll('product-test-guards-03.cjs','product-test-guards-04.cjs').replace('tokenShape,tokenFailure,withdrawals','tokenShape,tokenFailure,directHook,withdrawals'));
