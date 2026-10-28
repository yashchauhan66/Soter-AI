// One owned serial verification chain. No signals/kill/timeouts that end children.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const home=__dirname,repo=path.resolve(home,'../../../..'),own=n=>path.join(home,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const wrapper=path.join(repo,'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'),powershell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const quote=s=>"'"+s.replaceAll("'","''")+"'",keep=setInterval(()=>{},1000),results=[];
function json(name,value){fs.writeFileSync(own(name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
function verifyInputs(){const proof=read(own('full-inputs-04.json'));assert.equal(proof.fileCount,1016);for(const pin of proof.files){const raw=fs.readFileSync(path.join(repo,pin.path));assert.equal(raw.length,pin.bytes,pin.path);assert.equal(sha(raw),pin.sha256,pin.path);}}
async function step(name,args,cwd=repo){
 const output=own(name+'.txt');assert(!fs.existsSync(output));
 const command='& '+quote(wrapper)+' -FilePath '+quote(process.execPath)+' -ArgumentList @('+args.map(quote).join(',')+') -OutputFile '+quote(output)+' -WorkingDirectory '+quote(cwd);
 const child=cp.spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{cwd:repo,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
 json(name+'-owned-start.json',{status:'STARTED_NOT_COMPLETED',observedAt:new Date().toISOString(),pid:child.pid??null,args,cwd,signalsRequested:0});
 const streams={};let overflow=false,error=false,deadline=false;
 for(const key of ['stdout','stderr']){const file=own(name+'-wrapper-'+key+'.bin');streams[key]={file,fd:fs.openSync(file,'wx'),bytes:0,eof:false};child[key].on('data',raw=>{const s=streams[key],left=1048576-s.bytes;if(raw.length>left)overflow=true;if(left>0){const part=raw.subarray(0,left);fs.writeSync(s.fd,part);s.bytes+=part.length;}});child[key].on('end',()=>{streams[key].eof=true});child[key].on('error',()=>{error=true});}
 child.on('error',()=>{error=true});
 const timer=setTimeout(()=>{deadline=true;json(name+'-deadline.json',{status:'STOP_UNCONFIRMED_RETAIN_OWNERSHIP_NO_NEW_PHASE',pid:child.pid,signalsRequested:0});},1800000);
 const closed=await new Promise(resolve=>child.on('close',(code,signal)=>resolve({code,signal})));clearTimeout(timer);
 for(const s of Object.values(streams)){fs.fsyncSync(s.fd);fs.closeSync(s.fd);}
 const receiptFile=output+'.result.json',receipt=fs.existsSync(receiptFile)?read(receiptFile):null;
 const result={name,status:closed.code===0&&closed.signal===null&&receipt?.exitCode===0&&!overflow&&!error&&!deadline&&streams.stdout.eof&&streams.stderr.eof?'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT':'FAIL_OR_INCOMPLETE',observedAt:new Date().toISOString(),pid:child.pid??null,actualClose:true,wrapperExit:closed.code,signal:closed.signal,innerExit:receipt?.exitCode??null,stdoutEOF:streams.stdout.eof,stderrEOF:streams.stderr.eof,overflow,streamError:error,deadlineExceeded:deadline,signalsRequested:0,streams:Object.entries(streams).map(([name,s])=>({name,bytes:s.bytes,sha256:sha(fs.readFileSync(s.file))}))};
 if(receipt)assert.equal(sha(fs.readFileSync(output)),receipt.sha256.toLowerCase());json(name+'-owned-close.json',result);results.push(result);console.log(JSON.stringify(result));assert.equal(result.status,'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT',name);
}
async function main(){
 json('affected-history-chain-start-02.json',{status:'WAITING_AFFECTED20_AND_FUNCTIONAL_SECURITY',observedAt:new Date().toISOString(),pid:process.pid,signalsRequested:0});
 const end=Date.now()+7200000;
 while(!fs.existsSync(own('affected-chain-result-01.json'))){assert(!fs.existsSync(own('affected-chain-failure-01.json')),'Earlier affected chain failed; no next launch');assert(Date.now()<end,'Earlier chain unavailable; no launch');await new Promise(done=>setTimeout(done,2000));}
 // Waiter01 has no child: its prelaunch output-exists assertion must refuse the older checked-history result filename.
 while(!fs.existsSync(own('affected-history-chain-failure-01.json'))){assert(Date.now()<end,'Prior waiter refusal not observed');await new Promise(done=>setTimeout(done,250));}
 const earlier=read(own('affected-chain-result-01.json'));assert.equal(earlier.status,'AFFECTED20_AND_FUNCTIONAL_SECURITY_WRAPPERS_CLOSED_PASS_ROOT_AGGREGATION_PENDING');assert.equal(earlier.results.length,21);assert(earlier.results.every(row=>row.status==='PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT'&&row.actualClose&&row.stdoutEOF&&row.stderrEOF&&row.signal===null&&row.signalsRequested===0));
 verifyInputs();await step('affected-psreadline-regression-run-01',['docs/soterai-lite/evidence/20261027-f27-self-hygiene-8c16e402/run-affected-history-01.cjs']);verifyInputs();
 json('affected-history-chain-result-02.json',{status:'AFFECTED_HISTORY28_WRAPPER_CLOSED_PASS_ROOT_AGGREGATION_PENDING',observedAt:new Date().toISOString(),results,signalsRequested:0,console8:'NOT_RUN',native06:'F26a_USER_DEFERRED_NOT_RUN'});
}
main().catch(error=>{json('affected-history-chain-failure-02.json',{status:'FAIL_OR_INCOMPLETE_NO_LATER_PHASES',observedAt:new Date().toISOString(),results,reason:typeof error.code==='string'?error.code:'VERIFICATION_REFUSED',signalsRequested:0});console.error('F27 serial verification refused; raw evidence retained; no automatic retry.');process.exitCode=1;}).finally(()=>{clearInterval(keep);});
