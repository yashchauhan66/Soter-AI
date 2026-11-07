'use strict';
// Read-only by default. Only explicit --run <reviewed binding SHA> can launch.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),own=n=>path.join(__dirname,n),put=(n,v)=>fs.writeFileSync(own(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
function admission(){
 const gateFile=own('native-common-admission.cjs');assert.equal(sha(fs.readFileSync(gateFile)),'60d7ad1dbdca4e6f713256c3f97d6c2cf5fc263055edc1b59d6e295994e8595c');const gate=require(gateFile),base=gate.binding();
 const raw=fs.readFileSync(own('f05-current-binding-04.json')),bindingSha256=sha(raw),b=JSON.parse(raw);assert.equal(b.status,'CURRENT_F05_NATIVE10_PREPARED_NOT_EXECUTED');assert.equal(b.mode,'DEVELOPER_BOOTSTRAP_NOT_CLEAN_INSTALL');assert.equal(b.allowedInvocations,1);assert.equal(b.signalsRequested,0);assert.deepEqual(b.phases,[{name:'save',checks:7},{name:'reload',checks:3}]);assert.equal(b.nativeChecks,10);assert.equal(b.deadlineMillisecondsPerCode,180000);
 for(const key of ['sourceProof','qualification','content','vsix','runtimes','hostReview','extractedRoot','frontendSha256'])assert.deepEqual(b[key],base[key],key);assert.equal(b.codeVersion,'1.145.1');assert.equal(b.vendorJsonRoot,'C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\6bab64e2d1\\resources\\app');assert.equal(b.vendorJsonPins.length,2);
 for(const r of [b.driver,b.driverSource,b.driverProvenance,b.gate,b.affectedBinding,b.ownedHelper,...b.fixtureInputs,...b.vendorJsonPins])gate.pin(r);
 assert.equal(b.ownedHelper.sha256,'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');assert.equal(b.fixtureInputs.find(r=>r.path.endsWith('/affected-preparation-pipe-ownership-01.ps1')).sha256,'246b0ccdb2457fd80f560770b129a1fde67d5d4212e8eae200f965dffd69698c');
 const vendor=gate.read(gate.location(b.hostReview));assert.deepEqual(b.code,vendor.currentHost.executable);assert.equal(vendor.currentHost.appRoot,b.vendorJsonRoot);const provenance=gate.read(gate.location(b.driverProvenance));assert.equal(provenance.status,'TEST_ONLY_SINGLE_HOST_SOURCE_NO_PRODUCT_CODE_BUNDLED');assert.deepEqual(provenance.newDriver,b.driver);assert.deepEqual(provenance.inputs,[b.driverSource]);assert.deepEqual(provenance.originalBundledModules,[provenance.originalSource.path]);gate.pin(provenance.originalSource);assert.equal(provenance.roundTrip,'EXACT_ORIGINAL_SOURCE_AFTER_FIXED_METADATA_REMOVAL');let restored=fs.readFileSync(gate.location(b.driverSource),'utf8');for(const delta of [...provenance.sourceMutationMap].reverse()){assert.equal(restored.split(delta.after).length-1,1);restored=restored.replace(delta.after,()=>delta.before);}assert.equal(gate.sha(Buffer.from(restored)),provenance.originalSource.sha256);assert.equal(provenance.sourceAssertions,'ORIGINAL_H01_H10_UNCHANGED_SAVE7_RELOAD3');for(const r of provenance.auxiliary)gate.pin(r);
 return{b,bindingSha256,gate};
}
function validateResult(result,b,phase){
 assert.equal(result.phase,phase.name);assert.equal(result.hostVersion,b.codeVersion);assert.equal(result.syntheticOnly,true);
 assert.deepEqual([result.passed,result.failed,result.notRun],[phase.checks,0,0]);assert(!result.driverFailure,'Any actual driver failure must refuse');
 assert.equal(result.extensionBundleSha256,b.frontendSha256);assert.equal(result.currentDeveloperBundleSha256,b.frontendSha256);assert.equal(result.hostProbeSha256,b.driver.sha256);
 const source=fs.readFileSync(path.join(repo,b.driverSource.path),'utf8');
 const declarations=[...source.matchAll(/\["(F05-H\d{2})", "([^"\r\n]+)"\]/g)].map(m=>({id:m[1],scope:m[2]}));
 assert.equal(declarations.length,10);assert.equal(new Set(declarations.map(o=>o.id)).size,10);
 const ids=phase.name==='save'?['01','02','03','04','05','06','07']:['08','09','10'];
 const expected=declarations.filter(o=>ids.includes(o.id.slice(-2)));assert.equal(expected.length,phase.checks);
 assert.equal(result.observations.length,phase.checks);assert(result.observations.every(o=>o.status==='PASS'));
 assert.deepEqual(result.observations.map(o=>({id:o.id,scope:o.scope})),expected,'Original F05 assertion IDs/scopes must remain exact');
}
async function main(){
 const mode=process.argv[2]||'--check';assert(['--check','--emit-binding','--run'].includes(mode));assert.equal(process.argv.length,mode==='--run'?4:process.argv[2]?3:2);const {b,bindingSha256,gate}=admission();
 if(mode==='--emit-binding'){console.log(JSON.stringify(b));return;}
 if(mode==='--check'){console.log(JSON.stringify({status:'PASS_CURRENT_F05_NATIVE10_PACKET_ADMISSION_NOT_EXECUTED',bindingSha256,driver:b.driver,vsix:b.vsix,nativeChecks:10,nativeLaunches:0,signalsRequested:0}));return;}
 assert(/^[0-9a-f]{64}$/.test(process.argv[3]));assert.equal(process.argv[3],bindingSha256,'Root-reviewed exact binding required');
 put('f05-current-consumption-04.json',{status:'ONE_F05_NATIVE10_INVOCATION_CONSUMED_NO_RETRY',bindingSha256,observedAt:new Date().toISOString(),signalsRequested:0,mode:b.mode});
 const {phase}=require(gate.location(b.ownedHelper)),keep=setInterval(()=>{},1000);
 try{
  const p=await phase({executable:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',args:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',own('f05-current-proposed-04.ps1'),'-BindingPath',own('f05-current-binding-04.json'),'-ExpectedBindingSha256',bindingSha256],cwd:repo,env:process.env,run:__dirname,name:'f05-current-native-04',profile:'CURRENT_F05_CUSTOMDOCUMENT10_DEVELOPER_BOOTSTRAP_SAVE7_RELOAD3_NO_SIGNALS',deadlineMs:600000});
  assert(p.closed.code===0&&p.closed.signal===null&&p.close.stdoutEOF&&p.close.stderrEOF&&!p.deadline&&!p.error&&!p.overflow,'F05 root helper failed/incomplete; no automatic retry');
  const dirs=fs.readdirSync(__dirname,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^f05-current-native-[0-9TZ]+-[a-f0-9]{8}$/.test(e.name)).filter(e=>fs.existsSync(own(e.name+'/summary.json'))&&gate.read(own(e.name+'/summary.json')).bindingSha256===bindingSha256);assert.equal(dirs.length,1);const dir=own(dirs[0].name),s=gate.read(path.join(dir,'summary.json'));assert.equal(s.status,'PASS_CURRENT_F05_CUSTOMDOCUMENT10_DEVELOPER_BOOTSTRAP_ONLY');assert.equal(s.nativeChecks,10);
  const phases=[];for(const r of b.phases){const result=gate.read(path.join(dir,r.name+'-results.json')),closed=gate.read(path.join(dir,r.name+'-helper-pipe-ownership.json'));validateResult(result,b,r);assert(closed.observedExit&&closed.exitCode===0&&closed.stdoutEOF&&closed.stderrEOF&&closed.signalsRequested===0);phases.push({phase:r.name,checks:r.checks,result:gate.fact(path.join(dir,r.name+'-results.json')),close:gate.fact(path.join(dir,r.name+'-helper-pipe-ownership.json'))});}
  admission();put('f05-current-acceptance-04.json',{status:'PASS_CURRENT_F05_CUSTOMDOCUMENT10_DEVELOPER_BOOTSTRAP_NOT_CLEAN_INSTALL',bindingSha256,vsix:b.vsix,sourceProof:b.sourceProof,codeVersion:b.codeVersion,driver:b.driver,phases,signalsRequested:0,independence:'LOW_SCRIPTED_NATIVE',allDescendantEOF:'NOT_INFERRED'});console.log(JSON.stringify({status:'PASS_CURRENT_F05_NATIVE10_SCOPED',bindingSha256,run:dir}));
 }catch(error){put('f05-current-failure-04.json',{status:'FAIL_OR_INCOMPLETE_NO_AUTOMATIC_RETRY',bindingSha256,errorName:error.name,message:String(error.message).slice(0,250),signalsRequested:0});throw error;}finally{clearInterval(keep);}
}
module.exports={admission,main,validateResult};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
