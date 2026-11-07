'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
module.exports = function measure(component) {
  const Redactor = component.StreamingOutputRedactor, limits = component.streamLimits;
  assert.equal(limits.maxInputBytes, 131072); assert.equal(limits.maxOutputBytes, 131072); assert.equal(limits.maxChunks, 4096);
  const rows = [];
  function record(id, run) { const start = performance.now(); const observations = run(); rows.push({ id, elapsedMs: performance.now() - start, ...observations }); }
  const withheld = r => { assert.equal(r.status, 'WITHHELD'); assert.equal(r.stdout, ''); assert.equal(r.stderr, ''); };
  record('V02-STREAM-EXACT-BYTES', () => {
    const value = ' '.repeat(limits.maxInputBytes), r = new Redactor([]); r.push('stdout', Buffer.from(value));
    const result = r.finish(0); assert.equal(result.status, 'COMPLETE'); assert.equal(result.stdout, value);
    return { inputBytes: limits.maxInputBytes, outputBytes: Buffer.byteLength(result.stdout), usefulPublicControl: true };
  });
  record('V02-STREAM-BYTE-OVERFLOW', () => {
    const r = new Redactor([]); r.push('stdout', Buffer.alloc(limits.maxInputBytes + 1, 32)); withheld(r.finish(0));
    return { inputBytes: limits.maxInputBytes + 1, withheld: true };
  });
  record('V02-STREAM-EXACT-CHUNKS', () => {
    const r = new Redactor([]); for (let i = 1; i < limits.maxChunks; i++) r.push('stdout', Buffer.alloc(0));
    r.push('stdout', Buffer.from('Useful public output')); const result = r.finish(0); assert.equal(result.stdout, 'Useful public output'); assert.equal(result.status, 'COMPLETE');
    return { chunks: limits.maxChunks, usefulPublicControl: true };
  });
  record('V02-STREAM-CHUNK-OVERFLOW', () => {
    const r = new Redactor([]); for (let i = 0; i <= limits.maxChunks; i++) r.push('stdout', Buffer.alloc(0)); withheld(r.finish(0));
    return { chunks: limits.maxChunks + 1, withheld: true };
  });
  record('V02-STREAM-SPLIT-SECRET', () => {
    const secret = 'SOTERAI_STREAM_SYNTHETIC_ONLY_482c', bytes = Buffer.from(secret);
    for (let split = 0; split <= bytes.length; split++) {
      const r = new Redactor([secret]); r.push('stdout', bytes.subarray(0, split)); r.push('stdout', bytes.subarray(split));
      const result = r.finish(0); assert.equal(result.status, 'COMPLETE'); assert.equal(result.redacted, true); assert(!JSON.stringify(result).includes(secret));
    }
    return { splitPositions: bytes.length + 1, allSecretValuesAbsent: true };
  });
  record('V02-STREAM-WITHDRAWAL', () => {
    let enabled = true; const r = new Redactor([], { enabled: () => enabled }); r.push('stdout', Buffer.from('Public buffered input'));
    enabled = false; withheld(r.finish(0)); return { flagWithdrawalWithheld: true, mutationClassification: 'AVAILABILITY_ONLY' };
  });
  return { scope: 'PURE_COMPONENT_BOUNDARY_TIMINGS_NOT_INSTALLED_OR_REAL_AGENT_LATENCY', limits, rows, passed: rows.length, latencyAcceptanceThreshold: null };
};
