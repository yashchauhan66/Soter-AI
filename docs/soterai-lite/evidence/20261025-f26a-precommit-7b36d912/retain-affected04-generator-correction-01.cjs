// Restore executed preparation bytes and retain the corrected materializer separately.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {fact,json,own,sha}=require('./post-full04-contract.cjs');
const originalPin=json(own('affected-native-template-manifest-04.json')).generator;
const current=fs.readFileSync(own('prepare-affected-current-04.cjs'));
const corrected="const {check,fact,json,own,repo,sha,OUTPUT}=require('./post-full04-contract.cjs');\nconst gate=require('./current-content-gate04.cjs');";
const original="const {check,gate,fact,json,own,repo,sha,OUTPUT}=require('./post-full04-contract.cjs');";
assert.equal(current.toString('utf8').split(corrected).length,2);
const restored=Buffer.from(current.toString('utf8').replace(corrected,()=>original));assert.equal(restored.length,originalPin.bytes);assert.equal(sha(restored),originalPin.sha256);
fs.writeFileSync(own('prepare-affected-current-04b.cjs'),current,{flag:'wx'});
fs.writeFileSync(own('prepare-affected-current-04.cjs'),restored);
assert.deepEqual(fact(own('prepare-affected-current-04.cjs')),originalPin);
fs.writeFileSync(own('affected04-generator-correction-01.json'),JSON.stringify({status:'ORIGINAL_PREPARATION_BYTES_RESTORED_CORRECTED_MATERIALIZER_RETAINED_NOT_EXECUTED',observedAt:new Date().toISOString(),original:originalPin,successor:fact(own('prepare-affected-current-04b.cjs')),reason:'Review caught generic Node-only gate predicate on future PowerShell content receipt. Preparation had already emitted25 templates; preserve its exact generator pin and use separate04b for future materialization. The invalid materialization branch was never executed; no behavior/test/result was regraded.'},null,2)+'\n',{flag:'wx'});
console.log('Original preparation generator bytes exact; corrected04b retained, materialization not executed.');
