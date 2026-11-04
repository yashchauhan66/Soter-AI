'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),fact=p=>{const b=fs.readFileSync(p);return{path:path.relative(repo,p).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)}};
function replaceOne(s,a,b){assert.equal(s.split(a).length-1,1,a);return s.replace(a,()=>b);}
let runner=fs.readFileSync(own('run-f05-current-proposed-01.cjs'),'utf8'),ps=fs.readFileSync(own('f05-current-proposed-01.ps1'),'utf8');
const originalRunner=runner,originalPs=ps;
runner=replaceOne(runner,"own('f05-current-binding-01.json')","own('f05-current-binding-02.json')");
for(const name of ['f05-current-consumption','f05-current-acceptance','f05-current-failure'])runner=replaceOne(runner,"'"+name+"-01.json'","'"+name+"-02.json'");
runner=replaceOne(runner,"own('f05-current-proposed-01.ps1')","own('f05-current-proposed-02.ps1')");
runner=replaceOne(runner,"own('f05-current-binding-01.json')","own('f05-current-binding-02.json')");
runner=replaceOne(runner,"name:'f05-current-native-01'","name:'f05-current-native-02'");
const validator=`function validateResult(result,b,phase){
 assert.equal(result.phase,phase.name);assert.equal(result.hostVersion,b.codeVersion);assert.equal(result.syntheticOnly,true);
 assert.deepEqual([result.passed,result.failed,result.notRun],[phase.checks,0,0]);assert(!result.driverFailure,'Any actual driver failure must refuse');
 assert.equal(result.extensionBundleSha256,b.frontendSha256);assert.equal(result.currentDeveloperBundleSha256,b.frontendSha256);assert.equal(result.hostProbeSha256,b.driver.sha256);
 const source=fs.readFileSync(path.join(repo,b.driverSource.path),'utf8');
 const declarations=[...source.matchAll(/\\["(F05-H\\d{2})", "([^"\\r\\n]+)"\\]/g)].map(m=>({id:m[1],scope:m[2]}));
 assert.equal(declarations.length,10);assert.equal(new Set(declarations.map(o=>o.id)).size,10);
 const ids=phase.name==='save'?['01','02','03','04','05','06','07']:['08','09','10'];
 const expected=declarations.filter(o=>ids.includes(o.id.slice(-2)));assert.equal(expected.length,phase.checks);
 assert.equal(result.observations.length,phase.checks);assert(result.observations.every(o=>o.status==='PASS'));
 assert.deepEqual(result.observations.map(o=>({id:o.id,scope:o.scope})),expected,'Original F05 assertion IDs/scopes must remain exact');
}
`;
runner=replaceOne(runner,'async function main(){',validator+'async function main(){');
const old="assert.deepEqual([result.passed,result.failed,result.notRun],[r.checks,0,0]);assert.equal(result.observations.length,r.checks);assert(result.observations.every(x=>x.status==='PASS'));assert.equal(result.extensionBundleSha256,b.frontendSha256);assert.equal(result.driverFailure,null);";
runner=replaceOne(runner,old,'validateResult(result,b,r);');runner=replaceOne(runner,'module.exports={admission,main};','module.exports={admission,main,validateResult};');
ps=replaceOne(ps,"'f05-current-binding-01.json'","'f05-current-binding-02.json'");
ps=replaceOne(ps,"'run-f05-current-proposed-01.cjs'","'run-f05-current-proposed-02.cjs'");
const put=(n,s)=>fs.writeFileSync(own(n),s,{flag:'wx'});put('run-f05-current-proposed-02.cjs',runner);put('f05-current-proposed-02.ps1',ps);
const b=read(own('f05-current-binding-01.json'));b.fixtureInputs=b.fixtureInputs.map(r=>r.path.endsWith('/run-f05-current-proposed-01.cjs')?fact(own('run-f05-current-proposed-02.cjs')):r.path.endsWith('/f05-current-proposed-01.ps1')?fact(own('f05-current-proposed-02.ps1')):r);
put('f05-current-binding-02.json',JSON.stringify(b,null,2)+'\n');
assert(!fs.existsSync(own('f05-current-consumption-01.json'))&&!fs.existsSync(own('f05-current-consumption-02.json')));
put('f05-correction-provenance-02.json',JSON.stringify({status:'PRELAUNCH_FIXTURE_ONLY_SUCCESS_JSON_AND_EXACT_ASSERTION_AGGREGATION',observedAt:new Date().toISOString(),oldRunnerSha256:sha(Buffer.from(originalRunner)),oldPsSha256:sha(Buffer.from(originalPs)),runner:fact(own('run-f05-current-proposed-02.cjs')),ps:fact(own('f05-current-proposed-02.ps1')),binding:fact(own('f05-current-binding-02.json')),driver:b.driver,originalAssertions:'UNCHANGED_H01_H10',nativeLaunches:0,consumption:0,signalsRequested:0},null,2)+'\n');
console.log(JSON.stringify({status:'PREPARED_F05_SUCCESSOR02_NOT_LAUNCHED',binding:fact(own('f05-current-binding-02.json'))}));
