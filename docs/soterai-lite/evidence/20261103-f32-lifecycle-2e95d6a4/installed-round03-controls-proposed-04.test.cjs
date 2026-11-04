'use strict';
// Pure retained-byte/function controls, not native lifecycle evidence.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const helper=require('./run-installed-lifecycle-proposed-04.cjs');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const fact=p=>{const raw=fs.readFileSync(p);return{path:p,bytes:raw.length,sha256:sha(raw)}};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const prior=read(path.join(__dirname,'installed-admission-02.json'));
function admission(){const gate=path.join(prior.runRoot,'profile-primary','F32Gate','primary');return{...prior,normalRound:3,runRoot:prior.runRoot+'-distinct',previousRound02:{
  consumed:fact(path.join(__dirname,'installed-normal-round-02-consumed.json')),admission:fact(path.join(__dirname,'installed-admission-02.json')),
  failure:fact(path.join(prior.runRoot,'receipts','installed-round-02-failure.json')),
  codeClose:fact(path.join(gate,'primary-code-owned-close.json')),listenerClose:fact(path.join(gate,'primary-listener-custody-owned-close.json')),
  rootResult:fact(path.join(__dirname,'installed-native-02.txt.result.json'))},installerSizeQualification:fact(path.join(__dirname,'vendor-installed-size-qualification-02.json'))}}
test('R301 actual prior02 CLI closures/Code0/listener1/bothEOF/root1 retain failed authority',()=>{
  const a=admission();helper.verifyPreviousRound(a);helper.verifyPreviousRound02(a);
});
test('R302 reusing prior02 root or drifting failed evidence cannot authorize normal03',()=>{
  const a=admission();a.runRoot=prior.runRoot;assert.throws(()=>helper.verifyPreviousRound02(a));
  for(const key of ['codeClose','listenerClose','rootResult']){const b=admission();b.previousRound02[key].sha256='0'.repeat(64);assert.throws(()=>helper.verifyPreviousRound02(b));}
});
test('R303 both exact archives independently compute extension payload plus CRC-verified rootXML',()=>{
  const a=admission(),current=helper.inspectVsix(a.currentVsix,'0.7.0',4),old=helper.inspectVsix(a.oldVsix,'0.6.3',3);
  helper.verifyInstallerSize(a,current,old);assert.equal(current.vendorInstalledSize,3668082);assert.equal(current.archiveXml.bytes,3594);
  assert.equal(current.vendorInstalledSize,current.payloadUncompressedBytes+current.archiveXml.bytes);
  assert.equal(old.vendorInstalledSize,5466512);assert.equal(old.archiveXml.bytes,3525);
  assert.throws(()=>helper.verifyInstallerSize(a,{...current,vendorInstalledSize:current.payloadUncompressedBytes},old));
  assert.throws(()=>helper.verifyInstallerSize(a,{...current,archiveXml:{...current.archiveXml,sha256:'0'.repeat(64)}},old));
});
const source=fs.readFileSync(path.join(__dirname,'installed-observer-proposed-04.cjs'),'utf8');
const fragment=source.slice(source.indexOf("let observedStage = 'PRELUDE';"),source.indexOf('const FIXED = {'));
function trustContext(choice,initialTrusted,actualChoice=choice){
  const b={phase:'primary',gate:'D:\\fixture',workspace:'D:\\fixture\\workspace',trustChoice:choice};
  let present=false,reads=0,calls=0;const vscode={workspace:{isTrusted:initialTrusted}};
  const module={exports:{}};
  const context={assert,path,Error,module,vscode,fs:{existsSync(){return present}},read(){reads++;return{status:'OBSERVED_NATIVE_TRUST_KEYBOARD_CHOICE',choice:actualChoice,workspaceName:'workspace',signalsRequested:0}},
    until:async fn=>{calls++;let result=fn();if(!result){present=true;vscode.workspace.isTrusted=choice!=="No, I don't trust the authors";result=fn()}assert(result,'bounded controlled readiness did not settle');return result}};
  vm.runInNewContext(fragment+'\nmodule.exports={awaitReviewedTrust,safeDiagnostic,setStage(value){observedStage=value}};',context);
  return{b,api:module.exports,get reads(){return reads},get calls(){return calls}};
}
test('R304 exact old immediate trusted assertion fails while fresh native trust has not settled',()=>{
  const old=fs.readFileSync(path.join(__dirname,'installed-observer-proposed-03.cjs'),'utf8');
  assert(old.includes('assert.equal(vscode.workspace.isTrusted, true);'));
  assert.throws(()=>vm.runInNewContext('assert.equal(vscode.workspace.isTrusted, true);',{assert,vscode:{workspace:{isTrusted:false}}}));
});
test('R305 corrected fresh trusted observer waits real keyboard receipt then actual state',async()=>{
  const f=trustContext('Yes, I trust the authors',false);await f.api.awaitReviewedTrust(f.b);assert.equal(f.reads,1);assert.equal(f.calls,2);
});
test('R306 restricted state alone cannot skip real choice receipt or accept different choice',async()=>{
  const f=trustContext("No, I don't trust the authors",false);await f.api.awaitReviewedTrust(f.b);assert.equal(f.reads,1);
  const other=trustContext("No, I don't trust the authors",false,'Yes, I trust the authors');await assert.rejects(other.api.awaitReviewedTrust(other.b));
});
test('R307 diagnostics retain fixed stage and numeric source line/column only',()=>{
  const f=trustContext(undefined,true);f.api.setStage('I02');const e=new Error('PRIVATE_VALUE_CONTROL');
  e.stack='Error: PRIVATE_VALUE_CONTROL\n    at fn (D:\\private-profile\\observer.cjs:142:9)';
  const actual=JSON.parse(JSON.stringify(f.api.safeDiagnostic(e)));assert.deepEqual(actual,{stage:'I02',sourceLine:142,sourceColumn:9});
  assert(!JSON.stringify(actual).includes('PRIVATE_VALUE_CONTROL'));assert(!JSON.stringify(actual).includes('private-profile'));
});
test('R308 all declared current/old observers wait trust and actual renderer emits the acknowledgement',()=>{
  const old=fs.readFileSync(path.join(__dirname,'installed-upgrade-old-observer-proposed-03.cjs'),'utf8');
  const renderer=fs.readFileSync(path.join(__dirname,'installed-renderer-proposed-03.cjs'),'utf8');
  assert(source.includes('await awaitReviewedTrust(b)'));assert(old.includes('await awaitReviewedTrust(b)'));
  assert(renderer.includes('OBSERVED_NATIVE_TRUST_KEYBOARD_CHOICE'));
  assert(renderer.indexOf('await keyboardButton(b.trustChoice)')<renderer.indexOf("write(path.join(b.gate,b.phase+'-trust-choice.json')"));
});
