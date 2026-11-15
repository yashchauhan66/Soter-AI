import test from 'node:test';
import assert from 'node:assert/strict';
import { ogCardUrl } from '../lib/og/cards';

test('integration detail pages have their own generated social cards', () => {
  for (const path of ['/integrations/n8n', '/integrations/make', '/integrations/zapier', '/extensions/ide', '/extensions/browser']) {
    assert.notEqual(ogCardUrl(path), '/og-card/default.png', `${path} must have a page-specific card`);
  }
});
