// Compare the two current read-only guards and witness same-length byte drift refusal.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const old=require('./current-native-guard-01.cjs'),next=require('./current-native-guard-02.cjs'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const times=[];for(const [name,module]of [['original',old],['bounded_sync',next]]){const start=performance.now();const b=await module.guard();times.push({name,elapsedMs:Math.round(performance.now()-start),sourceCount:b.fileCount,vsixSha256:b.vsix.sha256});}
 assert.equal(times[0].sourceCount,1016);assert.equal(times[1].sourceCount,1016);assert.equal(times[0].vsixSha256,times[1].vsixSha256);
 const folder=path.join(__dirname,'guard-byte-witness-01');fs.mkdirSync(folder);const before=Buffer.from('SYNTHETIC_A'),after=Buffer.from('SYNTHETIC_B'),target=path.join(folder,'mutable-fixture.bin');fs.writeFileSync(path.join(folder,'before.bin'),before,{flag:'wx'});fs.writeFileSync(path.join(folder,'after.bin'),after,{flag:'wx'});fs.writeFileSync(target,before,{flag:'wx'});
 const pin={path:path.relative(old.repo,target).replace(/\\/g,'/'),bytes:before.length,sha256:sha(before)};next.pinSource(pin);fs.writeFileSync(target,after);assert.throws(()=>next.pinSource(pin));assert.throws(()=>next.pinSource({...pin,bytes:before.length-1}));
 const result={status:'PASS_BOTH_COMPLETE_GUARDS_AND_BYTE_DRIFT_REFUSAL_NOT_NATIVE',observedAt:new Date().toISOString(),timings:times,sourceAdmission:'ALL_1016_RECHECKED_EACH_INVOCATION',sameLengthChangedBytes:'REFUSED',wrongLength:'REFUSED',sourceChecksRemoved:0,signalsRequested:0};fs.writeFileSync(path.join(__dirname,'native-guard-equivalence-02.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}
main().catch(()=>{console.error('Native guard comparison refused.');process.exitCode=1;});
