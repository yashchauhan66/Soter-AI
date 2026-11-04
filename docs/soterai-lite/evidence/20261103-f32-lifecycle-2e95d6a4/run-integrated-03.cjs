'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), own = name => path.join(__dirname, name);
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const helper = path.resolve(__dirname, '../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
assert.equal(sha(fs.readFileSync(helper)), 'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
const { phase } = require(helper), proof = JSON.parse(fs.readFileSync(own('full-inputs-03.json'), 'utf8'));
const proofSha256 = sha(fs.readFileSync(own('full-inputs-03.json'))), completed = [];
const write = (name, value) => fs.writeFileSync(own(name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const verify = () => { for (const row of proof.files) { const file = path.join(repo, row.path), stat = fs.lstatSync(file), raw = fs.readFileSync(file); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1); assert.equal(raw.length, row.bytes, row.path); assert.equal(sha(raw), row.sha256, row.path); } };
function walk(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  assert(!entry.isSymbolicLink()); const file = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(file) : entry.isFile() && entry.name.endsWith('.test.ts') ? [path.relative(repo, file).replaceAll('\\', '/')] : [];
}); }
function counts(name) {
  const raw = fs.readFileSync(own(name + '-stdout.bin'), 'utf8'), result = {};
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const rows = [...raw.matchAll(new RegExp('^# ' + key + ' (\\d+)\\r?$', 'gm'))]; assert.equal(rows.length, 1, name + ':' + key); result[key] = Number(rows[0][1]);
  }
  assert.equal(result.fail, 0); assert.equal(result.cancelled, 0); assert.equal(result.todo, 0); assert.equal(result.tests, result.pass + result.skipped); return result;
}
const keep = setInterval(() => {}, 1000);
(async () => {
  verify();
  const tempBase = 'D:\\SoterAI-Lite-test-profiles';
  assert(fs.lstatSync(tempBase).isDirectory() && !fs.lstatSync(tempBase).isSymbolicLink());
  assert.equal(fs.realpathSync(tempBase).toLowerCase(), tempBase.toLowerCase());
  const temporary = path.join(tempBase, 'f32-unit-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(4).toString('hex'));
  fs.mkdirSync(temporary); fs.writeFileSync(path.join(temporary, '.synthetic-f32-unit-temp'), 'retained-synthetic-fixtures-only\n', { flag: 'wx' });
  const env = { ...process.env, TEMP: temporary, TMP: temporary };
  async function run(name, args, cwd = path.join(repo, 'packages/soterai-lite')) {
    verify(); const result = await phase({ executable: process.execPath, args, cwd, env, run: __dirname, name,
      profile: 'F32_SYNTHETIC_COMPONENT_BUILD_NO_NATIVE_F26A_PUSH_OR_NETWORK', deadlineMs: 1800000 });
    assert.equal(result.closed.code, 0, name); assert.equal(result.closed.signal, null);
    for (const key of ['actualClose', 'stdoutEOF', 'stderrEOF']) assert.equal(result.close[key], true, name + ':' + key);
    assert(!result.deadline && !result.error && !result.overflow); verify(); completed.push(name); return result;
  }
  const priorRaw = fs.readFileSync(own('full-inputs-02.json'));
  assert.equal(sha(priorRaw), '2e838936989c30ce251d6365e92009526293767cf9831755417e5c215d1b5752');
  const prior = JSON.parse(priorRaw), before = new Map(prior.files.map(row => [row.path, row]));
  const delta = proof.files.filter(row => row.sha256 !== before.get(row.path)?.sha256).map(row => row.path);
  assert.deepEqual(delta, ['packages/vscode-extension/src/__tests__/extension.test.ts']);
  await run('compiler-owned-03', [path.join(repo, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', 'tsconfig.json']);
  const files = walk(path.join(repo, 'packages/vscode-extension/src/__tests__')).sort();
  assert.deepEqual(files, proof.files.filter(row => row.path.startsWith('packages/vscode-extension/src/__tests__/') && row.path.endsWith('.test.ts')).map(row => row.path).sort());
  const groups = []; for (let index = 0; index < files.length; index += 48) groups.push(files.slice(index, index + 48));
  const previousManifest = JSON.parse(fs.readFileSync(own('full-suite-shards-02.json'), 'utf8'));
  assert.deepEqual(files, previousManifest.files); assert.deepEqual(groups, previousManifest.groups);
  write('full-suite-shards-03.json', { sourceProofSha256: proofSha256, files, groups,
    reuse: 'Only first two exact closed shards; whole production/tool graph and their test source unchanged. Sole test-list delta lies in shard03; original failed03 remains excluded.' });
  const shards = [], totals = { tests: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
  for (let index = 0; index < groups.length; index++) {
    const name = 'unit-shard-' + String(index + 1).padStart(2, '0') + (index < 2 ? '-02' : '-03');
    if (index < 2) {
      verify(); assert(!groups[index].includes(delta[0]));
      const closed = JSON.parse(fs.readFileSync(own(name + '-owned-close.json'), 'utf8'));
      for (const [key, value] of Object.entries({ actualClose: true, exitCode: 0, signal: null, stdoutEOF: true, stderrEOF: true, overflow: false, streamError: false, deadlineExceeded: false, signalsRequested: 0 })) assert.equal(closed[key], value);
      for (const stream of closed.streams) { const bytes = fs.readFileSync(own(name + '-' + stream.name + '.bin')); assert.equal(bytes.length, stream.bytes); assert.equal(bytes.length, stream.observedBytes); assert.equal(sha(bytes), stream.sha256); }
      completed.push(name + ':EXACT_QUALIFIED_REUSE');
    } else await run(name, ['--import', 'tsx', '--test', '--test-concurrency=1', ...groups[index].map(file => path.join(repo, file))]);
    const result = counts(name); shards.push({ name, files: groups[index], counts: result, exactReuse: index < 2 });
    for (const key of Object.keys(totals)) totals[key] += result[key];
  }
  assert.equal(totals.skipped, 4); assert.equal(new Set(shards.flatMap(row => row.files)).size, files.length);
  write('full-suite-acceptance-03.json', { status: 'PASS_F32_CURRENT_ALL_FROZEN_TEST_FILES', observedAt: new Date().toISOString(), sourceProofSha256: proofSha256, fileCount: files.length, shards, counts: totals, signalsRequested: 0 });
  await run('package-components-03', ['--test', ...['audit-release.test.cjs', 'release-metadata.test.cjs', 'release-package.test.cjs'].map(file => path.join(repo, 'packages/soterai-lite/scripts/__tests__', file))]);
  counts('package-components-03');
  await run('readiness-03', [path.join(repo, 'packages/vscode-extension/scripts/generate-readiness.mjs'), '--check']);
  await run('build-03', [path.join(repo, 'packages/soterai-lite/scripts/build.cjs')]);
  const artifact = 'soterai-lite-0.7.0-f32-20261103-attempt01.vsix';
  await run('package-03', [path.join(repo, 'packages/soterai-lite/scripts/package.cjs'), artifact]);
  const raw = fs.readFileSync(path.join(repo, 'packages/soterai-lite', artifact));
  write('integrated-result-03.json', { status: 'CURRENT_FULL_COMPILER_COMPONENTS_BUILD_PACKAGE_PASS_NATIVE_PENDING', observedAt: new Date().toISOString(), sourceProofSha256: proofSha256,
    full: totals, fileCount: files.length, completed, artifact: { path: 'packages/soterai-lite/' + artifact, bytes: raw.length, sha256: sha(raw) }, releaseReady: false, signalsRequested: 0 });
})().catch(error => { write('integrated-failure-' + Date.now() + '.json', { status: 'FAIL_OR_INCOMPLETE_NO_LATER_PHASE', completed, name: error?.name, message: String(error?.message).slice(0, 500), signalsRequested: 0 }); console.error(error); process.exitCode = 1; }).finally(() => clearInterval(keep));
