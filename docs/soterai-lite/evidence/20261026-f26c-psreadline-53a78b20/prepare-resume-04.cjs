const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const closed=read(own('full-tests-03-owned-close.json'));assert.equal(closed.actualClose,true);assert.equal(closed.signal,null);assert.equal(closed.stdoutEOF,true);assert.equal(closed.stderrEOF,true);assert.equal(closed.signalsRequested,0);
const proof=read(own('full-inputs-03.json'));for(const pin of proof.files){const raw=fs.readFileSync(path.join(repo,pin.path));assert.equal(raw.length,pin.bytes,pin.path);assert.equal(sha(raw),pin.sha256,pin.path);}
const raw=fs.readFileSync(own('full-tests-03.txt'),'utf8'),summary={};for(const field of ['tests','pass','fail','cancelled','skipped','duration_ms']){const match=new RegExp('^# '+field+' ([0-9.]+)\\r?$','m').exec(raw);assert(match);summary[field]=Number(match[1]);}
const durations=[...raw.matchAll(/# Subtest: ([^\r\n]+)[\s\S]*?duration_ms: ([0-9.]+)/g)].map(r=>({title:r[1],durationMs:Number(r[2])})).sort((a,b)=>b.durationMs-a.durationMs).slice(0,8);
fs.writeFileSync(own('resume-full03-failure-04.json'),JSON.stringify({status:'ACTUAL_FULL03_FAIL_RETAINED_CURRENT1005_EXACT',observedAt:new Date().toISOString(),summary,largestRecordedTestDurations:durations,close:closed,sourceProofSha256:sha(fs.readFileSync(own('full-inputs-03.json'))),inference:'Gateway four failures reached existing1000ms limit, vault confirmation missed existing2000ms wait and21 child tests cancelled. Wall-clock gap source not established; no product deadline or oracle change authorized by this record.',native06:'USER_DEFERRED_NOT_RUN',next:'Require isolated unchanged failing files PASS before new full04/backend03 chain. Native04 still NOT_RUN.'},null,2)+'\n',{flag:'wx'});
let chain=fs.readFileSync(own('run-serial-03.cjs'),'utf8');
for(const name of ['serial-start','serial-result','serial-failure','full-tests'])chain=chain.replaceAll(name+'-03',name+'-04');
const start=chain.indexOf(" verifyInputs(); await step('journal-controller-02'"),end=chain.indexOf(" verifyInputs();\n await step('full-tests-04'",start);assert(start>=0&&end>start);
chain=chain.slice(0,start)+` verifyInputs();
 const failed=read(own('full-tests-03-owned-close.json'));assert(failed.actualClose&&failed.stdoutEOF&&failed.stderrEOF&&failed.signal===null);
 for(const name of ['compiler-08','readiness-03','package-03','offline-inventory-04','full03-failures-isolated-01']){const r=read(own(name+'.txt.result.json'));assert.equal(r.exitCode,0,name);assert.equal(sha(fs.readFileSync(own(name+'.txt'))),r.sha256.toLowerCase(),name);}
 const isolated=fs.readFileSync(own('full03-failures-isolated-01.txt'),'utf8');assert(/^# fail 0\\r?$/m.test(isolated)&&/^# cancelled 0\\r?$/m.test(isolated));
`+chain.slice(end);
chain=chain.replace(/phases:\[[^\]]+\]/,"phases:['priorCompiler08Package03Content04AndIsolatedFailuresRechecked','full04','backendCompiler03','backendTests03']");
fs.writeFileSync(own('run-serial-04.cjs'),chain,{flag:'wx'});
let materialize=fs.readFileSync(own('materialize-native-binding-04.cjs'),'utf8').replaceAll('full-tests-03','full-tests-04').replaceAll("'offline-inventory-03'","'offline-inventory-04'");
materialize=materialize.replaceAll('FULL03_BACKEND03_EXACT_ATTEMPT03','FULL04_BACKEND03_EXACT_ATTEMPT03');fs.writeFileSync(own('materialize-native-binding-04b.cjs'),materialize,{flag:'wx'});
let guard=fs.readFileSync(own('current-native-guard-04.cjs'),'utf8').replaceAll('FULL03_BACKEND03_EXACT_ATTEMPT03','FULL04_BACKEND03_EXACT_ATTEMPT03');
fs.writeFileSync(own('current-native-guard-04b.cjs'),guard,{flag:'wx'});
// Both successor materializer and runner use the exact successor guard contract.
materialize=materialize.replaceAll("'./current-native-guard-04.cjs'","'./current-native-guard-04b.cjs'");fs.writeFileSync(own('materialize-native-binding-04c.cjs'),materialize,{flag:'wx'});
let runner=fs.readFileSync(own('run-history-native-04.cjs'),'utf8').replaceAll("'./current-native-guard-04.cjs'","'./current-native-guard-04b.cjs'");fs.writeFileSync(own('run-history-native-04b.cjs'),runner,{flag:'wx'});
console.log(JSON.stringify({status:'CURRENT1005_EXACT_PRIOR_FULL_FAIL_RETAINED',full03:summary,next:'Serial04 prepared; isolated failure receipts required, no rerun or native launch yet.'}));
