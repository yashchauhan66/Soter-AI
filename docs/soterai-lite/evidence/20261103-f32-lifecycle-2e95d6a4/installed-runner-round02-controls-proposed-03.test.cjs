'use strict';
// Pure receipt and parser controls only; retained round01 fixture reads, no live query/launch.
require('./installed-runner-controls-proposed-02.test.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {verifyPreviousRound}=require('./run-installed-lifecycle-proposed-03.cjs');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const fact=file=>{const raw=fs.readFileSync(file);return{path:file,bytes:raw.length,sha256:sha(raw)}};
const previous=JSON.parse(fs.readFileSync(path.join(__dirname,'installed-admission-01.json'),'utf8'));
function admission(){return{...previous,normalRound:2,runRoot:previous.runRoot+'-different',previousRound:{
  consumed:fact(path.join(__dirname,'installed-normal-round-01-consumed.json')),
  admission:fact(path.join(__dirname,'installed-admission-01.json')),
  failure:fact(path.join(previous.runRoot,'receipts','installed-round-01-failure.json')),
  initialAbsenceClose:fact(path.join(previous.runRoot,'profile-primary','F32Gate','primary','primary-before-cli-absence-owned-close.json')),
  rootResult:fact(path.join(__dirname,'installed-native-01.txt.result.json')),
}}}
test('IR10 actual retained failed01 has emptycompleted, initialchildexit1/bothEOF and rootexit1',()=>{
  const value=admission();assert.deepEqual(verifyPreviousRound(value),value.previousRound);
});
test('IR11 failed root cannot be silently reused for next explicit round',()=>{
  const value=admission();value.runRoot=previous.runRoot;assert.throws(()=>verifyPreviousRound(value));
});
test('IR12 absent prior authority or changed consumed/admission bytes refuses next round',()=>{
  const value=admission();assert.throws(()=>verifyPreviousRound({...value,previousRound:undefined}));
  value.previousRound.consumed.sha256='0'.repeat(64);assert.throws(()=>verifyPreviousRound(value));
});
test('IR13 next artifact/source cannot inherit old failure authority for different inputs',()=>{
  const value=admission();value.sourceProof={...value.sourceProof,sha256:'0'.repeat(64)};assert.throws(()=>verifyPreviousRound(value));
  const other=admission();other.currentVsix={...other.currentVsix,sha256:'0'.repeat(64)};assert.throws(()=>verifyPreviousRound(other));
});
test('IR14 another failure path or changed child/outer evidence cannot authorize round02',()=>{
  for(const key of ['failure','initialAbsenceClose','rootResult']){
    const value=admission();value.previousRound[key]={...value.previousRound[key],sha256:'0'.repeat(64)};
    assert.throws(()=>verifyPreviousRound(value));
  }
});
test('IR15 strict custody stays04 and only identical vendor receipt is copied to D bindings',()=>{
  const source=fs.readFileSync(path.join(__dirname,'run-installed-lifecycle-proposed-03.cjs'),'utf8');
  assert(source.includes("custody: 'installed-owner-custody-proposed-04.ps1'"));
  assert(!source.includes('installed-owner-custody-proposed-05.ps1'));
  assert(source.includes("const copiedVendorReceipt = copy(a.vendorReceipt, path.join(paths.assets, 'vendor-observation.json'));"));
  assert(source.includes('vendorReceipt: copiedVendorReceipt, rootMarker: marker'));
  assert(source.includes('pin(copiedVendorReceipt)'));
  assert(source.includes("assert.equal(a.normalRound, 2)"));
  assert(source.includes("['02', '03']"));
  assert(source.includes('assert.equal(observations.size, 44'));
});
