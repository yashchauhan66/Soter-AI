'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const generator = require('./prepare-candidate-successor.cjs');
const evidence = path.resolve(__dirname, '../../20261103-f32-lifecycle-2e95d6a4');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sources = generator.buildSources();
const runnerSource = sources['run-installed-lifecycle-proposed-08.cjs'];
const compiled = new Module(path.join(evidence, 'run-installed-lifecycle-proposed-08.cjs'), module);
compiled.filename = path.join(evidence, 'run-installed-lifecycle-proposed-08.cjs');
compiled.paths = Module._nodeModulePaths(evidence);
compiled._compile(runnerSource, compiled.filename);
const runner = compiled.exports;
test('all generated successors parse without executing a native path', () => {
  for(const [name, source] of Object.entries(sources)) new vm.Script(source, { filename: name });
  assert.equal(Object.keys(sources).length,5);
});
test('new sourceParent is explicit and a mismatched parent is refused', () => {
  const proof = { status:'FROZEN_F32_INPUTS_NOT_TEST_OR_NATIVE_ACCEPTANCE',sourceParent:'1'.repeat(40),fileCount:0,files:[],scopedSource:[] };
  runner.verifySource(proof,'1'.repeat(40));
  assert.throws(()=>runner.verifySource(proof,'2'.repeat(40)),{code:'ERR_ASSERTION'});
  assert.throws(()=>runner.verifySource(proof,undefined),{code:'ERR_ASSERTION'});
});
test('real historical failed rounds remain exact while the next candidate and proof can change', () => {
  const a=read(path.join(evidence,'installed-extra07-admission.json'));
  a.runRoot='D:\\SoterAI-Lite-test-profiles\\f32-installed-20261106T235959Z-1234abcd';
  a.sourceProof={path:'C:\\new-proof.json',bytes:1,sha256:'1'.repeat(64)};
  a.currentVsix={path:'C:\\new-candidate.vsix',bytes:2,sha256:'2'.repeat(64)};
  runner.verifyPreviousRound(a);runner.verifyPreviousRound02(a);runner.verifyPreviousRound03(a);
});
function previous07() {
  const earlier=read(path.join(evidence,'installed-extra07-admission.json'));
  const gate=path.join(earlier.runRoot,'profile-primary','F32Gate','primary');
  return Object.fromEntries(Object.entries({admission:path.join(evidence,'installed-extra07-admission.json'),consumed:path.join(evidence,'installed-extra07-consumed.json'),
    failure:path.join(earlier.runRoot,'receipts','installed-extra07-failure.json'),codeClose:path.join(gate,'primary-code-owned-close.json'),rendererClose:path.join(gate,'primary-renderer-owned-close.json'),
    observerFailure:path.join(gate,'primary-observer-failure.json'),trustBefore:path.join(gate,'primary-trust-before.json'),rendererTrustBefore:path.join(gate,'primary-renderer-trust-before.json')}).map(([key,file])=>[key,generator.fact(file)]));
}
test('real native07 failure and both actual closed stream sets validate independently of the new candidate', () => {
  runner.verifyPreviousExtra07({runRoot:'D:\\SoterAI-Lite-test-profiles\\f32-installed-20261106T235959Z-1234abcd',previousExtra07:previous07()});
});
test('a changed retained native07 failure hash cannot be admitted', () => {
  const p=previous07();p.failure.sha256='0'.repeat(64);
  assert.throws(()=>runner.verifyPreviousExtra07({runRoot:'D:\\SoterAI-Lite-test-profiles\\f32-installed-20261106T235959Z-1234abcd',previousExtra07:p}),{code:'ERR_ASSERTION'});
});
test('fresh R21 qualification accepts an actual pass, never a skip or unrelated success', () => {
  const title='F32-R21 a pending nonmodal completion notice cannot block the fixed removal report';
  assert.equal(generator.r21Passes(Buffer.from('ok 21 - '+title+'\r\n')).length,1);
  assert.equal(generator.r21Passes(Buffer.from('ok 21 - '+title+' # SKIP\n')).length,0);
  assert.equal(generator.r21Passes(Buffer.from('not ok 21 - '+title+'\n')).length,0);
});
test('eight lifecycle phases and 44/59 acceptance totals remain byte exact', () => {
  const original=fs.readFileSync(path.join(evidence,'run-installed-lifecycle-proposed-07.cjs'),'utf8').replaceAll('\r\n','\n');
  const take=source=>source.slice(source.indexOf('    const primary = binding'),source.indexOf('    stable();\n    // No new human/admin gate.'));
  assert.equal(take(runnerSource),take(original));
  assert(runnerSource.includes('assert.equal(portIndex, 8'));
  assert(runnerSource.includes('assert.equal(observations.size, 44'));
  assert(runnerSource.includes('sum + row.observerCount, 0), 59)'));
});
test('optional trust diagnostics can be disabled without removing completion acknowledgment', () => {
  const plain=generator.buildSources({trustDiagnostics:false});
  assert.equal(plain['installed-observer-proposed-07.cjs'],fs.readFileSync(path.join(__dirname,'installed-observer-proposed-06.cjs'),'utf8').replaceAll('\r\n','\n'));
  assert(plain['installed-renderer-proposed-07.cjs'].includes('...rendererCompletion(b)'));
  assert(!plain['installed-renderer-proposed-07.cjs'].includes('trust-keyboard-intent.json'));
});
function trustFixture({intent=false,receipt=false,onPoll}={}) {
  const source=sources['installed-observer-proposed-07.cjs'];
  const fn=source.slice(source.indexOf('async function awaitReviewedTrust(b) {'),source.indexOf('\nconst FIXED ='));
  assert(fn.trimEnd().endsWith('}'));
  const files=new Map(),b={gate:__dirname,phase:'primary',workspace:path.join(__dirname,'workspace-primary'),trustChoice:'Yes, I trust the authors'};
  const intentPath=path.join(b.gate,'primary-trust-keyboard-intent.json'),receiptPath=path.join(b.gate,'primary-trust-choice.json');
  const receiptValue={status:'OBSERVED_NATIVE_TRUST_KEYBOARD_CHOICE',choice:b.trustChoice,workspaceName:'workspace-primary',signalsRequested:0};
  if(intent)files.set(intentPath,{status:'OBSERVED_TRUST_BUTTON_FOCUS_BEFORE_KEYBOARD',phase:b.phase,choice:b.trustChoice,workspaceName:'workspace-primary',signalsRequested:0});
  if(receipt)files.set(receiptPath,receiptValue);
  const run=vm.runInNewContext(fn+'\nawaitReviewedTrust',{
    fs:{existsSync:file=>files.has(file)},path,assert,Date,observedStage:'PRELUDE',
    vscode:{workspace:{isTrusted:true}},collectTrustSnapshot:()=>({isTrusted:true}),
    read:file=>files.get(file),write:(file,value)=>{assert(!files.has(file));files.set(file,value);},
    until:async callback=>{for(let i=0;i<3;i++){const value=callback();if(value)return value;if(onPoll)onPoll({files,receiptPath,receiptValue},i);}throw Error('Bound expired');},
  });
  return{run:()=>run(b),files};
}
test('unexpected pretrusted state fails before it can be credited as native keyboard evidence',async()=>{
  const f=trustFixture();await assert.rejects(f.run(),/before witnessed keyboard intent/);
  const note=f.files.get(path.join(__dirname,'primary-trust-grant-observation.json'));
  assert.equal(note.keyboardIntentPresent,false);assert.equal(note.keyboardReceiptPresent,false);assert(!Number.isNaN(Date.parse(note.observedAt)));
});
test('keyboard intent alone does not satisfy trust; delayed real receipt is required',async()=>{
  const f=trustFixture({intent:true});await assert.rejects(f.run(),/Bound expired/);
  const g=trustFixture({intent:true,onPoll:({files,receiptPath,receiptValue})=>files.set(receiptPath,receiptValue)});await g.run();
});
test('the original post-keyboard receipt still completes the trust handshake',async()=>{
  await trustFixture({intent:true,receipt:true}).run();
});
