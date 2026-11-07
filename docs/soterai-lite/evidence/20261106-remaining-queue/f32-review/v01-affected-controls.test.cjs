'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { verifySecurity } = require('./verify-v01-affected.cjs');
const repo = path.resolve(__dirname, '../../../../..');
const baseline = JSON.parse(fs.readFileSync(path.join(repo, 'docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/security-comparison-01.json'), 'utf8').replace(/^\uFEFF/, ''));
const bundle = 'a'.repeat(64), make = () => ({ extensionBundleSha256: bundle, results: baseline.rows.map(row => ({ attack: row.attack, status: row.current })) });
test('actual retained 17-case baseline explicitly preserves all nine unmanaged leaks', () => { const result = verifySecurity(make(), baseline, bundle); assert.deepEqual(result.residuals, { BLOCKED_SCOPED: 8, LEAK_CONFIRMED: 9 }); assert.equal(result.rows.filter(row => row.remainingUnmanagedLeak).length, 9); });
test('new artifact mismatch cannot borrow old security results', () => { assert.throws(() => verifySecurity(make(), baseline, 'b'.repeat(64))); });
test('missing case cannot pass through zero-exit wrapper', () => { const current = make(); current.results.pop(); assert.throws(() => verifySecurity(current, baseline, bundle)); });
test('duplicate case cannot hide a missing unmanaged case', () => { const current = make(); current.results[1] = current.results[0]; assert.throws(() => verifySecurity(current, baseline, bundle)); });
test('changing a leak into a block requires review rather than silently changing baseline', () => { const current = make(); current.results.find(row => row.status === 'LEAK_CONFIRMED').status = 'BLOCKED_SCOPED'; assert.throws(() => verifySecurity(current, baseline, bundle)); });
test('changing a block into a leak is rejected', () => { const current = make(); current.results.find(row => row.status === 'BLOCKED_SCOPED').status = 'LEAK_CONFIRMED'; assert.throws(() => verifySecurity(current, baseline, bundle)); });
test('unknown or skipped case cannot qualify', () => { const current = make(); current.results[0].status = 'NOT_TESTED'; assert.throws(() => verifySecurity(current, baseline, bundle)); });
test('all executable templates parse and importing them has no launch side effect', () => {
 for (const file of ['prepare-v01-affected.cjs', 'v01-admission.cjs', 'run-v01-affected.cjs', 'verify-v01-affected.cjs']) { new vm.Script(fs.readFileSync(path.join(__dirname, file), 'utf8')); assert.equal(typeof require('./' + file), 'object'); }
});
