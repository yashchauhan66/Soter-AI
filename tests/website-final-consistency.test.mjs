import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('public billing copy does not infer international ineligibility from INR pricing', () => {
  for (const path of ['app/comparison/page.tsx', 'app/limitations/page.tsx', 'app/contact-sales/page.tsx']) {
    const text = source(path).replace(/\s+/g, ' ');
    assert.doesNotMatch(text, /international\s+(?:billing|payments?)[^.]{0,80}(?:not available|unavailable)|outside India[^.]{0,80}cannot pay/i, path);
    assert.match(text, /confirm[^.]{0,100}(?:payment|eligibility)|(?:payment|eligibility)[^.]{0,100}confirm/i, 'qualification must be visible in ' + path);
  }
});

test('approved trimmed-path aliases return explicit 301s without changing API redirect semantics', async () => {
  const { default: config } = await import('../next.config.mjs');
  const redirects = await config.redirects();
  for (const [path, destination] of [['/extensions', '/integrations'], ['/partners', '/partners/agency']]) {
    const rule = redirects.find((row) => row.source === path);
    assert.ok(rule, path);
    assert.equal(rule.statusCode, 301, path);
    assert.equal(rule.destination, destination);
  }
  assert.equal(redirects.find((row) => row.source === '/api/:path*').permanent, true);
});

test('the illustrative article sitemap modification date matches its schema without changing publication', () => {
  const article = source('app/(public)/case-studies/prompt-injection-leaks-database/page.tsx');
  const sitemap = source('lib/seo/sitemapData.ts');
  const modified = article.match(/dateModified:\s*['"]([^'"]+)['"]/)?.[1];
  const published = article.match(/datePublished:\s*['"]([^'"]+)['"]/)?.[1];
  assert.equal(published, '2026-09-01');
  assert.equal(modified, '2026-11-11');
  const entry = sitemap.split('\n').find((line) => line.includes('url: "/case-studies/prompt-injection-leaks-database"'));
  assert.ok(entry);
  assert.ok(entry.includes('lastModified: "' + modified + '"'), 'article lastmod must be its substantive edit date');
});
