'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const C = require('./current-native-admission-06.cjs');
module.exports = function verifyHistoricalPlan(row) {
  assert.equal(row.path, 'docs/soterai-lite/IMPLEMENTATION-PLAN.md');
  assert.equal(row.bytes, 46991);
  assert.equal(row.sha256, '094ce355ed5704f2e5dc32fbbc0b414abac41a7b4aa5c2598e85253338c9c366');
  const current = fs.readFileSync(path.join(C.repo, row.path));
  assert.equal(C.sha(current), '4ab044dd67e2fcc4c7813df956556af52b5dd761232078c2a62fbaac1cfefd64');
  assert.equal(C.sha(current.subarray(0, row.bytes)), row.sha256);
  assert(current.subarray(row.bytes).toString('utf8').startsWith('\n\n## Current supported checkpoint - 3 November 2026\n'));
};
