const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const own=n=>path.join(__dirname,n);
let text=fs.readFileSync(own('run-serial-04.cjs'),'utf8');const start=text.indexOf('async function main(){'),end=text.indexOf('\nmain().catch(',start);assert(start>=0&&end>start);
text=text.slice(0,start)+`async function main(){
 json('native-chain-start-04.json',{status:'STARTED_NOT_COMPLETED',observedAt:new Date().toISOString(),pid:process.pid,signalsRequested:0,steps:['nativeBuild03','materializeBinding04d','verifyGuard04c','affectedMaterialization01StaticOnly','native04c'],native06:'USER_DEFERRED_EXCLUDED_NOT_RUN'});
 assert.equal(read(own('serial-result-04.json')).status,'SERIAL_VERIFICATION_PASSED_NOT_FEATURE_OR_NATIVE_ACCEPTANCE');verifyInputs();
 assert(!fs.existsSync(own('native-run-failure-04.json')));
 await step('native-build-03',['docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/build-native-hosts-03.cjs']);
 await step('native-binding-04',['docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/materialize-native-binding-04d.cjs']);
 await step('native-guard-04',['docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/current-native-guard-04c.cjs']);
 await step('affected-materialize-01',['docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/materialize-affected-01.cjs']);
 await step('native-history-run-04',['docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/run-history-native-04c.cjs']);verifyInputs();
 json('native-chain-result-04.json',{status:'NEW_NATIVE28_PASS_ACTUAL_EMITTED_CONSOLE_AND_AFFECTED_STILL_PENDING',observedAt:new Date().toISOString(),results,signalsRequested:0,native06:'EXCLUDED_USER_DEFERRED_NOT_RUN'});
}`+text.slice(end);
text=text.replaceAll("'serial-failure-04.json'","'native-chain-failure-04.json'").replaceAll('F26c serial verification refused','F26c native verification chain refused');
fs.writeFileSync(own('run-native-chain-04.cjs'),text,{flag:'wx'});console.log('Prepared native chain gated by full04/backend03 PASS; no native launch.');
