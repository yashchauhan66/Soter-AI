'use strict';
// Pure explicit current-byte allowlist controls. No kit writes or native execution.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const helper=require('./build-neutral-review-kit-proposed-05.cjs');
const admission=JSON.parse(fs.readFileSync(path.join(__dirname,'neutral-compiled-input-admission-04.json'),'utf8'));
test('NC01 every exact current compiled firstparty JavaScript build input is admitted in its original form',()=>{
  assert.equal(admission.rows.length,63);
  for(const row of admission.rows){const actual=helper.allowed({...row,role:'PRODUCT_SOURCE'});assert.equal(actual.rel,row.path);assert.equal(actual.sha256,row.sha256);}
});
test('NC02 full sourceproof authority is stated separately from eleven exact build-inventory inputs',()=>{
  assert.equal(admission.sourceProofMatches,52);assert.equal(admission.buildInventoryOnly,11);
  assert(admission.limitation.includes('absent from full sourceproof04'));
});
test('NC03 a compiled allowlist path with changed bytes or hash is refused',()=>{
  const row=admission.rows[0];assert.throws(()=>helper.allowed({...row,bytes:row.bytes+1,role:'PRODUCT_SOURCE'}));
  assert.throws(()=>helper.allowed({...row,sha256:'0'.repeat(64),role:'PRODUCT_SOURCE'}));
});
test('NC04 compiled exceptions cannot be claimed under another role',()=>{
  for(const role of ['BUILD_RECIPE','SYNTHETIC_FIXTURE','NEUTRAL_INSTRUCTIONS','LICENSE','PRODUCT_MANIFEST'])
    assert.throws(()=>helper.allowed({...admission.rows[0],role}));
});
test('NC05 arbitrary package dist, generated declaration/map and contextual entries stay excluded',()=>{
  for(const p of ['packages/vscode-extension/dist/extension.js','packages/guard-core/dist/Unreviewed.js',
    'packages/guard-core/dist/Ledger.d.ts','packages/guard-core/dist/Ledger.js.map',
    'packages/guard-core/dist/evidence/Ledger.js','packages/guard-core/dist/builder-notes.js'])
    assert.throws(()=>helper.allowed({...admission.rows[0],path:p,role:'PRODUCT_SOURCE'}));
});
test('NC06 exact compiled Ledger.js is product source while builder ledger remains excluded',()=>{
  const row=admission.rows.find(r=>r.path==='packages/guard-core/dist/Ledger.js');assert(row);helper.allowed({...row,role:'PRODUCT_SOURCE'});
  assert.throws(()=>helper.allowed({...row,path:'docs/soterai-lite/ledger.md',role:'PRODUCT_SOURCE'}));
});
test('NC07 literal runtime identities are identical to earlier exact wrapper',()=>{
  const old=require('./build-neutral-review-kit-proposed-03.cjs');assert.deepEqual(helper.expectedRuntimes,old.expectedRuntimes);
});
