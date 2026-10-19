'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),https=require('node:https'),cp=require('node:child_process'),net=require('node:net'),tls=require('node:tls');
exports.install=(root,records)=>{records.deniedExternal=[];records.deniedSignals=[];records.deniedChildLaunches=[];
 const restores=[];let server,api,closing=false;const children=[];
 const patch=(object,key,value)=>{const before=object[key];object[key]=value;restores.push(()=>{object[key]=before;});return before;};
 // Test isolation only: refuse access outside the synthetic profile/public
 // runtime trees before vendor activation; never inspect a real config/secret.
 records.deniedFileAccess=[];
 const allowedRoots=[root,path.dirname(process.execPath),process.env.SystemRoot,'C:/Program Files/Git','C:/Program Files/nodejs'].filter(Boolean).map(value=>path.resolve(value).toLowerCase());
 const syntheticFile=value=>{try{if(value instanceof URL)value=require('node:url').fileURLToPath(value);if(Buffer.isBuffer(value))value=value.toString();const file=path.resolve(value).toLowerCase(),base=path.resolve(root).toLowerCase();return file===base||file.startsWith(base+path.sep);}catch{return false;}};
 const allowedFile=(value,key,args)=>{try{if(value instanceof URL)value=require('node:url').fileURLToPath(value);if(Buffer.isBuffer(value))value=value.toString();if(typeof value!=='string')return false;if(syntheticFile(value))return true;const resolved=path.resolve(value).toLowerCase(),owned=path.resolve(root).toLowerCase();if(/^(?:l?stat|realpath|access)(?:Sync)?$/.test(key)&&(owned.startsWith(resolved.endsWith(path.sep)?resolved:resolved+path.sep)))return true;
  if(/^(write|append|mkdir|unlink|rm)/.test(key)||/^open/.test(key)&&args[0]!=='r'&&args[0]!==0)return false;
  const file=path.resolve(value).toLowerCase(),system=path.resolve(process.env.SystemRoot).toLowerCase();if(file.startsWith(system+path.sep)&&/^readFile/.test(key)&&!/[.](?:dll|exe|mui|node|manifest)$/i.test(file))return false;
  return allowedRoots.some(base=>file===base||file.startsWith(base+path.sep));}catch{return false;}};
 for(const key of ['readFile','readFileSync','readdir','readdirSync','stat','statSync','lstat','lstatSync','access','accessSync','realpath','realpathSync','open','openSync','writeFile','writeFileSync','appendFile','appendFileSync','mkdir','mkdirSync','unlink','unlinkSync','rm','rmSync','watch']){
  if(typeof fs[key]!=='function')continue;const original=fs[key],wrapped=function(file,...args){if(!allowedFile(file,key,args)){records.deniedFileAccess.push(key);throw Object.assign(Error('F18 fixture file access outside allowed synthetic/public roots'),{code:'EACCES'});}return Reflect.apply(original,this,[file,...args]);};Object.assign(wrapped,original);patch(fs,key,wrapped);
 }
 for(const key of ['readFile','readdir','stat','lstat','access','realpath','open','writeFile','appendFile','mkdir','unlink','rm']){
  const original=fs.promises[key];if(typeof original!=='function')continue;patch(fs.promises,key,async function(file,...args){if(!allowedFile(file,key,args)){records.deniedFileAccess.push('promise-'+key);throw Object.assign(Error('F18 fixture file access outside allowed synthetic/public roots'),{code:'EACCES'});}return Reflect.apply(original,this,[file,...args]);});
 }
 let sessionCredential;records.gatewayRequests=[];
 const observeRequest=(request,args)=>{const first=args[0],options=typeof first==='object'&&!(first instanceof URL)?first:args[1]||{};let route;try{route=typeof first==='string'||first instanceof URL?new URL(first).pathname:options.path;}catch{}if(typeof route!=='string'||!route.includes('/v1/ai/openai-compatible')||records.gatewayRequests.length>=16)return;
  const headerEntries=options.headers instanceof Headers?[...options.headers]:Object.entries(options.headers||{}),auth=headerEntries.find(([key])=>key.toLowerCase()==='authorization')?.[1];
  const row={path:route,authCurrent:typeof auth==='string'&&auth==='Bearer '+sessionCredential};records.gatewayRequests.push(row);
  let chunks=[],size=0;const collect=value=>{if(typeof value==='string'||Buffer.isBuffer(value)){const bytes=Buffer.from(value);size+=bytes.length;if(size<=131072)chunks.push(bytes);}};
  const write=request.write;request.write=function(value,...args){collect(value);return Reflect.apply(write,this,[value,...args]);};
  const end=request.end;request.end=function(value,...args){collect(value);row.bytes=size;try{const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));row.keys=Object.keys(body);row.messages=Array.isArray(body.messages)?body.messages.length:0;row.tools=Array.isArray(body.tools)?body.tools.map(item=>item.function?.name):[];let strings=0;const visit=value=>{if(typeof value==='string')strings++;else if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')Object.values(value).forEach(visit);};visit(body);row.stringLeaves=strings;if(typeof records.observeTools==='function')records.observeTools(body.tools);}catch{row.shape='UNAVAILABLE';}chunks=[];return Reflect.apply(end,this,[value,...args]);};
  request.once('response',response=>{row.status=response.statusCode;if(response.statusCode>=400){let bytes=0,parts=[];response.on('data',chunk=>{bytes+=chunk.length;if(bytes<4096)parts.push(Buffer.from(chunk));});response.once('end',()=>{try{const code=JSON.parse(Buffer.concat(parts).toString('utf8')).error?.code;if(typeof code==='string'&&/^[a-z_]{1,64}$/.test(code))row.errorCode=code;}catch{}});}});
 };
 const loopback=host=>['127.0.0.1','localhost','::1','[::1]'].includes(host);
 const refuse=kind=>{records.deniedExternal.push(kind);throw Error('F18 test harness denied nonloopback traffic');};
 const urlOf=args=>{const first=args[0];try{if(typeof first==='string'||first instanceof URL)return new URL(first);if(first&&typeof first==='object')return {hostname:first.hostname||first.host||'localhost'};}catch{}return {hostname:'invalid'};};
 for(const module of [http,https])for(const name of ['request','get']){const original=module[name];patch(module,name,function(...args){if(!loopback(urlOf(args).hostname))return refuse(name);const request=Reflect.apply(original,this,args);observeRequest(request,args);return request;});}
 const originalFetch=globalThis.fetch;patch(globalThis,'fetch',function(input,...args){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!loopback(url.hostname)){records.deniedExternal.push('fetch');return Promise.reject(Error('F18 test harness denied nonloopback fetch'));}return originalFetch(input,...args);});
 const originalConnect=net.Socket.prototype.connect;patch(net.Socket.prototype,'connect',function(...args){let value=args[0];if(Array.isArray(value))value=value[0];if(value&&typeof value==='object'&&value.path)return Reflect.apply(originalConnect,this,args);const host=typeof value==='object'?value.host:(typeof args[1]==='string'?args[1]:'localhost');if(!loopback(host||'localhost'))return refuse('net-connect');return Reflect.apply(originalConnect,this,args);});
 const originalTls=tls.connect;patch(tls,'connect',function(...args){if(!loopback(urlOf(args).hostname))return refuse('tls-connect');return Reflect.apply(originalTls,this,args);});
 patch(cp.ChildProcess.prototype,'kill',function(){records.deniedSignals.push('CHILD_SIGNAL_REFUSED');throw Error('F18 test forbids process signals');});
 patch(process,'kill',function(){records.deniedSignals.push(arguments[1]===0?'ZERO_SIGNAL_LIVENESS_REFUSED':'PROCESS_SIGNAL_REFUSED');throw Error('F18 test forbids process signals');});
 const originalSpawn=cp.spawn;patch(cp,'spawn',function(...args){const executable=String(args[0]),argv=Array.isArray(args[1])?args[1]:[],options=args[2]||{},base=path.basename(executable).toLowerCase();
 const inside=value=>typeof value==='string'&&path.resolve(value).toLowerCase().startsWith(path.resolve(root).toLowerCase()+path.sep);
 const cwd=options.cwd||process.cwd();let allowed=false;
 if(path.resolve(executable).toLowerCase()===path.resolve(process.execPath).toLowerCase()&&inside(argv[0])&&/[\\/]dist[\\/](?:local-ai-broker|soterai-mcp-server)[.]js$/.test(argv[0]))allowed=true;
 if(['powershell.exe','powershell','pwsh.exe','pwsh'].includes(base)){
   allowed=argv.includes('$PSVersionTable.PSVersion')||argv.some(value=>typeof value==='string'&&value.includes('SoterAI.Lite.F18.ConnectionTicket.v1')&&value.includes('[Security.Cryptography.ProtectedData]'))
    ||argv.some(value=>inside(value)&&/[\\/]\.clinerules[\\/]hooks[\\/](?:TaskStart|PreToolUse)[.]ps1$/.test(value));
 }
 if(['git.exe','git'].includes(base)&&inside(cwd))allowed=argv.length===1&&argv[0]==='--version'||argv.includes('rev-parse')||argv.includes('--exec-path');
 if(base==='rg.exe'&&executable.toLowerCase().startsWith(path.dirname(process.execPath).toLowerCase()+path.sep)&&inside(cwd))allowed=true;
 if(!allowed){records.deniedChildLaunches.push({executable:base,argc:argv.length,cwdSynthetic:inside(cwd)});throw Object.assign(Error('F18 fixture child launch not in reviewed local allowlist'),{code:'EACCES'});}
 const child=Reflect.apply(originalSpawn,this,args),row={role:argv.some(value=>typeof value==='string'&&value.endsWith('TaskStart.ps1'))?'TaskStart':argv.some(value=>typeof value==='string'&&value.endsWith('PreToolUse.ps1'))?'PreToolUse':argv.some(value=>typeof value==='string'&&value.endsWith('local-ai-broker.js'))?'broker':argv.some(value=>typeof value==='string'&&value.endsWith('soterai-mcp-server.js'))?'mcp':'ticket',closed:false,stdoutEOF:!child.stdout,stderrEOF:!child.stderr};children.push(row);if(row.role==='mcp'){let opening='';child.stdout?.on('data',chunk=>{if(!row.toolsListed&&opening.length<16384){opening+=chunk.toString('utf8');if(opening.includes('\"name\":\"soterai_read_project_file_safely\"')){row.toolsListed=true;opening='';}}});}if(['TaskStart','PreToolUse'].includes(row.role)){let size=0,chunks=[];child.stdout?.on('data',chunk=>{size+=chunk.length;if(size<=8192)chunks.push(Buffer.from(chunk));});child.stdout?.on('end',()=>{try{const reply=JSON.parse(Buffer.concat(chunks).toString('utf8'));row.hookCancel=reply.cancel;row.resultKind=typeof reply.errorMessage==='string'?(reply.errorMessage.startsWith('Managed route unavailable')?'POWERSHELL_HELPER_FAILURE':reply.errorMessage.startsWith('Native operation withheld')?'CLASSIFICATION_WITHHELD':'OTHER'):'NO_ERROR';row.hookResponseValid=typeof reply.cancel==='boolean';}catch{row.hookResponseValid=false;}});}child.once('close',()=>{row.closed=true;});child.stdout?.once('end',()=>{row.stdoutEOF=true;});child.stderr?.once('end',()=>{row.stderrEOF=true;});return child;});

// Unreviewed alternate launch APIs never bypass the spawn allowlist.
for(const method of ['exec','execFile','execSync','execFileSync','spawnSync','fork']){
 patch(cp,method,function(command,...args){records.deniedChildLaunches.push({method,executable:path.basename(String(command)),argc:Array.isArray(args[0])?args[0].length:0});throw Object.assign(Error('F18 fixture alternate child launch refused'),{code:'EACCES'});});
}
for(const method of ['rename','copyFile','link','symlink']){
 const original=fs.promises[method];patch(fs.promises,method,async function(source,destination,...args){
  if(!syntheticFile(destination)||!(method==='copyFile'?allowedFile(source,'readFile',[]):syntheticFile(source)))throw Object.assign(Error('F18 fixture cross-root file mutation refused'),{code:'EACCES'});
  return Reflect.apply(original,this,[source,destination,...args]);
 });
}
return {children,setSessionCredential:value=>{sessionCredential=value;}};
};
