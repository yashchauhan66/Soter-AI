// One owned serial verification chain. No signals/kill/timeouts that end children.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const home=__dirname,repo=path.resolve(home,'../../../..'),own=n=>path.join(home,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const wrapper=path.join(repo,'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'),powershell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const quote=s=>"'"+s.replaceAll("'","''")+"'",keep=setInterval(()=>{},1000),results=[];
function json(name,value){fs.writeFileSync(own(name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
function verifyInputs(){const proof=read(own('full-inputs-03.json'));assert.equal(proof.fileCount,1005);for(const pin of proof.files){const raw=fs.readFileSync(path.join(repo,pin.path));assert.equal(raw.length,pin.bytes,pin.path);assert.equal(sha(raw),pin.sha256,pin.path);}}
async function step(name,args,cwd=repo,program=process.execPath){
 const output=own(name+'.txt');assert(!fs.existsSync(output));
 const command='& '+quote(wrapper)+' -FilePath '+quote(program)+' -ArgumentList @('+args.map(quote).join(',')+') -OutputFile '+quote(output)+' -WorkingDirectory '+quote(cwd);
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
 json('affected-remaining-chain-start.json',{status:'STARTED_NOT_COMPLETED',observedAt:new Date().toISOString(),pid:process.pid,signalsRequested:0,native06:'EXCLUDED_NOT_RUN',historyExtraRound:'NOT_INCLUDED_REQUIRES_APPROVAL'});
 verifyInputs();assert.equal(read(own('serial-result-05.json')).status,'SERIAL_VERIFICATION_PASSED_NOT_FEATURE_OR_NATIVE_ACCEPTANCE');
 const admission=read(own('affected-validation-01.txt.result.json'));assert.equal(admission.exitCode,0);assert.equal(sha(fs.readFileSync(own('affected-validation-01.txt'))),admission.sha256.toLowerCase());
 const binding=await require('./current-native-guard-05.cjs').guard(),host=read(path.join(repo,binding.hostReview.path)).currentHost;
 const artifact=['-VsixPath',path.join(repo,binding.vsix.path),'-ExpectedVsixSha256',binding.vsix.sha256,'-ExpectedBundleSha256',binding.frontendSha256];
 const nativeArgs=(helper,driver)=>['-NoProfile','-ExecutionPolicy','Bypass','-File',own(helper),'-CodePath',host.executable.path,...artifact,'-HostTestsPath',own('prebuilt-native-hosts-03/'+driver),'-ExtensionRoot',path.join(repo,binding.extractedRoot)];
 const completed=read(own('affected-artifact-cleanup01-chain-result.json'));assert.equal(completed.status,'AFFECTED_CONTROLS_CLOSED_PASS_REQUIRES_ROOT_RESULT_AGGREGATION_NOT_FEATURE_ACCEPTANCE');
 await step('affected-remaining-suite-run-01',['-NoProfile','-ExecutionPolicy','Bypass','-File',own('run-remaining-affected-suite-01.ps1'),...artifact],repo,powershell);verifyInputs();
 json('affected-remaining-chain-result.json',{status:'AFFECTED_CONTROLS_CLOSED_PASS_REQUIRES_ROOT_RESULT_AGGREGATION_NOT_FEATURE_ACCEPTANCE',observedAt:new Date().toISOString(),results,signalsRequested:0,historyExtraRound:'NOT_INCLUDED',native06:'EXCLUDED_NOT_RUN'});
}
main().catch(error=>{json('affected-remaining-chain-failure.json',{status:'FAIL_OR_INCOMPLETE_NO_LATER_PHASES',observedAt:new Date().toISOString(),results,reason:typeof error.code==='string'?error.code:'VERIFICATION_REFUSED',signalsRequested:0});console.error('F26c affected verification chain refused; exact raw evidence retained.');process.exitCode=1;}).finally(()=>{clearInterval(keep);});
