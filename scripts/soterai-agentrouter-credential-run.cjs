'use strict';
// Read a test credential without echo, argv, source files or evidence storage.
const {spawn}=require('node:child_process'),path=require('node:path');
async function main(){
 const [mode,location]=process.argv.slice(2);if(!['auth','native'].includes(mode)||!process.stdin.isTTY)throw Error('SECURE_TTY_REQUIRED');
 process.stdin.setRawMode(true);process.stdin.resume();process.stdout.write('SECURE_TEST_INPUT_READY\n');
 const key=await new Promise((resolve,reject)=>{let input='';const onData=bytes=>{input+=bytes.toString('utf8');if(input.length>512){process.stdin.off('data',onData);reject(Error('INPUT_LIMIT'));}else if(/[\r\n]/.test(input)){process.stdin.off('data',onData);resolve(input.trim());}};process.stdin.on('data',onData);});
 process.stdin.setRawMode(false);process.stdin.pause();if(!/^sk-[A-Za-z0-9_-]{20,200}$/.test(key))throw Error('TEST_KEY_FORMAT');
 console.log(JSON.stringify({credentialReceived:true,matchesExistingEnvironment:key===process.env.AGENTROUTER_API_KEY}));
 if(mode==='auth'){
  const response=await fetch('https://agentrouter.org/v1/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),
   headers:{'content-type':'application/json',authorization:'Bearer '+key},body:JSON.stringify({model:'gpt-5.6-sol',messages:[{role:'user',content:'Reply with exactly OK.'}],stream:false,max_tokens:32})});
  const report={status:response.status,ok:response.ok};const body=await response.text();
  if(body.length<65536){try{const data=JSON.parse(body);if(/^[A-Za-z0-9_.-]{1,80}$/.test(data.error?.code||''))report.providerErrorCode=data.error.code;report.publicReplyObserved=Array.isArray(data.choices)&&data.choices.some(c=>typeof c.message?.content==='string'&&c.message.content.includes('OK'));}catch{}}
  console.log(JSON.stringify(report));if(!response.ok)process.exitCode=2;return;
 }
 const repo=path.resolve(__dirname,'..'),out=path.resolve(repo,location),base=path.join(repo,'docs/soterai-lite/evidence/20261114-release-gates');if(!out.startsWith(base+path.sep))throw Error('PROFILE_SCOPE');
 const child=spawn(process.execPath,[path.join(__dirname,'soterai-installed-acceptance.cjs'),'run',out],{cwd:repo,env:{...process.env,AGENTROUTER_API_KEY:key},windowsHide:true,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>process.stdout.write(b));child.stderr.on('data',()=>{});
 await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>{process.exitCode=code??2;resolve();});});
}
main().catch(error=>{try{if(process.stdin.isTTY)process.stdin.setRawMode(false);}catch{}console.error(JSON.stringify({status:'TEST_UNAVAILABLE',errorClass:error.name}));process.exitCode=2;});
