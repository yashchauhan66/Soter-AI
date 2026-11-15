import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../next.config.mjs';

test('the www marketing redirect uses an explicit HTTP 301', async () => {
  const redirects = await config.redirects();
  const canonical = redirects.find((r) => r.source === '/:path*' && r.has?.some((h) => h.type === 'host' && h.value === 'www.soterai.in'));
  assert.ok(canonical, 'canonical marketing redirect must exist');
  assert.equal(canonical.statusCode, 301, 'permanent:true generates 308, not the required 301');
  assert.equal(canonical.destination, 'https://soterai.in/:path*');
});
