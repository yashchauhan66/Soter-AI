'use strict';
// Pure current-file admission only. No kit creation/native/CLI/network/Git.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const helper=require('./build-neutral-review-kit-proposed-05.cjs');
const repo=path.resolve(__dirname,'../../../..');
const runtimePaths=[
  'packages/vscode-extension/src/advanced/auditLedger.ts',
  'packages/vscode-extension/src/hygiene/HygieneExposureLedger.ts',
  'packages/guard-core/src/Ledger.ts',
  'packages/vscode-extension/src/firewall/LedgerStore.ts',
  'packages/vscode-extension/src/firewall/ledger-commands.ts',
];
const fact=p=>{const raw=fs.readFileSync(path.join(repo,p));return{path:p,bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')};};
for(const p of runtimePaths)test('actual runtime ledger source is present in neutral source allowlist: '+p,()=>{
  const row={...fact(p),role:'PRODUCT_SOURCE'};
  const checked=helper.allowed(row);assert.equal(checked.rel,p);assert.equal(checked.sha256,row.sha256);
});
test('role confusion does not permit runtime ledger names to become builder context or fixtures',()=>{
  for(const role of ['BUILD_RECIPE','SYNTHETIC_FIXTURE','NEUTRAL_INSTRUCTIONS','LICENSE','PRODUCT_MANIFEST'])
    assert.throws(()=>helper.allowed({...fact(runtimePaths[0]),role}));
});
test('actual builder ledger, scorecard and evidence docs remain excluded under source or instruction roles',()=>{
  for(const p of ['docs/soterai-lite/ledger.md','docs/soterai-lite/SCORECARD.md'])
    for(const role of ['PRODUCT_SOURCE','NEUTRAL_INSTRUCTIONS'])assert.throws(()=>helper.allowed({...fact(p),role}));
  assert.throws(()=>helper.allowed({path:'docs/soterai-lite/evidence/fake/ledger.ts',role:'PRODUCT_SOURCE',bytes:1,sha256:'0'.repeat(64)}));
});
test('src ledger exception does not waive exact file bytes or selected source role',()=>{
  const row={...fact(runtimePaths[0]),role:'PRODUCT_SOURCE'};
  assert.throws(()=>helper.allowed({...row,sha256:'0'.repeat(64)}));
  assert.throws(()=>helper.allowed({...row,bytes:row.bytes+1}));
});
test('other builder-context basenames and arbitrary src ledger paths are not newly admitted',()=>{
  for(const p of ['packages/vscode-extension/src/BuilderNotes.ts','packages/vscode-extension/src/Result.ts',
    'packages/vscode-extension/src/receipts.ts','packages/vscode-extension/src/UnreviewedLedger.ts',
    'packages/vscode-extension/scripts/Ledger.ts'])
    assert.throws(()=>helper.allowed({path:p,role:'PRODUCT_SOURCE',bytes:1,sha256:'0'.repeat(64)}));
});
