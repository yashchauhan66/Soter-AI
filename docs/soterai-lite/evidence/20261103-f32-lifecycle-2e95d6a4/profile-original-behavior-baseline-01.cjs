'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..'), sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const helper = path.resolve(__dirname, '../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
assert.equal(sha(fs.readFileSync(helper)), 'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
const { phase } = require(helper);
const files = ['PowerShell', 'Cmd', 'GitBash'].map(name => {
  const relative = 'packages/vscode-extension/src/terminal/Checked' + name + 'Profile.ts', file = path.join(repo, relative);
  const candidate = fs.readFileSync(file), original = cp.execFileSync('git', ['cat-file', 'blob', '4f5154c4c646f057f8bf6518572586cf5a9dad8d:' + relative], { cwd: repo, windowsHide: true });
  assert(candidate.includes(Buffer.from('restoreEnabled'))); assert(!original.includes(Buffer.from('restoreEnabled')));
  fs.writeFileSync(path.join(__dirname, 'profile-' + name + '-candidate-before-baseline-01.ts.txt'), candidate, { flag: 'wx' });
  fs.writeFileSync(path.join(__dirname, 'profile-' + name + '-original-baseline-01.ts.txt'), original, { flag: 'wx' });
  return { name, file, relative, candidate, original };
});
const keep = setInterval(() => {}, 1000);
(async () => {
  let result;
  try {
    for (const row of files) { assert.equal(sha(fs.readFileSync(row.file)), sha(row.candidate)); fs.writeFileSync(row.file, row.original); }
    result = await phase({ executable: process.execPath, args: ['--import', 'tsx', '--test', path.join(repo, 'packages/vscode-extension/src/__tests__/lifecycleProfileRecovery.test.ts')],
      cwd: path.join(repo, 'packages/soterai-lite'), env: { ...process.env }, run: __dirname, name: 'profile-original-behavior-01',
      profile: 'F32_SYNTHETIC_ORIGINAL_PROFILE_GATE_MUTATION_NO_NATIVE_OR_PRODUCT_PROFILE', deadlineMs: 120000 });
    assert.equal(result.closed.signal, null); assert(result.close.actualClose && result.close.stdoutEOF && result.close.stderrEOF);
    assert(!result.deadline && !result.error && !result.overflow); assert.notEqual(result.closed.code, 0);
  } finally {
    // Never restore source while the child may still be using it.
    if (result?.close?.actualClose) for (const row of files) {
      assert.equal(sha(fs.readFileSync(row.file)), sha(row.original)); fs.writeFileSync(row.file, row.candidate);
      assert.equal(sha(fs.readFileSync(row.file)), sha(row.candidate));
    }
  }
  const raw = fs.readFileSync(path.join(__dirname, 'profile-original-behavior-01-stdout.bin'), 'utf8');
  const counts = {};
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped']) { const match = raw.match(new RegExp('^# ' + key + ' (\\d+)\\r?$', 'm')); assert(match); counts[key] = Number(match[1]); }
  assert.equal(counts.tests, 12); assert(counts.fail >= 3); assert.equal(counts.cancelled, 0); assert.equal(counts.skipped, 0);
  assert(!raw.includes("The argument 'methodName' must be a method"));
  const receipt = { status: 'ORIGINAL_GATE_BEHAVIOR_FAILURE_REPRODUCED_CANDIDATE_BYTES_RESTORED', counts,
    files: files.map(row => ({ path: row.relative, originalSha256: sha(row.original), restoredCandidateSha256: sha(row.candidate) })), signalsRequested: 0 };
  fs.writeFileSync(path.join(__dirname, 'profile-original-behavior-baseline-result-01.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(receipt));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearInterval(keep));
