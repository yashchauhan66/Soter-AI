/** Fixed guest program. The planning loop and all file/code tools run in the
 * constrained guest. Only bounded model messages cross its private stdin/stdout.
 * This code is never executed by the host runner. */
export const PROTECTED_AGENT_GUEST = String.raw`
"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(process.argv[1]||'/workspace');
let buffer='',waiting,started=false,turn=0,changed=new Set(),initial=new Map(),requestId=0;
const pending=[];
function send(value){process.stdout.write(JSON.stringify(value)+'\n');}
function fail(){process.stderr.write('Protected guest unavailable.\n');process.exit(2);}
process.stdin.on('data',chunk=>{buffer+=chunk.toString('utf8');if(Buffer.byteLength(buffer)>262144)fail();let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);try{const data=JSON.parse(line);if(waiting){const resolve=waiting;waiting=undefined;resolve(data);}else{if(pending.length>1)fail();pending.push(data);}}catch{fail();}}});
process.stdin.on('end',()=>{if(waiting)fail();});
function receive(){if(pending.length)return Promise.resolve(pending.shift());return new Promise(resolve=>{if(waiting)fail();waiting=resolve;});}
function ordinary(name,create=false){
 if(typeof name!=='string'||name.length>200||name.includes('\\')||name.includes(':')||/[\x00-\x1f]/.test(name)||!name.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!/^\.git$|^\.soterai|^\.aiignore$/i.test(p)))throw Error('PATH_REFUSED');
 const target=path.resolve(root,name);if(!target.startsWith(root+path.sep))throw Error('PATH_REFUSED');
 let current=root;for(const part of name.split('/').slice(0,-1)){current=path.join(current,part);if(!fs.existsSync(current)){if(!create)throw Error('PATH_REFUSED');fs.mkdirSync(current,{mode:0o700});}const st=fs.lstatSync(current);if(!st.isDirectory()||st.isSymbolicLink())throw Error('PATH_REFUSED');}
 if(fs.existsSync(target)){const st=fs.lstatSync(target);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>65536)throw Error('FILE_REFUSED');}
 return target;
}
function ownKeys(o,keys){return o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===keys.slice().sort().join(',');}
async function tool(name,args,operations){
 if(name==='read_file'&&ownKeys(args,['path'])){const file=ordinary(args.path);const bytes=fs.readFileSync(file);if(bytes.length>65536)throw Error('FILE_LIMIT');return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};}
 if(name==='write_file'&&ownKeys(args,['path','text'])){if(typeof args.text!=='string'||Buffer.byteLength(args.text)>65536||args.text.includes('\0')||changed.size>=32&&!changed.has(args.path))throw Error('WRITE_LIMIT');const file=ordinary(args.path,true);fs.writeFileSync(file,args.text,{mode:0o600});changed.add(args.path);return {written:true};}
 if(name==='run_node'&&ownKeys(args,['path'])){const file=ordinary(args.path);if(!/\.(cjs|js|mjs)$/.test(file))throw Error('ENTRY_REFUSED');const r=cp.spawnSync(process.execPath,['--',file],{cwd:root,env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/nonexistent',NODE_OPTIONS:'',NODE_PATH:''},timeout:10000,maxBuffer:65536,encoding:'utf8'});if(r.error)throw Error('APP_UNAVAILABLE');return {exitCode:r.status,stdout:r.stdout,stderr:r.stderr};}
 if(name==='approved_operation'&&ownKeys(args,['operation_id'])&&operations.includes(args.operation_id)){requestId++;send({type:'operation-request',id:requestId,operationId:args.operation_id});const reply=await receive();if(!ownKeys(reply,['type','id','result'])||reply.type!=='operation-response'||reply.id!==requestId)fail();return reply.result;}
 throw Error('TOOL_REFUSED');
}
(async()=>{
 const config=await receive();if(!ownKeys(config,['type','prompt','model','maxTurns','operations'])||config.type!=='start'||typeof config.prompt!=='string'||config.maxTurns!==8||!Array.isArray(config.operations)||config.operations.length>16)fail();started=true;
 const messages=[{role:'system',content:'Work only in the provided sanitized workspace. Use read_file, write_file and run_node for this task. No host credentials or network are available. Do not request secrets. Finish with a concise public summary.'},{role:'user',content:config.prompt}];
 while(turn<config.maxTurns){turn++;requestId++;send({type:'model-request',id:requestId,model:config.model,messages});
  const response=await receive();if(!ownKeys(response,['type','id','message'])||response.type!=='model-response'||response.id!==requestId)fail();const message=response.message;
  if(!message||message.role!=='assistant'||(message.content!==null&&typeof message.content!=='string'))fail();
  if(!message.tool_calls?.length){const output=message.content||'';const files=[];for(const name of changed){const file=ordinary(name);files.push({path:name,text:fs.readFileSync(file,'utf8')});}send({type:'result',turns:turn,output,changedFiles:files});process.exit(0);}
  if(!Array.isArray(message.tool_calls)||message.tool_calls.length>4)fail();messages.push(message);
  for(const call of message.tool_calls){let result;try{if(!call||call.type!=='function'||typeof call.id!=='string'||typeof call.function?.arguments!=='string')throw Error('CALL_REFUSED');result=await tool(call.function.name,JSON.parse(call.function.arguments),config.operations);}catch{result={error:'GUEST_TOOL_REFUSED'};}
   messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result)});
  }
  if(messages.length>24||Buffer.byteLength(JSON.stringify(messages))>100000)fail();
 }
 fail();
})().catch(fail);
`;
