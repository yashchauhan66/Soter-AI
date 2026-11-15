import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyResponse } from '../lib/sa/review';

const parts = (body: unknown) => ({ status: 200, body, retryAfter: null, remaining: null, limit: null, roundTripMs: 20 });

test('prototype property names are not accepted as engine verdicts', () => {
  const result = classifyResponse(parts({ action: 'toString', allowed: true, riskScore: 0, findings: [] }));
  assert.equal(result.kind, 'unavailable');
});

test('malformed findings are rejected before the review UI iterates them', () => {
  const result = classifyResponse(parts({ action: 'ALLOW', allowed: true, riskScore: 0, findings: {} }));
  assert.equal(result.kind, 'unavailable');
});

test('non-finite and out-of-range risk scores are not displayed as engine decisions', () => {
  for (const riskScore of [NaN, Infinity, -1, 101]) {
    assert.equal(classifyResponse(parts({ action: 'ALLOW', allowed: true, riskScore, findings: [] })).kind, 'unavailable');
  }
});

test('finding labels must be strings before annotations call string methods', () => {
  const result = classifyResponse(parts({ action: 'BLOCK', allowed: false, riskScore: 90, findings: [{ label: 9, severity: 'HIGH', score: 90 }] }));
  assert.equal(result.kind, 'unavailable');
});
