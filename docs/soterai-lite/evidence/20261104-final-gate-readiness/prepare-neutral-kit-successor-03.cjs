'use strict';
// Evidence-only generation; no product edit or kit execution.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const original=fs.readFileSync(path.join(__dirname,'build-neutral-review-kit-proposed-01.cjs'),'utf8');
const before="  assert(!/(?:ledger|scorecard|final-report|handoff|builder[-_]?notes|acceptance|receipt|result|\\.env(?:\\.|$))/i.test(path.basename(p)));";
assert.equal(original.split(before).length-1,1);
const after=`  // These are actual current runtime sources, not the builder's ledger.
  // Every one remains separately role-bound and exact-byte allowlisted/pinned.
  const runtimeLedger = row.role === 'PRODUCT_SOURCE' && new Set([
    'packages/vscode-extension/src/advanced/auditLedger.ts',
    'packages/vscode-extension/src/hygiene/HygieneExposureLedger.ts',
    'packages/guard-core/src/Ledger.ts',
    'packages/vscode-extension/src/firewall/LedgerStore.ts',
    'packages/vscode-extension/src/firewall/ledger-commands.ts',
  ]).has(p);
  assert(!/(?:scorecard|final-report|handoff|builder[-_]?notes|acceptance|receipt|result|\\.env(?:\\.|$))/i.test(path.basename(p)));
  assert(runtimeLedger || !/ledger/i.test(path.basename(p)));`;
const base=original.replace(before,after);
assert.equal(base.replace(after,before),original);
fs.writeFileSync(path.join(__dirname,'build-neutral-review-kit-base-03.cjs'),base,{flag:'wx'});
let successor=fs.readFileSync(path.join(__dirname,'build-neutral-review-kit-proposed-02.cjs'),'utf8');
assert.equal(successor.split("require('./build-neutral-review-kit-proposed-01.cjs')").length-1,1);
successor=successor.replace("require('./build-neutral-review-kit-proposed-01.cjs')","require('./build-neutral-review-kit-base-03.cjs')");
fs.writeFileSync(path.join(__dirname,'build-neutral-review-kit-proposed-03.cjs'),successor,{flag:'wx'});
const controls=fs.readFileSync(path.join(__dirname,'neutral-source-ledger-controls-proposed-02.test.cjs'),'utf8');
fs.writeFileSync(path.join(__dirname,'neutral-source-ledger-controls-proposed-03.test.cjs'),controls.replace("require('./build-neutral-review-kit-proposed-02.cjs')","require('./build-neutral-review-kit-proposed-03.cjs')"),{flag:'wx'});
