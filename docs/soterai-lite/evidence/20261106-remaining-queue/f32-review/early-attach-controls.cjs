'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {buildSources}=require('./prepare-early-attach-successor.cjs');
const sources=buildSources();
const base=path.resolve(__dirname,'../../20261103-f32-lifecycle-2e95d6a4');
const original=fs.readFileSync(path.join(base,'installed-owner-custody-proposed-06.ps1'),'utf8').replaceAll('\r\n','\n');
assert(sources['installed-owner-custody-proposed-07.ps1'].startsWith(original),'Original complete custody must remain unchanged');
const fixture={phase:'primary',profile:'profile-primary',gate:'gate',vendorReceipt:{sha256:'vendor'}};
const close={actualClose:true,exitCode:0,signal:null,stdoutEOF:true,stderrEOF:true,signalsRequested:0,overflow:false,streamError:false,deadlineExceeded:false};
const early={status:'CURRENT_OWNED_EXACT_ROOT_LOOPBACK_LISTENER',rootCodePid:4512,rootCreationUtc:'2026-11-06T15:00:00.1Z',signals:0};
const full={status:'CURRENT_OWNED_EXACT_PROFILE_LOOPBACK_LISTENER',rootCodePid:4512,rootCreationUtc:early.rootCreationUtc,profile:fixture.profile,signals:0};
const result={path:'result',sha256:'result'};
function values(){return new Map([
 [path.join('gate','primary-renderer-results.json'),{schemaVersion:1,feature:'F32',phase:'primary',status:'OBSERVED_REAL_KEYBOARD',signalsRequested:0,productPromptInterception:false,productApiReplacement:false,completionNonce:'nonce',observerResult:result}],
 [path.join('gate','primary-full-custody-accepted.json'),{status:'FULL_DESCENDANT_CUSTODY_AND_HELPER_NATURAL_EOF_ACCEPTED',feature:'F32',phase:'primary',profile:fixture.profile,rootCodePid:4512,vendorReceipt:fixture.vendorReceipt,signalsRequested:0,fullCustody:{path:'gate/full'},earlyCustody:{path:'gate/early'},helperClose:{path:'gate/close'}}],
 ['gate/full',structuredClone(full)],['gate/early',structuredClone(early)],['gate/close',structuredClone(close)]
]);}
let passed=1;
(async()=>{
 for(const name of ['installed-observer-proposed-08.cjs','installed-upgrade-old-observer-proposed-07.cjs']){
  const text=sources[name],start=text.indexOf('async function awaitRendererCompletion('),end=text.indexOf('// F32_COMPLETION_HANDSHAKE_END',start);
  const code=text.slice(start,end);
  async function check(change,fail){
   const files=values();change(files);
   const context={assert,path,fs:{existsSync:file=>files.has(file),lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>false,nlink:1,size:1})},read:file=>files.get(file),pin:row=>{assert(files.has(row.path));},inside:(root,file)=>file.startsWith(root+'/'),until:async fn=>{const v=await fn();assert(v,'Required acknowledgment absent');return v;}};
   const call=vm.runInNewContext(code+'\n awaitRendererCompletion',context);
   if(fail)await assert.rejects(call(fixture,'nonce',result));else await call(fixture,'nonce',result);
   passed++;
  }
  await check(()=>{},false);
  await check(files=>files.delete(path.join('gate','primary-full-custody-accepted.json')),true);
  await check(files=>{files.get('gate/close').stderrEOF=false;},true);
  await check(files=>{files.get('gate/close').exitCode=1;},true);
  await check(files=>{files.get('gate/full').rootCreationUtc='wrong';},true);
  await check(files=>{files.get('gate/full').rootCodePid=99;},true);
  await check(files=>{files.get('gate/full').profile='other';},true);
 }
 const materialized=process.argv[2]==='--verify-materialized';
 let preview;
 if(materialized){
  for(const[name,text]of Object.entries(sources))assert.equal(fs.readFileSync(path.join(base,name),'utf8'),text,'Exact materialized successor differs: '+name);
 }else{
  const previewName=process.argv[2]??'early-attach-preview-03';
  assert(/^early-attach-preview-[0-9]{2}$/.test(previewName));
  preview=path.join(__dirname,previewName);
  assert(!fs.existsSync(preview),'Preview output is one-shot');fs.mkdirSync(preview);
  for(const[name,text]of Object.entries(sources))fs.writeFileSync(path.join(preview,name),text,{flag:'wx'});
 }
 console.log(JSON.stringify({status:'PASS_EARLY_ATTACH_AND_FULL_CUSTODY_ACK_CONTROLS',passed,failed:0,nativeLaunches:0,signalsRequested:0,materialized,preview}));
})().catch(error=>{console.error(error);process.exitCode=1;});
