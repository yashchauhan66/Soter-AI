'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
async function main(){const root=process.env.SOTERAI_FIXTURE_ROOT,file=path.join(root,'fixture-public.txt'),expected='PUBLIC_ONLY_GUARD_FIXTURE';assert.equal(fs.readFileSync(file,'utf8'),expected);assert.equal(await fs.promises.readFile(file,'utf8'),expected);await new Promise((resolve,reject)=>fs.readFile(file,'utf8',(error,value)=>{if(error)return reject(error);try{assert.equal(value,expected);resolve();}catch(e){reject(e);}}));
 const esm=await import('node:fs');assert.equal(esm.readFileSync(file,'utf8'),expected);const promises=await import('node:fs/promises');assert.equal(await promises.readFile(file,'utf8'),expected);
 const outside=path.resolve(root,'../../SOTERAI_FIXTURE_OUTSIDE_NEVER_READ.txt');assert.throws(()=>fs.readFileSync(outside,'utf8'),{code:'ENOENT'});await assert.rejects(promises.readFile(outside,'utf8'),{code:'ENOENT'});
 for(let i=0;i<600;i++)assert.equal(fs.readFileSync(file,'utf8'),expected);
 const response=await fetch('http://127.0.0.1:'+process.env.SOTERAI_FIXTURE_PORT+'/guard-public');assert.equal(await response.text(),'PUBLIC_LOOPBACK_ONLY');
 const wasm=await fs.promises.readFile(path.join(root,'embedded-public-wasm-url.txt'),'utf8'),data=await fetch(wasm);assert.equal((await data.arrayBuffer()).byteLength,Number(process.env.SOTERAI_FIXTURE_DATA_PAYLOAD_BYTES));
 await new Promise(resolve=>setTimeout(resolve,5200));console.log('GUARD_FIXTURE_PASS');}
main().catch(error=>{console.error(error);process.exitCode=1;});
