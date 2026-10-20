'use strict';
const fs=require('node:fs'),vscode=require('vscode'),path=require('node:path'),cp=require('node:child_process'),Module=require('node:module'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const safe=e=>({name:e?.name||'Error',code:typeof e?.code==='string'?e.code:undefined});
function deadline(promise,ms=15000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Actual IDE fixture deadline')),ms);})]).finally(()=>clearTimeout(timer));}
async function until(fn){const end=Date.now()+15000;while(Date.now()<end){if(fn())return;await new Promise(done=>setTimeout(done,20));}throw Error('Actual native initialization deadline');}
exports.install=(root,workspace,records)=>{
 const views=[],apis=new WeakSet(),waits=new WeakMap(),rows=new WeakMap(),children=[],load=Module._load,spawn=cp.spawn;
 const vendorRoot=path.resolve(root,'extensions/openai.chatgpt-26.51007.21434-win32-x64').toLowerCase()+path.sep;
 let client,connection,privateValue='';
 records.ideProcesses=[];
 Module._load=function(request,parent,...args){const result=Reflect.apply(load,this,[request,parent,...args]);
  if(request==='vscode'&&parent?.filename&&path.resolve(parent.filename).toLowerCase().startsWith(vendorRoot)&&!apis.has(result)){
   apis.add(result);records.actualVendorApiObserved=true;const register=result.window.registerWebviewViewProvider;
   Object.defineProperty(result.window,'registerWebviewViewProvider',{configurable:true,writable:true,value:function(id,view,...rest){views.push(view);return Reflect.apply(register,this,[id,view,...rest]);}});
  }return result;
 };
 cp.spawn=function(...args){const child=Reflect.apply(spawn,this,args);
  if(path.resolve(String(args[0])).toLowerCase()===path.resolve(vendorRoot,'bin/windows-x86_64/codex.exe').toLowerCase()){
   const row={phase:records.phase,argv:args[1],closed:false,stdoutEOF:false,stderrEOF:false,stdoutBytes:0,stderrBytes:0},out=crypto.createHash('sha256'),err=crypto.createHash('sha256');children.push(child);records.ideProcesses.push(row);rows.set(child,row);
   child.stdout?.on('data',b=>{row.stdoutBytes+=b.length;out.update(b);if(row.stdoutBytes>1048576)row.outputOverflow=true;});
   child.stderr?.on('data',b=>{row.stderrBytes+=b.length;err.update(b);if(row.stderrBytes>1048576)row.outputOverflow=true;if(privateValue&&b.includes(Buffer.from(privateValue)))row.privateStderrSeen=true;});
   child.stdout?.once('end',()=>row.stdoutEOF=true);child.stderr?.once('end',()=>row.stderrEOF=true);
   const traceBase=path.join(root,'native-trace-'+records.ideProcesses.length);for(const [stream,label]of[[child.stdout,'stdout'],[child.stderr,'stderr']]){const file=traceBase+'-'+label+'.txt';fs.writeFileSync(file,'',{flag:'wx'});let size=0;stream?.on('data',b=>{size+=b.length;if(size<=1048576)fs.appendFileSync(file,b);});}
   waits.set(child,new Promise(done=>{const emit=child.emit;child.emit=function(event,...values){if(event==='close'){Object.assign(row,{closed:true,exitCode:values[0],signal:values[1],stdoutEOF:child.stdout?.readableEnded===true,stderrEOF:child.stderr?.readableEnded===true,stdoutSha256:out.digest('hex'),stderrSha256:err.digest('hex')});done();}return Reflect.apply(emit,this,[event,...values]);};}));
  }return child;
 };
 async function acquire(home){
  process.env.CODEX_HOME=home;
  if(!client){const vendor=vscode.extensions.getExtension('openai.chatgpt');assert(vendor);await deadline(vendor.activate());const view=views.find(v=>typeof v.fetchWrapper?.extensionFetchHandler?.createMessageGenerationClient==='function');assert(view,'Actual registered vendor controller required');client=view.fetchWrapper.extensionFetchHandler.createMessageGenerationClient();connection=view.codexMcpConnection;assert(connection);records.actualVendorControllerFound=true;}
  if(!connection.proc||connection.proc.exitCode!==null||connection.proc.stdin.destroyed){const started=connection.startCodexProcess();assert.equal(started.success,true);}
  await until(()=>connection.initialized===true);assert(connection.proc&&rows.has(connection.proc));return connection.proc;
 }
 return {
  async native(name,prompt,home,value,providerUrl,DONE){
   privateValue=value;let child,thread,off;const row={phase:name,complete:false,privateOutputSeen:false};records.native.push(row);
   try{
    child=await acquire(home);
    const finished=new Promise(done=>{off=client.registerInternalNotificationHandler(event=>{
     if(event.method==='item/agentMessage/delta'){const delta=String(event.params?.delta||'');if(delta.includes(DONE))row.complete=true;if(delta.includes(privateValue))row.privateOutputSeen=true;}
     if(event.method==='turn/completed'){row.turnStatus=event.params?.turn?.status;done();}
    });});
    const override=name==='explicit-provider-override'?{modelProvider:'soterai_fixture',config:{'model_providers.soterai_fixture':{name:'Synthetic explicit override',base_url:providerUrl+'/v1',wire_api:'responses',requires_openai_auth:false,supports_websockets:false,request_max_retries:0,stream_max_retries:0,stream_idle_timeout_ms:5000}}}:{};
    const started=await deadline(client.startThread({model:'f20-fixture',cwd:workspace,approvalPolicy:'never',sandbox:'read-only',ephemeral:true,baseInstructions:'Use only the synthetic loopback fixture. Perform only the offered SoterAI safe-read step.',...override}));thread=started.thread.id;
    await deadline(client.startTurn({threadId:thread,input:[{type:'text',text:prompt,text_elements:[]}]}));await deadline(finished,35000);
    if(row.turnStatus!=='completed')row.complete=false;
   }catch(error){row.nativeError=safe(error);row.complete=false;}
   finally{
    if(thread&&client)try{await deadline(client.unsubscribeThread(thread),3000);}catch(error){row.unsubscribeError=safe(error);}off?.();
    child=child??children.findLast(c=>c.exitCode===null);
    if(child){if(!child.stdin.destroyed&&!child.stdin.writableEnded)child.stdin.end();try{await deadline(waits.get(child),12000);}catch{row.retainedWithoutSignal=true;records.nativeRetained=true;}Object.assign(row,rows.get(child));if(rows.get(child)?.privateStderrSeen)row.privateOutputSeen=true;}
   }return row;
  },
  async finish(){for(const child of children){if(child.exitCode===null&&!child.stdin.destroyed&&!child.stdin.writableEnded)child.stdin.end();}await deadline(Promise.all(children.map(child=>waits.get(child))),12000);Module._load=load;}
 };
};
