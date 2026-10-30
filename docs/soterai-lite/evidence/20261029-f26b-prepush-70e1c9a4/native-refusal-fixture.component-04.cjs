'use strict';
// Real fixture functions and real owner-service refusal path. Explicit HTTP/process/
// checked-ref/scan/signing seams; no native process, socket, profile or Git push.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),ts=require('typescript'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
const repo=path.resolve(__dirname,'../../../..'),input=process.env.SOTERAI_F26B_REFUSAL_SOURCE||'native-prepush-05.host.ts.txt';assert(['native-prepush-05.host.ts.txt','native-prepush-06.host.ts.txt'].includes(input));
const source=fs.readFileSync(path.join(__dirname,input),'utf8'),tree=ts.createSourceFile(input+'.ts',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS),functions=[];
for(const statement of tree.statements)if(ts.isFunctionDeclaration(statement)&&['componentHook','observeRequest'].includes(statement.name?.text))functions.push(statement.getText(tree));assert.equal(functions.length,2);
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const fixture=transpile(functions.join('\n')+'\n({componentHook,observeRequest});'),serviceCode=transpile(fs.readFileSync(path.join(repo,'packages/vscode-extension/src/history-hooks/PrePushOwnerService.ts'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function execute(outcome='UNAVAILABLE',options={}){
 const raw=Buffer.from('refs/heads/main '+'1'.repeat(40)+' refs/heads/main '+'0'.repeat(40)+'\n'),wires=[],generation=crypto.randomUUID(),root='C:\\synthetic-f26b-only',identity='a'.repeat(64);
 let serviceSession,handler,driver,finishChild,body,statusCode,headers,signCalls=0;const actuals={};
 class Response extends EventEmitter{
  constructor(){super();this.destroyed=false;this.writableEnded=false;this.writableFinished=false;this.statusCode=200;this.headers={};}
  writeHead(code,values){this.statusCode=options.status??code;this.headers=Object.fromEntries(Object.entries({...values,...options.headers}).map(([k,v])=>[k.toLowerCase(),v]));return this;}
  getHeader(name){return this.headers[name.toLowerCase()];}
  end(value){body=Buffer.from(value);statusCode=this.statusCode;headers=this.headers;this.writableEnded=true;this.writableFinished=true;this.emit('finish');this.emit('close');finishChild({receipt:{code:outcome==='ALLOW'?0:1,closed:true,stdoutEOF:true,stderrEOF:true},stdout:options.stdout??Buffer.alloc(0),stderr:Buffer.alloc(0)});return this;}
 }
 const server=new EventEmitter();server.listening=false;server.listen=(_port,_host,callback)=>{server.listening=true;queueMicrotask(callback);};server.address=()=>({address:'127.0.0.1',port:31337});server.close=callback=>{server.listening=false;callback();};
 const refs={root,available:()=>true,transcriptSha256:sha(raw),rootIdentity:identity};
 const exports={};const requireSeam=name=>{
  if(name==='node:crypto')return crypto;
  if(name==='node:http')return{createServer:(_settings,callback)=>{handler=callback;return server;}};
  if(name==='./CheckedPushRefs')return{isCheckedPushRefs:v=>v===refs,prepareCheckedPushRefs:async()=>refs};
  if(name==='./PrePushScan')return{PrePushScan:class{constructor(){throw Error('Only explicit scan seam allowed');}}};
  if(name==='./PrePushWire')return{parseHookRequest:bytes=>JSON.parse(bytes.toString()),signHookDescriptor:payload=>{serviceSession=payload.session;return Buffer.from('{}');},signHookDecision:payload=>{signCalls++;return Buffer.from(JSON.stringify(options.badTranscript?{...payload,transcriptSha256:'b'.repeat(64)}:payload));}};
  throw Error('Unexpected service dependency');
 };
 vm.runInNewContext(serviceCode,{exports,require:requireSeam,Buffer,performance,setTimeout,clearTimeout},{timeout:1000});
 const privateKey=crypto.generateKeyPairSync('ed25519').privateKey;
 const owner=new exports.PrePushOwnerService({root,generation,workerSha256:'c'.repeat(64),runtimeSha256:'d'.repeat(64),valid:()=>true,loadKey:async()=>privateKey,prepareRefs:async()=>refs,createScan:()=>({start:async()=>({status:outcome}),closed:Promise.resolve(),busy:false,withdraw(){},canRelease:()=>true})});
 const spawn=()=>{const child={stdin:new EventEmitter(),done:new Promise(resolve=>{finishChild=resolve;})};child.stdin.end=()=>{const request={version:1,generation,session:serviceSession,nonce:crypto.randomUUID(),transcript:raw.toString('base64url')};const bytes=Buffer.from(JSON.stringify(request));const req=new EventEmitter();Object.assign(req,{method:'POST',url:'/pre-push',httpVersion:'1.1',socket:{remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:31337','content-type':'application/json','content-length':String(bytes.length)},resume(){}});req.rawHeaders=Object.entries(req.headers).flat();const res=new Response();driver.observeRequest(req,res);const observedEnd=res.end;res.end=function(value,...rest){return Reflect.apply(observedEnd,this,[options.body??value,...rest]);};handler(req,res);queueMicrotask(()=>{req.emit('data',bytes);req.emit('end');req.emit('close');});};return child;};
 const scope={assert,Buffer,sha,caseId:'F26B-HP12',wires,currentPin:{generation},root,SH:'synthetic-sh',SH_SHA256:'f'.repeat(64),SOURCE:'synthetic.txt',ownerEnvironment:{},ORIGINAL_ENV:'synthetic',halted:false,join:path.join,hook:()=> 'synthetic-hook',configFile:()=> 'synthetic-config',fileHash(){},markerCount:async()=>0,fact:async()=>({present:true,bytes:1,sha256:'e'.repeat(64),mode:0}),nativeSpawn:spawn,observe:child=>child.done,closed:r=>assert(r.closed&&r.stdoutEOF&&r.stderrEOF),rootIdentity:()=>identity,safeMetadata(){},envelope:bytes=>{if(options.badSignature)throw Error('Synthetic invalid signature');return JSON.parse(bytes.toString());},until:async(predicate,message)=>{for(let n=0;n<30;n++){if(await predicate())return;await new Promise(resolve=>setImmediate(resolve));}throw Error(message);}};
 const assertionFailures=[];scope.assert=new Proxy(assert,{get(target,name){const value=Reflect.get(target,name);return typeof value==='function'?function(...args){try{return Reflect.apply(value,target,args);}catch(error){assertionFailures.push({method:String(name),message:String(error.message).slice(0,400)});throw error;}}:value;}});
 driver=vm.runInNewContext(fixture,scope,{timeout:1000});
 try{assert(await owner.start());await driver.componentHook(raw,outcome==='ALLOW'?0:1,outcome);Object.assign(actuals,{statusCode,body:Buffer.from(body).toString(),headers,signCalls,wire:wires[0]});if(outcome==='UNAVAILABLE'){assert.equal(statusCode,503);assert.equal(actuals.body,'UNAVAILABLE');assert.equal(signCalls,0);assert.equal(wires[0].signatureValid,false);assert.equal(wires[0].transcriptMatched,false);}return actuals;}
 catch(error){if(Object.keys(options).length===0)console.error(JSON.stringify({componentDiagnostics:true,outcome,statusCode,signCalls,responseBytes:body?.length,headers,wire:wires[0],assertionFailures}));throw error;}
 finally{await owner.close();}
}
test('real owner capped/unsupported scan uses exact unsigned HTTP503 refusal accepted by fixture',()=>execute());
test('signed ALLOW fixture route remains required',()=>execute('ALLOW'));
test('signed BLOCK fixture route remains required',()=>execute('BLOCK'));
test('refusal with HTTP200 is rejected',()=>assert.rejects(execute('UNAVAILABLE',{status:200})));
test('refusal with wrong body is rejected',()=>assert.rejects(execute('UNAVAILABLE',{body:Buffer.from('ALLOW')})));
test('refusal with wrong content type is rejected',()=>assert.rejects(execute('UNAVAILABLE',{headers:{'Content-Type':'application/json'}})));
test('refusal with wrong content length is rejected',()=>assert.rejects(execute('UNAVAILABLE',{headers:{'Content-Length':'12'}})));
test('refusal with keep-alive is rejected',()=>assert.rejects(execute('UNAVAILABLE',{headers:{Connection:'keep-alive'}})));
test('refusal with cache permission is rejected',()=>assert.rejects(execute('UNAVAILABLE',{headers:{'Cache-Control':'public'}})));
test('ALLOW with invalid signature is rejected',()=>assert.rejects(execute('ALLOW',{badSignature:true})));
test('ALLOW with mismatched transcript is rejected',()=>assert.rejects(execute('ALLOW',{badTranscript:true})));
test('refusal with stdout output is rejected',()=>assert.rejects(execute('UNAVAILABLE',{stdout:Buffer.from('unexpected')})));
