import test from 'node:test';
import assert from 'node:assert/strict';
import * as consent from '../lib/privacy/analytics-consent';

test('external preference snapshots distinguish absent, denied, granted and inaccessible storage', () => {
  const read = (consent as unknown as { readAnalyticsPreference?: (getItem: () => string | null) => string }).readAnalyticsPreference;
  assert.equal(typeof read, 'function', 'a stable external-store snapshot reader is required');
  if (!read) return;
  assert.equal(read(() => null), 'unknown');
  assert.equal(read(() => 'yes'), 'unknown');
  assert.equal(read(() => 'denied'), 'denied');
  assert.equal(read(() => 'granted'), 'granted');
  assert.equal(read(() => { throw new Error('Browser storage unavailable'); }), 'blocked');
});
