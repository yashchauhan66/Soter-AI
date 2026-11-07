'use strict';
// Root-only serial execution: fresh175+27, then fresh334, all on exact1.145.2.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../../..'),common=path.join(repo,'docs/soterai-lite/evidence/20261106-v01-current-02'),remaining=path.join(repo,'docs/soterai-lite/evidence/20261106-v01-remaining334-02'),runDir=path.join(__dirname,'host1452-affected509-batch-01');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),fact=p=>{const raw=fs.readFileSync(p);return{path:path.relative(repo,p).replaceAll('\\','/'),bytes:raw.length,sha256:sha(raw)};};
async function run(){
 const commonModule=require(path.join(common,'v01-admission.cjs')),b=commonModule.binding();assert.equal(b.hostVersion,'1.145.2');assert.equal(b.vsix.sha256,'011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec');
 assert(!fs.existsSync(runDir),'Batch already consumed; preserve and inspect existing results');assert(!fs.existsSync(path.join(common,'run-consumption.json')),'Current175 attempt already consumed');assert(!fs.existsSync(remaining),'Remaining334 successor must not preexist');
 fs.mkdirSync(runDir);const put=(n,v)=>fs.writeFileSync(path.join(runDir,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 const inputs={common:fact(path.join(common,'binding.json')),admission:fact(path.join(common,'v01-admission.cjs')),firstRunner:fact(path.join(common,'run-v01-affected.cjs')),firstVerifier:fact(path.join(common,'verify-v01-affected.cjs')),remainingPreparation:fact(path.join(__dirname,'prepare-remaining334-host1452-02.cjs')),batchRunner:fact(__filename)};
 put('consumption.json',{status:'ONE_SERIAL_SAME_HOST509_PLUS27_ATTEMPT_CONSUMED',at:new Date().toISOString(),inputs,hostVersion:b.hostVersion,vsix:b.vsix,signalsRequested:0});
 try{
  await require(path.join(common,'run-v01-affected.cjs')).run();
  const first=require(path.join(common,'verify-v01-affected.cjs')).verify();assert.equal(first.nativeChecks,175);assert.equal(first.hostVersion,'1.145.2');
  put('first175-accepted.json',{at:new Date().toISOString(),acceptance:fact(path.join(common,'affected-acceptance.json')),hostVersion:first.hostVersion,nativeChecks:first.nativeChecks,functionalChecks:first.functionalChecks,securityComparison:first.securityComparison});
  assert.deepEqual(fact(path.join(__dirname,'prepare-remaining334-host1452-02.cjs')),inputs.remainingPreparation);
  const preparation=require('./prepare-remaining334-host1452-02.cjs').prepare();assert.equal(preparation.hostVersion,'1.145.2');
  await require(path.join(remaining,'run-remaining334.cjs')).run();
  const aggregate=require(path.join(remaining,'verify-remaining334.cjs')).verify();assert.equal(aggregate.nativeChecks,509);assert.equal(aggregate.nativePhases,37);assert.equal(aggregate.hostVersion,'1.145.2');
  commonModule.binding();assert.deepEqual(fact(path.join(common,'binding.json')),inputs.common);
  const result={status:'PASS_CURRENT_SAME_HOST20_FAMILIES509_FUNCTIONAL10_SECURITY17',at:new Date().toISOString(),hostVersion:'1.145.2',code:b.code,vsix:b.vsix,sourceProof:b.sourceProof,acceptance:fact(path.join(remaining,'affected509-acceptance.json')),nativeChecks:509,nativeFamilyPhases:37,functionalChecks:10,securityCompared:17,priorHostAssertionsTransferred:0,native34:'SEPARATE_ACCEPTED_1.145.1_RECEIPT_NOT_RELABELLED',signalsRequested:0,releaseReady:false};put('acceptance.json',result);console.log(JSON.stringify(result));return result;
 }catch(error){put('failure.json',{status:'FAILED_OR_INCOMPLETE_NO_AUTOMATIC_RETRY',at:new Date().toISOString(),error:{name:error.name,message:error.message},signalsRequested:0});throw error;}
}
module.exports={run};if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
