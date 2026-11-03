'use strict';
// Read only the public vendor files already named by the tested binding.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..');
const own = name => path.join(__dirname, name);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const binding = read(own('native-binding-01.json'));
const host = read(path.resolve(repo, binding.hostReview.path));
const rows = [...new Map([...binding.vendorFacts, host.currentHost.executable,
  ...host.currentHost.applicationFiles].map(row => [row.path, row])).values()];
function measure(row) {
  const target = path.resolve(repo, row.path);
  const before = fs.lstatSync(target);
  assert(before.isFile() && !before.isSymbolicLink());
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(target, 'r');
  const chunk = Buffer.alloc(65536);
  try {
    for (;;) {
      const count = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (!count) break;
      hash.update(chunk.subarray(0, count));
    }
  } finally { fs.closeSync(fd); }
  const after = fs.lstatSync(target);
  assert.equal(after.size, before.size);
  assert.equal(after.mtimeMs, before.mtimeMs);
  return { path: row.path, bytes: before.size, sha256: hash.digest('hex') };
}
(async () => {
  const first = rows.map(measure);
  await new Promise(resolve => setTimeout(resolve, 1000));
  const second = rows.map(measure);
  assert.deepEqual(second, first, 'Vendor changed during read-only observation.');
  const changed = rows.flatMap((row, i) => row.bytes === first[i].bytes && row.sha256 === first[i].sha256
    ? [] : [{ tested: row, observed: first[i] }]);
  const report = { status: changed.length ? 'VENDOR_DRIFT_AFTER_ACCEPTED_TESTS_NO_NEW_NATIVE_CLAIM' : 'VENDOR_BYTES_UNCHANGED',
    observedAt: new Date().toISOString(), expectedBinding: 'native-binding-01.json', rows: rows.length,
    twoStableObservations: true, changed, unchanged: rows.length - changed.length,
    launches: 0, downloads: 0, signalsRequested: 0,
    scope: 'Public files already pinned by historical accepted host fixtures. No source, artifact, test, or historical vendor pin rewritten. Current-host admission is closed until fresh review.' };
  fs.writeFileSync(own('vendor-drift-observation-01.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, rows: report.rows, changed, launches: 0 }));
})().catch(error => { console.error(error); process.exitCode = 1; });
