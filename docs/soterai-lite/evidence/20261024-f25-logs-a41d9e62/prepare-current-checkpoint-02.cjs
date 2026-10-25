'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),base=path.relative(repo,__dirname).replaceAll('\\','/');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n),'utf8').replace(/^\uFEFF/,''));
const write=(n,b)=>fs.writeFileSync(path.join(__dirname,n),b,{flag:'wx'});
const fact=p=>{const b=fs.readFileSync(path.join(repo,p));return {path:p,bytes:b.length,sha256:sha(b)}};
const file='packages/vscode-extension/src/__tests__/historyGitProcess.test.ts',absolute=path.join(repo,file),before=fs.readFileSync(absolute),previous=read('full-inputs-03.json');
assert.deepEqual(fact(file),previous.records.find(r=>r.path===file));
const old='    const f = await fixture({ kind: "version" }, {}, 30), { result } = await f.begin();';
const text=before.toString('utf8');assert.equal(text.split(old).length,2);
const nl=text.includes('\r\n')?'\r\n':'\n';
const replacement=['    let clock = 1000;',
'    const f = await fixture({ kind: "version" }, { now: () => clock }, 30), { result } = await f.begin();',
'    assert.equal(f.settled, false); assert.equal(f.worker.busy, true);',
'    clock = 1031; // Expire only after the one owned fake child has actually started.'].join(nl);
const after=Buffer.from(text.replace(old,replacement));
write('historyGitProcess.before-deadline-fixture-01.ts',before);
fs.writeFileSync(absolute,after);
const correction={status:'TEST_ONLY_DEADLINE_CLOCK_ORDER_CORRECTION_PENDING_VERIFICATION',file,before:{path:base+'/historyGitProcess.before-deadline-fixture-01.ts',bytes:before.length,sha256:sha(before)},after:fact(file),failureRaw:fact(base+'/full-tests-04.txt'),failureReceipt:fact(base+'/full-tests-04.txt.result.json'),oldLine:old,newLines:replacement,scope:'Only existing elapsed-deadline test uses injected monotonic clock; initial1000/deadline1030; advance1031 strictly after verified single fake-child admission. Same30ms timer,1000ms test timeout, STOP_UNCONFIRMED/busy/real-close/bothEOF/no-signals assertions. No product change or prior-failure regrade.'};
write('deadline-fixture-correction-01.json',JSON.stringify(correction,null,2)+'\n');
let library=fs.readFileSync(path.join(__dirname,'full-input-lib-03.cjs'),'utf8');assert(library.includes("'full-inputs-03.json'"));library=library.replaceAll("'full-inputs-03.json'","'full-inputs-04.json'");write('full-input-lib-04.cjs',library);
const inputs=require('./full-input-lib-04.cjs'),records=inputs.inventory().map(inputs.fact);assert.equal(records.length,932);
assert.deepEqual(records.map(r=>r.path),previous.records.map(r=>r.path));assert.deepEqual(records.filter((r,i)=>r.sha256!==previous.records[i].sha256).map(r=>r.path),[file]);
write('full-inputs-04.json',JSON.stringify({...previous,records,status:'CURRENT_WITH_EXPLICIT_TEST_ONLY_CLOCK_CORRECTION_VERIFICATION_PENDING',changedFrom03:[file],fixtureCorrection:fact(base+'/deadline-fixture-correction-01.json'),observedAt:new Date().toISOString()},null,2)+'\n');
const nativeOld=read('native-source-inputs-02.json'),nativeRecords=nativeOld.records.map(r=>fact(r.path));assert.deepEqual(nativeRecords.filter((r,i)=>r.sha256!==nativeOld.records[i].sha256).map(r=>r.path),[file]);
write('native-source-inputs-03.json',JSON.stringify({...nativeOld,records:nativeRecords,status:'CURRENT_EXPLICIT_METADATA_AND_TEST_ONLY_CLOCK_DELTAS_EQUIVALENCE_PENDING',fullInputBinding:fact(base+'/full-inputs-04.json'),changesFromPreviousNativeFreeze:[file],fixtureCorrection:fact(base+'/deadline-fixture-correction-01.json'),observedAt:new Date().toISOString()},null,2)+'\n');
write('check-full-inputs-06.cjs',"const inputs=require('./full-input-lib-04.cjs');console.log(JSON.stringify({status:'EXACT_CURRENT_FULL_INPUTS',files:inputs.check()}));\n");
let gates=fs.readFileSync(path.join(__dirname,'run-full-gates-05.ps1'),'utf8').replaceAll('check-full-inputs-05.cjs','check-full-inputs-06.cjs').replaceAll("'full-tests-04'","'full-tests-05'");
write('run-full-gates-06.ps1',gates);
write('run-full-entry-06.ps1',fs.readFileSync(path.join(__dirname,'run-full-entry-05.ps1'),'utf8').replaceAll('run-full-gates-05.ps1','run-full-gates-06.ps1').replaceAll('full-gates-05.txt','full-gates-06.txt'));
write('start-durable-full-06.ps1',fs.readFileSync(path.join(__dirname,'start-durable-full-05.ps1'),'utf8').replaceAll('check-full-inputs-05.cjs','check-full-inputs-06.cjs').replaceAll('run-full-entry-05.ps1','run-full-entry-06.ps1').replaceAll('durable-full-start-05.json','durable-full-start-06.json').replaceAll('durable-full-stdout-05.txt','durable-full-stdout-06.txt').replaceAll('durable-full-stderr-05.txt','durable-full-stderr-06.txt'));
const nativeRaw=fs.readFileSync(path.join(__dirname,'native-source-inputs-03.json'));
let builder=fs.readFileSync(path.join(__dirname,'build-native-hosts-01.template.cjs'),'utf8');
const bindings={'__F25_TEMPLATE_BOUND__':'F25_CURRENT_FACTS_BOUND','__F25_NATIVE_INPUTS_JSON__':'native-source-inputs-03.json','__F25_NATIVE_INPUTS_SHA256__':sha(nativeRaw),'__F25_NATIVE_HOST_OUTPUT_DIR__':'prebuilt-native-hosts-02','__F25_NATIVE_DRIVER_PROVENANCE_JSON__':'native-driver-provenance-02.json'};
for(const [key,value]of Object.entries(bindings)){assert(builder.includes(key),key);builder=builder.replaceAll(key,value)}assert(!builder.includes('__F25_'));
write('build-native-hosts-02.cjs',builder);
console.log(JSON.stringify({status:'PREPARED_TEST_ONLY_CLOCK_FIX_CURRENT_FULL05_AND_NATIVE_BUILD02',files:932,native:934,correction:fact(base+'/deadline-fixture-correction-01.json'),builder:fact(base+'/build-native-hosts-02.cjs')}));
