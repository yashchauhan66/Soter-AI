'use strict';
// Pure fixture admission controls only. No launch, CLI, network, product load or process query.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { inventory, json, inspectVsix } = require('./run-installed-lifecycle-proposed-02.cjs');
const product = 'soterai.soterai-ide-guard';
const repo = path.resolve(__dirname, '../../../..');
const current = path.join(repo, 'packages/soterai-lite/soterai-lite-0.7.0-f32-20261103-attempt01.vsix');
const old = path.join(repo, 'packages/vscode-extension/soterai-ide-guard-0.6.3.vsix');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const fact = file => { const raw = fs.readFileSync(file); return { path:file, bytes:raw.length, sha256:sha(raw) }; };
test('IR01 actual one-product CLI inventory admits exactly current identity/version', () => {
  assert.deepEqual(inventory(Buffer.from(product + '@0.7.0\r\n'), '0.7.0'), {
    registered:[product + '@0.7.0'], productExtraInstallCount:0,
  });
});
test('IR02 inventory before install or after uninstall must actually be empty', () => {
  assert.deepEqual(inventory(Buffer.alloc(0), undefined), {registered:[],productExtraInstallCount:0});
  assert.throws(() => inventory(Buffer.from(product + '@0.7.0\n'), undefined));
  assert.throws(() => inventory(Buffer.alloc(0), '0.7.0'));
});
test('IR03 extra extension, duplicate, old version and banner cannot prove installed inventory', () => {
  for (const raw of [product+'@0.7.0\nother.extra@1.0.0\n', product+'@0.7.0\n'+product+'@0.7.0\n',
    product+'@0.6.3\n', 'Extensions installed:\n'+product+'@0.7.0\n']) {
    assert.throws(() => inventory(Buffer.from(raw), '0.7.0'));
  }
});
test('IR04 duplicate top-level and escaped JSON key aliases refuse admission', () => {
  for (const value of ['{"feature":"F32","feature":"F32"}', '{"feature":"F32","\\u0066eature":"F32"}',
    '{"nested":{"a":1,"a":2}}']) assert.throws(() => json(Buffer.from(value)));
});
test('IR05 repeated keys in separate objects and array strings are not false duplicate failures', () => {
  assert.deepEqual(json(Buffer.from('{"first":{"a":1},"second":{"a":2},"strings":["a",":","a"]}')),
    {first:{a:1},second:{a:2},strings:['a',':','a']});
});
test('IR06 actual exact current VSIX admits four unchanged runtime payloads', () => {
  const row = fact(current); assert.equal(row.bytes, 1742100);
  assert.equal(row.sha256, 'e2ce3dc44d45b5e160ab0f95d713a9434a9ea7d610ce7abd2bf2500abe89d649');
  const checked = inspectVsix(row, '0.7.0', 4);
  assert.equal(checked.runtimes.length, 4); assert.equal(checked.manifest.version,'0.7.0');
  assert(checked.runtimes.some(row=>row.relative==='dist/local-ai-broker.js'));
});
test('IR07 genuine retained old archive admits real0.6.3 and three runtimes', () => {
  const row = fact(old); assert.equal(row.bytes,4446653);
  assert.equal(row.sha256,'dcbcd9738cb480616cf4d3aa66d1a1ac2287e1754aa7307dea7ac23fee7c3677');
  const checked = inspectVsix(row,'0.6.3',3); assert.equal(checked.manifest.version,'0.6.3');
});
test('IR08 archive identity/version/runtime count and content pins cannot be substituted', () => {
  const row=fact(current);
  assert.throws(()=>inspectVsix(row,'0.6.3',4));
  assert.throws(()=>inspectVsix(row,'0.7.0',3));
  assert.throws(()=>inspectVsix({...row,sha256:'0'.repeat(64)},'0.7.0',4));
  assert.throws(()=>inspectVsix({...row,bytes:row.bytes+1},'0.7.0',4));
});
test('IR09 reviewed successor preserves original runner except one broker helper binding', () => {
  const original=fs.readFileSync(path.join(__dirname,'run-installed-lifecycle-proposed-01.cjs'),'utf8');
  const successor=fs.readFileSync(path.join(__dirname,'run-installed-lifecycle-proposed-02.cjs'),'utf8');
  assert.equal(successor.replace('installed-broker-custody-proposed-02.ps1','installed-broker-custody-proposed-01.ps1'),original);
  assert.equal(successor.split('installed-broker-custody-proposed-02.ps1').length-1,1);
});
