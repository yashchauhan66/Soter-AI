'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const text = name => fs.readFileSync(path.join(__dirname, name), 'utf8').replaceAll('\r\n', '\n');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const plain = value => JSON.parse(JSON.stringify(value));
const originals = path.resolve(__dirname, '../../20261103-f32-lifecycle-2e95d6a4');
const original = name => fs.readFileSync(path.join(originals, name), 'utf8').replaceAll('\r\n', '\n');
const source = text('installed-renderer-proposed-06.cjs');
function actualHandshake(name, exportName) {
  const body = text(name).split('// F32_COMPLETION_HANDSHAKE_BEGIN\n')[1]?.split('// F32_COMPLETION_HANDSHAKE_END')[0];
  assert(body, 'The test exercises the actual successor handshake');
  return vm.runInNewContext(body + '\n' + exportName, {
    fs, path, assert, sha, read, SyntaxError,
    until: async (fn, timeout, label) => {
      const started = Date.now();
      while (Date.now() - started < timeout) { const value = await fn(); if (value) return value; await delay(2); }
      throw Error(label ?? 'Owned renderer completion acknowledgment missing');
    },
  });
}
const rendererCompletion = actualHandshake('installed-renderer-proposed-06.cjs', 'rendererCompletion');
function fixture(t, phase) {
  const gate = fs.mkdtempSync(path.join(__dirname, 'control-'));
  t.after(() => {
    const absolute = path.resolve(gate);
    assert.equal(path.dirname(absolute), path.resolve(__dirname));
    assert(/^control-[A-Za-z0-9]+$/.test(path.basename(absolute)));
    fs.rmSync(absolute, { recursive: true });
  });
  const b = { gate, phase };
  const completed = { schemaVersion: 1, feature: 'F32', phase,
    status: phase === 'upgrade-old' ? 'PASS_SCOPED_OLD_INSTALLED_SEED' : 'PASS_SCOPED_OBSERVER_API',
    completionNonce: crypto.randomBytes(16).toString('hex'), observations: [], passed: 0, failed: 0, notRun: 0, signalsRequested: 0 };
  const file = path.join(gate, phase + '-observer-results.json');
  fs.writeFileSync(file, JSON.stringify(completed), { flag: 'wx' });
  const request = plain(rendererCompletion(b));
  const receipt = { schemaVersion: 1, feature: 'F32', phase, status: 'OBSERVED_REAL_KEYBOARD',
    ...plain(request), observations: [], productPromptInterception: false, productApiReplacement: false, signalsRequested: 0 };
  const acknowledge = value => fs.writeFileSync(path.join(gate, phase + '-renderer-results.json'), JSON.stringify(value), { flag: 'wx' });
  return { b, completed, request, receipt, acknowledge, file };
}
for (const [file, phase] of [
  ['installed-observer-proposed-06.cjs', 'disabled'],
  ['installed-upgrade-old-observer-proposed-05.cjs', 'upgrade-old'],
]) {
  const awaitCompletion = actualHandshake(file, 'awaitRendererCompletion');
  test(phase + ': fast observer cannot reach normal close before delayed renderer acknowledgment', async t => {
    const f = fixture(t, phase); let closed = false;
    const close = (async () => { await awaitCompletion(f.b, f.request.completionNonce, f.request.observerResult, 1000); closed = true; })();
    await delay(25); assert.equal(closed, false);
    f.acknowledge(f.receipt); await close; assert.equal(closed, true);
  });
  for (const [name, corrupt] of [
    ['stale attempt nonce', r => { r.completionNonce = '0'.repeat(32); }],
    ['another phase', r => { r.phase = 'uninstalled'; }],
    ['changed observer result', r => { r.observerResult.sha256 = '0'.repeat(64); }],
    ['intercepted product UI', r => { r.productPromptInterception = true; }],
  ]) test(phase + ': refuses ' + name, async t => {
    const f = fixture(t, phase); corrupt(f.receipt); f.acknowledge(f.receipt);
    await assert.rejects(awaitCompletion(f.b, f.request.completionNonce, f.request.observerResult, 100), { code: 'ERR_ASSERTION' });
  });
  test(phase + ': missing renderer acknowledgment expires without normal close', async t => {
    const f = fixture(t, phase); let closed = false;
    await assert.rejects((async () => { await awaitCompletion(f.b, f.request.completionNonce, f.request.observerResult, 20); closed = true; })(), /acknowledgment missing/);
    assert.equal(closed, false);
  });
}
test('renderer refuses a failed observer result', t => {
  const f = fixture(t, 'disabled'); f.completed.failed = 1;
  fs.writeFileSync(f.file, JSON.stringify(f.completed));
  assert.throws(() => rendererCompletion(f.b), { code: 'ERR_ASSERTION' });
});
test('renderer publishes no completion if its actual disconnect finalizer fails', async () => {
  const finalizer = source.slice(source.indexOf('    if (browser) await browser.close();'), source.indexOf('\n  }\n}', source.indexOf('    if (browser) await browser.close();')));
  assert(finalizer.includes('completedRendererResult'));
  let writes = 0;
  const run = vm.runInNewContext('(async () => {' + finalizer + '\n})', {
    browser: { close: async () => { throw Error('Disconnected transport failed'); } },
    completedRendererResult: {}, b: { gate: __dirname, phase: 'disabled' }, path, write: () => { writes++; },
  });
  await assert.rejects(run(), /Disconnected transport failed/); assert.equal(writes, 0);
});
test('renderer completion is published after successful actual disconnect finalizer', async () => {
  const finalizer = source.slice(source.indexOf('    if (browser) await browser.close();'), source.indexOf('\n  }\n}', source.indexOf('    if (browser) await browser.close();')));
  const events = [];
  const run = vm.runInNewContext('(async () => {' + finalizer + '\n})', {
    browser: { close: async () => { events.push('disconnected'); } },
    completedRendererResult: {}, b: { gate: __dirname, phase: 'disabled' }, path, write: () => { events.push('acknowledged'); },
  });
  await run(); assert.deepEqual(events, ['disconnected', 'acknowledged']);
});
for (const [beforeName, afterName, oldTail] of [
  ['installed-observer-proposed-05.cjs', 'installed-observer-proposed-06.cjs', "\n  write(path.join(b.gate, b.phase + '-observer-results.json'), {"],
  ['installed-upgrade-old-observer-proposed-04.cjs', 'installed-upgrade-old-observer-proposed-05.cjs', "\n  write(path.join(b.gate, 'upgrade-old-observer-results.json'), {"],
]) test(afterName + ': all existing assertion bodies remain byte exact', () => {
  const before = original(beforeName), after = text(afterName);
  const oldEnd = before.indexOf(oldTail), newEnd = after.indexOf('\n  const completionNonce =');
  assert(oldEnd > 0 && newEnd > 0);
  assert.equal(before.slice(before.indexOf('async function run(context)'), oldEnd), after.slice(after.indexOf('async function run(context)'), newEnd));
  assert.equal((before.match(/await check\(/g) ?? []).length, (after.match(/await check\(/g) ?? []).length);
  assert(after.includes('await awaitRendererCompletion(b, completionNonce, fact(observerResultFile));\n  await vscode.commands.executeCommand'));
});
test('all frozen predecessors still match the preparation receipt', () => {
  for (const row of read(path.join(__dirname, 'ack-preparation.json')).originals) assert.equal(sha(fs.readFileSync(row.path)), row.sha256);
});
