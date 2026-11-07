const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),{own,fact}=require('./storage-current-admission-09.cjs');
const old=fs.readFileSync(own('run-affected-current-09.cjs'),'utf8');assert(old.includes('native08-acceptance-01.json'));
const current=old.replaceAll('native08-acceptance-01.json','native09-acceptance-01.json');assert.equal(current.replaceAll('native09-acceptance-01.json','native08-acceptance-01.json'),old);new vm.Script(current);
fs.writeFileSync(own('run-affected-current-10.cjs'),current,{flag:'wx'});
const originalStart=fs.readFileSync(own('start-affected-current-09.ps1'),'utf8');
const start=originalStart.replaceAll('native08-acceptance-01.json','native09-acceptance-01.json').replaceAll('run-affected-current-09.cjs','run-affected-current-10.cjs');
assert.equal(start.replaceAll('native09-acceptance-01.json','native08-acceptance-01.json').replaceAll('run-affected-current-10.cjs','run-affected-current-09.cjs'),originalStart);
fs.writeFileSync(own('start-affected-current-10.ps1'),start,{flag:'wx'});
fs.writeFileSync(own('affected-native09-cutover-01.json'),JSON.stringify({status:'PREPARED_ONLY_REQUIRE_ACTUAL_NATIVE09_34_AND_OFFLINE_PASS_NOT_NATIVE08',observedAt:new Date().toISOString(),originalChain:fact(own('run-affected-current-09.cjs')),currentChain:fact(own('run-affected-current-10.cjs')),currentStart:fact(own('start-affected-current-10.ps1')),changes:'Acceptance pointer09 replaces failed08; launcher targets this exact successor. All affected assertions, artifact/source bindings, serial closure checks and deadlines byte exact.',native:'NOT_RUN',signalsRequested:0},null,2)+'\n',{flag:'wx'});
