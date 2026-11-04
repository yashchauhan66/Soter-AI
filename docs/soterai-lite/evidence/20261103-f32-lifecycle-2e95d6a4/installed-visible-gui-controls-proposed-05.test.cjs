'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const gui=require('./native-owned-gui-phase-proposed-05.cjs');
const runner=require('./run-installed-lifecycle-proposed-05.cjs');
const launch=require('./installed-launch-contract-proposed-03.cjs');
const prep=require('./prepare-installed-extra05-admission-proposed-01.cjs');
const renderer=require('./installed-renderer-proposed-04.cjs');
const own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fact=f=>{const b=fs.readFileSync(f);return{path:f,bytes:b.length,sha256:sha(b)}};
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const earlier=read(own('installed-admission-03.json'));
function admission(){return prep.makeAdmission({runRoot:'D:\\SoterAI-Lite-test-profiles\\f32-installed-20990101T000000Z-a1b2c3d4',
 debugPorts:[62001,62002,62003,62004,62005,62006,62007,62008],configuredBrokerPort:62009,syntheticCanary:'SOTERAI_F32_SYNTHETIC_COMPONENT_ONLY'});}
function options(){
 const b=read(path.join(earlier.runRoot,'profile-primary','F32Gate','primary','primary-observer-binding.json'));
 const executable=read(earlier.vendorReceipt.path).currentHost.executable;
 return{executable:executable.path,args:launch.windowArgs(b,b.phase,Number(new URL(b.endpoint).port)),cwd:b.workspace,
 env:launch.environment(b,b.bindingFile,false),run:b.gate,name:b.phase+'-code',profile:b.profile,deadlineMs:600000,
 guiAuthority:{feature:'F32',status:'EXPLICIT_EXTRA05_VISIBLE_OWNED_GUI_ONLY',extraAttempt:'PROPOSAL05',binding:b,executable}};
}
test('G01 exact retained GUI contract selects explicit visible Code only without launching',()=>{
 assert.deepEqual(gui.validateGuiContract(options()),{windowsHide:false,guiVisibility:'EXPLICIT_VISIBLE_OWNED_SYNTHETIC_CODE',codeSha256:'af032b86db394d21ba86872f4237a11b8395d2f57e8187963a3718a2cc6666ad'});
});
test('G02 Node, CLI argument and wrong executable hash cannot obtain GUI visibility',()=>{
 for(const mutate of [o=>{o.executable='C:\\Program Files\\nodejs\\node.exe'},o=>{o.args=['--list-extensions']},o=>{o.guiAuthority.executable.sha256='0'.repeat(64)}]){const o=options();mutate(o);assert.throws(()=>gui.validateGuiContract(o));}
});
test('G03 normal profile, wrong workspace, extra env and longer deadline refuse GUI authority',()=>{
 for(const mutate of [o=>{o.profile='C:\\Users\\USER\\AppData\\Roaming\\Code'},o=>{o.cwd='C:\\Users\\USER'},o=>{o.env.EXTRA_PRIVATE_VALUE='DO_NOT_COPY'},o=>{o.deadlineMs=600001}]){const o=options();mutate(o);assert.throws(()=>gui.validateGuiContract(o));}
});
test('G04 product development path, tests path and trust bypass arguments are refused',()=>{
 for(const arg of ['--disable-workspace-trust','--extensionTestsPath=D:\\fixture','--extensionDevelopmentPath=C:\\product']){const o=options();o.args.push(arg);assert.throws(()=>gui.validateGuiContract(o));}
});
test('G05 original pipe ownership, deadline and actual close code remains byte-identical after visibility metadata reversal',()=>{
 const original=fs.readFileSync(path.join(__dirname,'../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs'),'utf8');
 const candidate=fs.readFileSync(own('native-owned-gui-phase-proposed-05.cjs'),'utf8');
 assert.equal(sha(Buffer.from(original)),'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
 const take=s=>s.slice(s.indexOf(' const streams={};'),s.indexOf('\nmodule.exports='));
 const reversed=take(candidate).replace('windowsHide:false','windowsHide:true').replace("status:'STARTED_NOT_COMPLETED',...guiObservation,observedAt:","status:'STARTED_NOT_COMPLETED',observedAt:").replace('const close={...guiObservation,observedAt:','const close={observedAt:');
 assert.equal(reversed,take(original));
});
test('G06 successor retains all three actual failed rounds and rejects a forged third failure',()=>{
 const a=admission();runner.verifyPreviousRound(a);runner.verifyPreviousRound02(a);runner.verifyPreviousRound03(a);
 const b=admission();b.previousRound03.rendererClose.sha256='0'.repeat(64);assert.throws(()=>runner.verifyPreviousRound03(b));
});
test('G07 no extra user approval means no run authority or consumption',()=>{
 assert.throws(()=>runner.verifyExtraApproval(admission()),/Explicit single-extra approval/);
 assert(!fs.existsSync(own('installed-extra05-consumed.json')));
});
test('G08 all original assertion IDs, titles and phases remain unchanged',()=>{
 for(const [oldFile,newFile]of [['installed-observer-proposed-04.cjs','installed-observer-proposed-05.cjs'],['installed-upgrade-old-observer-proposed-03.cjs','installed-upgrade-old-observer-proposed-04.cjs']]){
  const checks=file=>[...fs.readFileSync(own(file),'utf8').matchAll(/(?:await )?check\('([A-Z][0-9]{2})', '([^']+)'/g)].map(m=>m.slice(1));
  assert.deepEqual(checks(newFile),checks(oldFile));assert(checks(newFile).length>0);
 }
 const s=fs.readFileSync(own('run-installed-lifecycle-proposed-05.cjs'),'utf8');
 assert(s.includes('assert.equal(portIndex, 8'));assert(s.includes('assert.equal(observations.size, 44'));assert(s.includes('sum + row.observerCount, 0), 59)'));
});
test('G09 renderer diagnostics retain only stage/line/column with private message and path omitted',()=>{
 const error=new Error('PRIVATE_TEST_ONLY');error.stack='Error PRIVATE_TEST_ONLY\n at f (D:\\private-profile\\renderer.cjs:123:8)';
 const d=renderer.safeRendererDiagnostic(error);assert.deepEqual(d,{stage:'PRELUDE',sourceLine:123,sourceColumn:8});assert(!JSON.stringify(d).includes('private-profile'));assert(!JSON.stringify(d).includes('PRIVATE_TEST_ONLY'));
});
test('G10 strict root/port admission cannot reuse failed root or duplicate debug port',()=>{
 const args={runRoot:earlier.runRoot,debugPorts:[62001,62002,62003,62004,62005,62006,62007,62008],configuredBrokerPort:62009,syntheticCanary:'SOTERAI_F32_SYNTHETIC_COMPONENT_ONLY'};
 assert.throws(()=>prep.makeAdmission(args));args.runRoot='D:\\SoterAI-Lite-test-profiles\\f32-installed-20990101T000000Z-a1b2c3d4';args.debugPorts[1]=args.debugPorts[0];assert.throws(()=>prep.makeAdmission(args));
});
