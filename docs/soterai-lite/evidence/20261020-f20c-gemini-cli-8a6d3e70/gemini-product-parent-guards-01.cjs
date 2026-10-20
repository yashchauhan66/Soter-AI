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
  if(typeof fs[key]!=='function')continue;const original=fs[key],wrapped=function(file,...args){if(!allowedFile(file,key,args)){records.deniedFileAccess.push(key);throw Object.assign(Error('F20C fixture file access outside allowed synthetic/public roots'),{code:'EACCES'});}return Reflect.apply(original,this,[file,...args]);};Object.assign(wrapped,original);patch(fs,key,wrapped);
 }
 for(const key of ['readFile','readdir','stat','lstat','access','realpath','open','writeFile','appendFile','mkdir','unlink','rm']){
  const original=fs.promises[key];if(typeof original!=='function')continue;patch(fs.promises,key,async function(file,...args){if(!allowedFile(file,key,args)){records.deniedFileAccess.push('promise-'+key);throw Object.assign(Error('F20C fixture file access outside allowed synthetic/public roots'),{code:'EACCES'});}return Reflect.apply(original,this,[file,...args]);});
 }
 const loopback=host=>['127.0.0.1','localhost','::1','[::1]'].includes(host);
 const refuse=kind=>{records.deniedExternal.push(kind);throw Error('F20C test harness denied nonloopback traffic');};
 const urlOf=args=>{const first=args[0];try{if(typeof first==='string'||first instanceof URL)return new URL(first);if(first&&typeof first==='object')return {hostname:first.hostname||first.host||'localhost'};}catch{}return {hostname:'invalid'};};
 for(const module of [http,https])for(const name of ['request','get']){const original=module[name];patch(module,name,function(...args){if(!loopback(urlOf(args).hostname))return refuse(name);return Reflect.apply(original,this,args);});}
 const originalFetch=globalThis.fetch;patch(globalThis,'fetch',function(input,...args){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!loopback(url.hostname)){records.deniedExternal.push('fetch');return Promise.reject(Error('F20C test harness denied nonloopback fetch'));}return originalFetch(input,...args);});
 const originalConnect=net.Socket.prototype.connect;patch(net.Socket.prototype,'connect',function(...args){let value=args[0];if(Array.isArray(value))value=value[0];if(value&&typeof value==='object'&&value.path)return Reflect.apply(originalConnect,this,args);const host=typeof value==='object'?value.host:(typeof args[1]==='string'?args[1]:'localhost');if(!loopback(host||'localhost'))return refuse('net-connect');return Reflect.apply(originalConnect,this,args);});
 const originalTls=tls.connect;patch(tls,'connect',function(...args){if(!loopback(urlOf(args).hostname))return refuse('tls-connect');return Reflect.apply(originalTls,this,args);});
 patch(cp.ChildProcess.prototype,'kill',function(){records.deniedSignals.push('CHILD_SIGNAL_REFUSED');throw Error('F20C test forbids process signals');});
 patch(process,'kill',function(){records.deniedSignals.push(arguments[1]===0?'ZERO_SIGNAL_LIVENESS_REFUSED':'PROCESS_SIGNAL_REFUSED');throw Error('F20C test forbids process signals');});
 let spawnPermit=0,privateCanary;records.deniedDirectSpawns=[];
 const spawnPrimitive=cp.ChildProcess.prototype.spawn;patch(cp.ChildProcess.prototype,'spawn',function(...args){if(!spawnPermit){records.deniedDirectSpawns.push('DIRECT_NATIVE_SPAWN_REFUSED');throw Object.assign(Error('Direct native spawn refused'),{code:'EACCES'});}return Reflect.apply(spawnPrimitive,this,args);});
 const originalSpawn=cp.spawn;patch(cp,'spawn',function(...args){const executable=String(args[0]),argv=Array.isArray(args[1])?args[1]:[],options=args[2]||{},base=path.basename(executable).toLowerCase();
 const inside=value=>typeof value==='string'&&path.resolve(value).toLowerCase().startsWith(path.resolve(root).toLowerCase()+path.sep);
 const cwd=options.cwd||process.cwd();let allowed=false;
 if(path.resolve(executable).toLowerCase()===path.resolve(process.execPath).toLowerCase()&&typeof argv[0]==='string'&&['local-ai-broker.js','soterai-mcp-server.js'].some(name=>path.resolve(argv[0]).toLowerCase()===path.resolve(root,'extension/dist',name).toLowerCase())&&(argv.length===1||argv.length===2&&argv[1]==='--cline-hook')&&!options.shell)allowed=true;
 if(['powershell.exe','powershell','pwsh.exe','pwsh'].includes(base)){
  const approvedHashes=new Set(["1f6478fbc3c88c221a8df7dcfef1ea147e8ab6caa69e0c60bf3a59f80387e0ac","0ce4bf30707d724e5f0f96b1050ea09a38a2aa4c2974d3fa12626cbb93e70e04"]),last=argv.at(-1),prefix=argv.slice(0,-2);
  const version=last==='$PSVersionTable.PSVersion'&&argv.at(-2)==='-Command'&&argv.length<=6&&prefix.every(value=>['-NoLogo','-NoProfile','-NonInteractive'].includes(value));
  const dpapi=argv.length===5&&argv.slice(0,4).join('|')==='-NoLogo|-NoProfile|-NonInteractive|-Command'&&approvedHashes.has(require('node:crypto').createHash('sha256').update(String(last)).digest('hex'))&&path.resolve(executable).toLowerCase()===path.resolve(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe').toLowerCase();
  const hook=typeof last==='string'&&['TaskStart.ps1','PreToolUse.ps1'].some(name=>path.resolve(last).toLowerCase()===path.resolve(root,'workspace/.clinerules/hooks',name).toLowerCase())&&argv.at(-2)==='-File'&&argv.length<=9&&prefix.every(value=>['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass'].includes(value));
  allowed=!options.shell&&(version||dpapi||hook);
 }
 const expectedNode=path.resolve('C:/Program Files/nodejs/node.exe'),expectedGuard=path.resolve(root,'extension/dist-test/host/gemini-product-child-guards-01.cjs'),expectedEntry=path.resolve(root,'public-vendor/npm/node_modules/@google/gemini-cli/bundle/gemini.js');
 if(path.resolve(executable).toLowerCase()===expectedNode.toLowerCase()&&!options.shell&&path.resolve(cwd).toLowerCase()===path.resolve(root,'workspace').toLowerCase()
  &&options.env&&options.env.SOTERAI_FIXTURE_ROOT===root&&inside(options.env.GEMINI_CLI_HOME||'')&&/^gemini-cli-[a-f0-9-]{36}$/.test(path.basename(options.env.GEMINI_CLI_HOME||''))
  &&argv.length===9&&argv[0]==='--require'&&path.resolve(argv[1]).toLowerCase()===expectedGuard.toLowerCase()&&path.resolve(argv[2]).toLowerCase()===expectedEntry.toLowerCase()
  &&argv.slice(3,8).join('|')==='--model|gemini-3.5-flash|--output-format|json|--prompt'&&typeof argv[8]==='string'&&Buffer.byteLength(argv[8])<=4096)allowed=true;
if(!allowed){records.deniedChildLaunches.push({executable:base,argc:argv.length,cwdSynthetic:inside(cwd)});throw Object.assign(Error('F20C fixture child launch not in reviewed local allowlist'),{code:'EACCES'});}
 let child;spawnPermit++;try{child=Reflect.apply(originalSpawn,this,args);}finally{spawnPermit--;}const row={phase:records.phase,role:argv.some(value=>typeof value==='string'&&value.endsWith('TaskStart.ps1'))?'TaskStart':argv.some(value=>typeof value==='string'&&value.endsWith('PreToolUse.ps1'))?'PreToolUse':argv.some(value=>typeof value==='string'&&value.endsWith('local-ai-broker.js'))?'broker':argv.some(value=>typeof value==='string'&&value.endsWith('soterai-mcp-server.js'))?'mcp':base==='node.exe'?'gemini-cli':'ticket',closed:false,stdoutEOF:!child.stdout,stderrEOF:!child.stderr};children.push(row);if(['TaskStart','PreToolUse'].includes(row.role)){let input='',size=0;const observe=value=>{if(typeof value==='string'||Buffer.isBuffer(value)){size+=Buffer.byteLength(value);if(size<=8192){input+=value.toString();if(privateCanary&&input.includes(privateCanary))row.privateInputSeen=true;}}};for(const method of ['write','end']){const original=child.stdin[method];child.stdin[method]=function(value,...args){observe(value);return Reflect.apply(original,this,[value,...args]);};}}if(row.role==='mcp'){let opening='';child.stdout?.on('data',chunk=>{if(!row.toolsListed&&opening.length<16384){opening+=chunk.toString('utf8');if(opening.includes('\"name\":\"soterai_read_project_file_safely\"')){row.toolsListed=true;opening='';}}});}if(['TaskStart','PreToolUse'].includes(row.role)){let size=0,chunks=[];child.stdout?.on('data',chunk=>{size+=chunk.length;if(size<=8192)chunks.push(Buffer.from(chunk));});child.stdout?.on('end',()=>{try{const reply=JSON.parse(Buffer.concat(chunks).toString('utf8'));row.hookCancel=reply.cancel;row.resultKind=typeof reply.errorMessage==='string'?(reply.errorMessage.startsWith('Managed route unavailable')?'POWERSHELL_HELPER_FAILURE':reply.errorMessage.startsWith('Native operation withheld')?'CLASSIFICATION_WITHHELD':'OTHER'):'NO_ERROR';row.hookResponseValid=typeof reply.cancel==='boolean';}catch{row.hookResponseValid=false;}});}child.once('close',()=>{row.closed=true;});child.stdout?.once('end',()=>{row.stdoutEOF=true;});child.stderr?.once('end',()=>{row.stderrEOF=true;});return child;});

// Unreviewed alternate launch APIs never bypass the spawn allowlist.
for(const method of ['exec','execFile','execSync','execFileSync','spawnSync','fork']){
 patch(cp,method,function(command,...args){records.deniedChildLaunches.push({method,executable:path.basename(String(command)),argc:Array.isArray(args[0])?args[0].length:0});throw Object.assign(Error('F20C fixture alternate child launch refused'),{code:'EACCES'});});
}
for(const method of ['rename','copyFile','link','symlink']){
 const original=fs.promises[method];patch(fs.promises,method,async function(source,destination,...args){
  if(!syntheticFile(destination)||!(method==='copyFile'?allowedFile(source,'readFile',[]):syntheticFile(source)))throw Object.assign(Error('F20C fixture cross-root file mutation refused'),{code:'EACCES'});
  return Reflect.apply(original,this,[source,destination,...args]);
 });
}
records.deniedWorkerLaunches=[];try{const threads=require('node:worker_threads');patch(threads,'Worker',class{constructor(){records.deniedWorkerLaunches.push('WORKER_REFUSED');throw Error('Unreviewed worker refused');}});}catch{}
return {children,setPrivateCanary:value=>{privateCanary=value;}};
};
