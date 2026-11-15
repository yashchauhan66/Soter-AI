import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const gate = new URL('../lib/privacy/analytics-consent.ts', import.meta.url);

test('optional analytics requires the exact granted preference, never an absent or stale value', async () => {
  assert.ok(existsSync(gate), 'An explicit optional-analytics consent gate is required');
  const { isAnalyticsAllowed } = await import('../lib/privacy/analytics-consent');
  for (const value of [null, undefined, '', 'denied', 'yes', 'true', {}, 1]) assert.equal(isAnalyticsAllowed(value), false);
  assert.equal(isAnalyticsAllowed('granted'), true);
  const root = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.ok(root.includes('<OptionalAnalytics'), 'the root must use the gated integration');
  assert.doesNotMatch(root, /<GoogleAnalytics|static\.cloudflareinsights\.com|googletagmanager\.com/);
});
