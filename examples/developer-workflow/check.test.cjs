'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { checkExample } = require('./check.cjs');
async function fixture(code) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'soterai-example-check-'));
  const source = path.join(root, 'source'); await fs.mkdir(source);
  if (code !== undefined) await fs.writeFile(path.join(source, 'app.js'), code);
  return { source, output: path.join(root, 'output') };
}
test('clean source and real generated output both pass and findings both fail', async () => {
  for (const [code, expected] of [["console.log('public')", 0], ['DB_PASSWORD=BlueMango7!', 1]]) {
    const f = await fixture(code), result = await checkExample(f.source, f.output);
    assert.equal(result.exitCode, expected);
    const summary = await fs.readFile(path.join(f.output, 'reports/summary.md'), 'utf8');
    assert.ok(!summary.includes('BlueMango7!')); assert.ok(!summary.includes('app.js'));
    assert.match(summary, /SoterAI source check/); assert.match(summary, /SoterAI artifact check/);
  }
});
test('missing and empty build entries are incomplete even when the source scan is clean', async () => {
  for (const code of [undefined, '']) {
    const f = await fixture(code), result = await checkExample(f.source, f.output);
    assert.equal(result.exitCode, 2); assert.equal(result.artifact.status, 'incomplete');
  }
});
test('a failed write leaving a partial public artifact never passes admission', async t => {
  const f = await fixture("console.log('public')"), write = fs.writeFile;
  t.mock.method(fs, 'writeFile', async (file, ...rest) => {
    if (String(file).endsWith('app.bundle.cjs')) { await write(file, 'public'); throw Error('SYNTHETIC_WRITE_FAILURE'); }
    return write(file, ...rest);
  });
  const result = await checkExample(f.source, f.output);
  assert.equal(result.exitCode, 2); assert.equal(result.artifact.status, 'incomplete');
});
test('earlier output is preserved rather than overwritten', async () => {
  const f = await fixture('public'); await fs.mkdir(f.output); await fs.writeFile(path.join(f.output, 'keep.txt'), 'keep');
  await assert.rejects(checkExample(f.source, f.output));
  assert.equal(await fs.readFile(path.join(f.output, 'keep.txt'), 'utf8'), 'keep');
});
