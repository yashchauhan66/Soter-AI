import test from 'node:test';
import assert from 'node:assert/strict';
import { SITEMAP_SEGMENTS } from '../lib/seo/sitemapData';
import { ogCardUrl } from '../lib/og/cards';

test('every public sitemap page has a generated page-specific social card', () => {
  for (const entry of Object.values(SITEMAP_SEGMENTS).flat()) {
    assert.notEqual(ogCardUrl(entry.url), '/og-card/default.png', entry.url);
  }
});
