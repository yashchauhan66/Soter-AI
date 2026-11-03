'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const C = require('./current-native-admission-06.cjs');
module.exports = function closedControls(name, count, take) {
  const file = C.own(name + '-owned-close.json');
  const receipt = C.read(file);
  for (const [key, value] of Object.entries({ actualClose: true, exitCode: 0, signal: null,
    stdoutEOF: true, stderrEOF: true, overflow: false, streamError: false,
    deadlineExceeded: false, signalsRequested: 0 })) assert.equal(receipt[key], value, name + ':' + key);
  assert.deepEqual(receipt.streams.map(row => row.name).sort(), ['stderr', 'stdout']);
  for (const row of receipt.streams) {
    const stream = C.own(name + '-' + row.name + '.bin'); const raw = fs.readFileSync(stream);
    assert.equal(raw.length, row.bytes); assert.equal(raw.length, row.observedBytes); assert.equal(C.sha(raw), row.sha256);
    take(stream);
  }
  const output = fs.readFileSync(C.own(name + '-stdout.bin'), 'utf8');
  for (const [field, value] of Object.entries({ tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0, todo: 0 })) {
    const matches = output.split(/\r?\n/).filter(line => line.startsWith('# ' + field + ' '));
    assert.deepEqual(matches, ['# ' + field + ' ' + value], name + ':' + field);
  }
  take(file);
};
