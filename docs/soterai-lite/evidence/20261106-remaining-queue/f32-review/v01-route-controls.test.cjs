'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { routes, transformWrapper, matrixIds } = require('./prepare-v01-routes.cjs'), { verifyMatrix } = require('./run-v01-route.cjs');
const repo = path.resolve(__dirname, '../../../../..');
const retainedRuns = { cline: 'f18-product-20261019T045611Z-9e21a4b9', claude: 'f19-product-20261019T105923Z-cf56eaaa', gemini: 'f20c-product-20261020T142131Z-3dfc1593' };
for (const route of routes) {
 const dir = path.join(repo, 'docs/soterai-lite/evidence', route.directory);
 const original = fs.readFileSync(path.join(dir, route.wrapper), 'utf8');
 const result = JSON.parse(fs.readFileSync(path.join(dir, retainedRuns[route.id], 'product-result.json'), 'utf8').replace(/^\uFEFF/, ''));
 const expectedIds = matrixIds(route, fs.readFileSync(path.join(dir, route.driver), 'utf8'));
 const withOldIdentity = { ...route, expectedIds, frontendSha256: result.runtimeSha256 };
 test(route.id + ' retained real-client matrix validates only its explicitly supplied old identity', () => { assert.equal(verifyMatrix(result, withOldIdentity).checks.length, route.count); });
 test(route.id + ' failure/missing assertion or unclosed child never qualifies', () => {
  let changed = structuredClone(result); changed.checks.pop(); assert.throws(() => verifyMatrix(changed, withOldIdentity));
  changed = structuredClone(result); changed.checks[0].status = 'FAIL'; assert.throws(() => verifyMatrix(changed, withOldIdentity));
  changed = structuredClone(result); changed.children[0].stdoutEOF = false; assert.throws(() => verifyMatrix(changed, withOldIdentity));
 });
 test(route.id + ' transformed wrapper binds fourth runtime and retains ownership through finally', () => {
  const changed = transformWrapper(original, route, 'a'.repeat(64));
  assert(changed.includes("'soterai-mcp-server.js','pre-commit-client.js'")); assert(changed.includes('ACTUAL') || changed.includes('actual owned exit0'));
  assert(changed.includes('finally{Complete-F26AOwnedProcess')); assert(changed.includes("'owned-editor-close.json'")); assert(!changed.includes('finally{$taskProcess.Dispose()}'));
  assert(!changed.includes(route.oldInspection)); assert(changed.includes(route.expectedStatus));
  assert.throws(() => transformWrapper(changed, route, 'b'.repeat(64)), /Unique wrapper|strictly unequal/);
 });
 test(route.id + ' original matrix and guards remain syntactically valid immutable inputs', () => { assert.equal(expectedIds.length, route.count); assert.equal(new Set(expectedIds).size, route.count); for (const file of [route.driver, ...route.guards]) new vm.Script(fs.readFileSync(path.join(dir, file), 'utf8')); });
}
test('route generator, admission and runner imports are inert and all parse', () => {
 for (const file of ['prepare-v01-routes.cjs', 'route-admission.cjs', 'run-v01-route.cjs']) { new vm.Script(fs.readFileSync(path.join(__dirname, file), 'utf8')); assert.equal(typeof require('./' + file), 'object'); }
});
