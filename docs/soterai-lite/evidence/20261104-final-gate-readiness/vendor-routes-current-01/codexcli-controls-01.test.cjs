'use strict';
// Component/static controls only; never call run(), Code or a vendor client.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const route=require('./codexcli-route-current-01.cjs');
const root=__dirname,repo=path.resolve(root,'../../../../..'),old=path.join(repo,'docs/soterai-lite/evidence/20261020-f20c-gemini-cli-8a6d3e70');
const own=n=>path.join(root,n),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const frontend='b611dee998d11824d523b3d561704f4a5dc15e27274e6e1d85c7154b9d42cfa0';
function positive(){return{status:'PASS_SCOPED_PRODUCT_CLI_MATRIX',runtimeSha256:frontend,checks:Array.from({length:20},(_,i)=>({id:'F20A-N'+String(i+1).padStart(2,'0'),status:'PASS'})),mediatedContextControl:{status:'BLOCKED_SCOPED'},unmediatedContextControl:{status:'LEAK_CONFIRMED',covered:false},native:[{closed:true,stdoutEOF:true,stderrEOF:true,signal:null}],children:[{closed:true,stdoutEOF:true,stderrEOF:true}],deniedSignals:[],deniedExternal:[]};}
test('C01 original20 driver and exact guards remain byte-identical copies',()=>{
 for(const name of ['responses-matrix-01.cjs','matrix-guards-01.cjs','installed-cli-public-inputs-01.json'])assert(fs.readFileSync(own('codexcli/'+name)).equals(fs.readFileSync(path.join(old,name))));
 const source=fs.readFileSync(own('codexcli/responses-matrix-01.cjs'),'utf8');
 const ids=[...source.matchAll(/await check\('(F20A-N\d{2})'/g)].map(m=>m[1]);assert.equal(ids.length,20);assert.equal(new Set(ids).size,20);
});
test('C02 valid original matrix retains adjacent uncovered leak control as a leak',()=>{
 const r=route.verifyResult(positive(),frontend);assert.equal(r.originalAssertions,20);assert.equal(r.baselineOverride,'LEAK_CONFIRMED_UNCOVERED');assert.equal(r.unobservedNestedVendorClosure,'NOT_INFERRED');
});
test('C03 missing duplicated changed or failed original ID cannot pass',()=>{
 for(const mutate of [r=>r.checks.pop(),r=>r.checks[0].id=r.checks[1].id,r=>r.checks[0].id='INVENTED',r=>r.checks[0].status='FAIL']){const r=positive();mutate(r);assert.throws(()=>route.verifyResult(r,frontend));}
});
test('C04 each selected native client requires actual close and both EOF',()=>{
 for(const key of ['closed','stdoutEOF','stderrEOF']){const r=positive();r.native[0][key]=false;assert.throws(()=>route.verifyResult(r,frontend));}
 for(const key of ['privateOutputSeen','outputOverflow','retainedWithoutSignal']){const r=positive();r.native[0][key]=true;assert.throws(()=>route.verifyResult(r,frontend));}
 const r=positive();r.native[0].signal='SIGTERM';assert.throws(()=>route.verifyResult(r,frontend));
});
test('C05 guarded broker MCP ticket children cannot inherit Code-root closure',()=>{
 for(const key of ['closed','stdoutEOF','stderrEOF']){const r=positive();r.children[0][key]=false;assert.throws(()=>route.verifyResult(r,frontend));}
 const r=positive();r.children=[];assert.throws(()=>route.verifyResult(r,frontend));
});
test('C06 removed leak disclosure wrong runtime and nonzero safety counters refuse acceptance',()=>{
 const r=positive();r.unmediatedContextControl={status:'BLOCKED_SCOPED',covered:true};assert.throws(()=>route.verifyResult(r,frontend));
 assert.throws(()=>route.verifyResult(positive(),'0'.repeat(64)));
 for(const key of ['deniedSignals','deniedExternal']){const r=positive();r[key].push('CONTROL');assert.throws(()=>route.verifyResult(r,frontend));}
});
test('C07 owned close requires natural zero exit actual close and both EOF without deadline',()=>{
 const c={actualClose:true,exitCode:0,signal:null,stdoutEOF:true,stderrEOF:true,overflow:false,streamError:false,deadlineExceeded:false,signalsRequested:0};route.verifyClose(c);
 for(const [key,value]of [['actualClose',false],['exitCode',1],['signal','SIGTERM'],['stdoutEOF',false],['stderrEOF',false],['deadlineExceeded',true],['signalsRequested',1]])assert.throws(()=>route.verifyClose({...c,[key]:value}));
});
test('C08 exact final all18/four runtime extraction matches current audit inventory',()=>{
 const i=read(own('current-inspection-01.json'));assert.equal(i.entries.length,18);assert.equal(i.sha256,'e2ce3dc44d45b5e160ab0f95d713a9434a9ea7d610ce7abd2bf2500abe89d649');
 const runtimes=i.entries.filter(e=>/^extension\/dist\/.*\.js$/.test(e.path));assert.equal(runtimes.length,4);
 for(const e of i.entries.filter(e=>e.path.startsWith('extension/')))route.pin({path:path.join(i.extractedExtensionRoot,e.path.slice(10)),bytes:e.bytes,sha256:e.sha256});
});
test('C09 complete public Codex graph retains original four native/version pins',()=>{
 const g=read(own('codexcli-public-graph-01.json')),p=read(own('codexcli/installed-cli-public-inputs-01.json'));
 assert.equal(g.fileCount,50);assert.equal(g.files.length,50);assert.equal(new Set(g.files.map(f=>f.relative)).size,50);
 for(const r of p.files){const found=g.files.find(f=>f.relative===r.relative);assert(found);assert.equal(found.sha256,r.sha256);assert.equal(found.bytes,r.bytes);}
 assert.equal(p.version,'0.160.1');assert.equal(g.clientLaunches,0);assert.equal(g.networkRequests,0);
});
test('C10 refreshed wrapper removes incomplete drain snapshots and binds fourth runtime',()=>{
 const ps=fs.readFileSync(own('run-codexcli-current-01.ps1'),'utf8');assert(!ps.includes('ReadToEndAsync'));assert(!ps.includes('$taskProcess.Start()'));assert(ps.includes('pre-commit-client.js'));assert(ps.includes('run-owned-code-current-01.cjs'));assert(ps.includes('--validate-prepared'));
});
test('C11 unchanged guards retain signal refusal loopback and exact native allowlist',()=>{
 const s=fs.readFileSync(own('codexcli/matrix-guards-01.cjs'),'utf8');for(const marker of ['CHILD_SIGNAL_REFUSED','PROCESS_SIGNAL_REFUSED','DIRECT_NATIVE_SPAWN_REFUSED','F20A test harness denied nonloopback traffic','expectedNative','codex.exe','--strict-config'])assert(s.includes(marker),marker);
});
test('C12 import and pure verification created no admission consumption or profile',()=>{
 assert(!fs.existsSync(own('codexcli-admission-01.json')));assert(!fs.existsSync(own('codexcli-one-attempt-consumed-01.json')));
 assert.equal(read(own('codexcli-preparation-01.json')).nativeLaunches,0);
});
